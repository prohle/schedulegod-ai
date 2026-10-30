"""ScheduleGod AI — backend entry point.

    instructor/chair message -> Muse Spark constraint parsing -> CP-SAT
    solve -> timetable, minimal-conflict explanation, or verified emergency
    coverage proposals.

Built during the Meta Global AI Developer Hackathon (Oct 27 - Nov 4, 2026).
"""

from __future__ import annotations

import json
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, File, UploadFile
from pydantic import BaseModel

from app import config
from app.db import init_db
from app.ingestion import check_completeness, ingest
from app.ingestion.normalize import build_scenario
from app.ingestion.parser import IngestionParser
from app.intelligence import analyze, build_matrices, compute_utilization, run_tightener, whatif
from app.intelligence.matrices import compute_margins
from app.models.ingestion import CompletenessReport, InstitutionData
from app.models.intelligence import (
    MarginsReport,
    MatricesReport,
    SpectralReport,
    TightenResponse,
    UtilizationReport,
    WhatIfReport,
)
from app.models.results import AgentStep, CompareResult, CopilotResponse, EmergencyResponse, SolveResult
from app.models.scenario import Operation, ParsedRequest, Scenario
from app.parsing.parser import ConstraintParser, validate_operations
from app.services import audit
from app.services.apply import apply_operations
from app.services.copilot import run_copilot
from app.services.emergency import run_emergency
from app.services.voice import transcribe_wav
from app.solver.scheduling_model import solve


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()  # create provenance tables if they don't exist (best-effort)
    yield


app = FastAPI(title="ScheduleGod AI", version="0.2.0", lifespan=lifespan)


def load_seed_scenario() -> Scenario:
    with open(config.SEED_SCENARIO_PATH) as f:
        return Scenario.model_validate(json.load(f))


# The "current" scenario: seeded from the file, replaceable by /ingest (the
# "point the tool at your data" step). In-memory for the demo; the audit trail
# is the durable record of what happened.
_current_scenario: Optional[Scenario] = None


def get_current_scenario() -> Scenario:
    global _current_scenario
    return _current_scenario or load_seed_scenario()


class MessageRequest(BaseModel):
    message: str
    scenario: Optional[Scenario] = None
    speaker_id: Optional[str] = None  # intake window: who is speaking


class ApplyOpsRequest(BaseModel):
    """Commit a verified proposal to the durable term state."""

    operations: list[Operation] = []
    pins: dict[str, str] = {}          # section_id -> instructor_id
    remove_instructor_id: Optional[str] = None
    scenario: Optional[Scenario] = None


class SolveRequest(BaseModel):
    scenario: Scenario
    operations: Optional[list] = None
    engine: str = "cpsat"  # "cpsat" (OR-Tools) | "ours" (ScheduleGod home solver)


class IngestRequest(BaseModel):
    text: str


class ApplyRequest(BaseModel):
    data: InstitutionData


class IngestResponse(BaseModel):
    scenario: Scenario
    parsed: InstitutionData
    parser_mode: str
    completeness: CompletenessReport
    model: Optional[str] = None
    parser_latency_ms: Optional[int] = None


def _ingest_text(text: str) -> IngestResponse:
    """Shared ingest core: parse, assemble, store the current scenario, audit."""
    global _current_scenario
    parser = IngestionParser()
    data = parser.parse(text)
    scenario = ingest(text)[0]
    _current_scenario = scenario
    audit.record_submission(text[:500], data.summary, parser.mode)
    audit.record_event("ingest",
                       f"Ingested {len(data.courses)} courses, {len(data.instructors)} instructors, "
                       f"{len(data.cohorts)} cohorts, {len(data.rooms)} rooms",
                       {"courses": len(data.courses), "instructors": len(data.instructors),
                        "cohorts": len(data.cohorts), "rooms": len(data.rooms)})
    return IngestResponse(scenario=scenario, parsed=data, parser_mode=parser.mode,
                          completeness=check_completeness(data),
                          model=parser.model, parser_latency_ms=parser.last_latency_ms)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "schedulegod-ai-backend"}


@app.get("/history")
def history() -> dict:
    """The audit trail: every intake submission + change event, most recent first."""
    return audit.history()


@app.get("/scenario", response_model=Scenario)
def get_scenario() -> Scenario:
    return get_current_scenario()


@app.post("/ingest", response_model=IngestResponse)
def ingest_data(req: IngestRequest) -> IngestResponse:
    """Point the tool at free-form institutional data (catalog, degree maps,
    cohorts, faculty, campus, facilities). Muse Spark autocleans it into the
    structured scenario, which becomes current for every later call."""
    return _ingest_text(req.text)


@app.post("/ingest/files", response_model=IngestResponse)
async def ingest_files(files: list[UploadFile] = File(...)) -> IngestResponse:
    """Drop messy institutional files in any format — PDF, Word, Excel, CSV,
    JSON, text, or a zip of all of them. Each file is extracted to text
    (app.ingestion.extract), concatenated, and autocleaned; the response
    reports which of the six required inputs were found and which are missing."""
    from app.ingestion.extract import extract_text
    chunks: list[str] = []
    for f in files:
        content = await f.read()
        name = f.filename or "file"
        chunks.append(f"\n--- {name} ---\n" + extract_text(name, content))
    return _ingest_text("".join(chunks))


@app.post("/ingest/apply", response_model=IngestResponse)
def ingest_apply(req: ApplyRequest) -> IngestResponse:
    """Finalize an edited extraction: rebuild the scenario from the reviewed
    (keep/changed) entities and make it current. The frontend sends back the
    user-edited InstitutionData after the review panel."""
    global _current_scenario
    scenario = build_scenario(req.data)
    _current_scenario = scenario
    audit.record_event("ingest-apply",
                       f"Applied edited data: {len(req.data.courses)} courses, "
                       f"{len(req.data.instructors)} instructors, {len(req.data.cohorts)} cohorts")
    return IngestResponse(scenario=scenario, parsed=req.data, parser_mode="reviewed",
                          completeness=check_completeness(req.data))


@app.post("/scenario/reset", response_model=Scenario)
def reset_scenario() -> Scenario:
    """Discard the ingested scenario and return to the seed."""
    global _current_scenario
    _current_scenario = None
    return get_current_scenario()


@app.post("/scenario/department", response_model=Scenario)
def department_scenario() -> Scenario:
    """Load the department-scale scenario (26 instructors, 25 sections,
    3 programs, 12 cohorts) built deterministically from the seed.

    Same engine, real-department scale — the one-click scale proof judges
    can run live. `POST /scenario/reset` returns to the story seed.
    """
    global _current_scenario
    from app.data.department import build_department_scenario
    _current_scenario = build_department_scenario(load_seed_scenario())
    audit.record_event(
        "scenario", "Loaded department-scale scenario "
        f"({len(_current_scenario.instructors)} instructors, "
        f"{len(_current_scenario.sections)} sections, "
        f"{len(_current_scenario.cohorts)} cohorts)", {})
    return _current_scenario


@app.post("/scenario/university", response_model=Scenario)
def university_scenario() -> Scenario:
    """Load the university-scale scenario (38 instructors, 41 sections,
    5 programs, 20 cohorts) — the entire institution on one solve."""
    global _current_scenario
    from app.data.department import build_university_scenario
    _current_scenario = build_university_scenario(load_seed_scenario())
    audit.record_event(
        "scenario", "Loaded university-scale scenario "
        f"({len(_current_scenario.instructors)} instructors, "
        f"{len(_current_scenario.sections)} sections, "
        f"{len(_current_scenario.cohorts)} cohorts)", {})
    return _current_scenario


@app.post("/apply", response_model=Scenario)
def apply_request(req: ApplyOpsRequest) -> Scenario:
    """Commit a verified co-pilot/emergency proposal to the current term.

    This is the explicit "accept" step: after it, every later solve builds on
    the new world state instead of silently reverting to the seed.
    """
    global _current_scenario
    base = req.scenario or get_current_scenario()
    ops = list(req.operations)
    if req.remove_instructor_id:
        ops.append(Operation(
            op="remove_instructor", instructor_id=req.remove_instructor_id,
            explanation=f"Remove {req.remove_instructor_id} for the term."))
    for sid, iid in req.pins.items():
        ops.append(Operation(
            op="set_section_instructor", section_id=sid, instructor_id=iid,
            explanation=f"Keep {sid} with {iid}."))
    validated, notes = validate_operations(ops, base)
    scenario = apply_operations(base, validated)
    _current_scenario = scenario
    audit.record_event(
        "apply", f"Applied {len(validated)} operation(s) to the term",
        {"operations": [o.op for o in validated], "notes": notes})
    return scenario


@app.post("/parse", response_model=ParsedRequest)
def parse(req: MessageRequest) -> ParsedRequest:
    scenario = req.scenario or get_current_scenario()
    return ConstraintParser().parse(req.message, scenario, req.speaker_id)


@app.get("/engines")
def engines() -> dict:
    """Registered solver engines behind the standardized interface —
    the Build-step picker and any API client discover them here."""
    from app.solver.engine import list_engines
    return {"engines": list_engines()}


@app.post("/solve", response_model=SolveResult)
def solve_scenario(req: SolveRequest) -> SolveResult:
    from fastapi import HTTPException
    from app.models.scenario import Operation
    from app.solver.engine import ENGINE_IDS
    if req.engine not in ENGINE_IDS:
        raise HTTPException(status_code=400,
                            detail=f"unknown engine {req.engine!r}; available: {ENGINE_IDS}")
    ops, _ = validate_operations(
        [Operation.model_validate(o) for o in (req.operations or [])], req.scenario)
    return solve(req.scenario, ops, engine=req.engine)


class CompareRequest(BaseModel):
    scenario: Optional[Scenario] = None
    operations: Optional[list] = None


@app.post("/solve/compare", response_model=CompareResult)
def solve_compare(req: CompareRequest) -> CompareResult:
    """Run both engines on the same world and diff the timetables."""
    from app.models.scenario import Operation
    scenario = req.scenario or get_current_scenario()
    ops, _ = validate_operations(
        [Operation.model_validate(o) for o in (req.operations or [])], scenario)
    cpsat = solve(scenario, ops, engine="cpsat")
    ours = solve(scenario, ops, engine="ours")
    differing: list[str] = []
    agreement: Optional[float] = None
    if cpsat.timetable and ours.timetable:
        a = {p.section_id: (p.instructor_id, tuple(p.days), p.period, p.room_id)
             for p in cpsat.timetable.placements}
        b = {p.section_id: (p.instructor_id, tuple(p.days), p.period, p.room_id)
             for p in ours.timetable.placements}
        differing = sorted(sid for sid in a if a[sid] != b.get(sid))
        agreement = round(100.0 * (len(a) - len(differing)) / max(1, len(a)), 1)
    return CompareResult(
        cpsat=cpsat, ours=ours,
        same_status=cpsat.status == ours.status,
        agreement_pct=agreement,
        differing_sections=differing,
        objective_delta=(ours.objective - cpsat.objective)
        if cpsat.objective is not None and ours.objective is not None else None,
        speed_ratio=round(ours.solve_time_ms / cpsat.solve_time_ms, 2)
        if cpsat.solve_time_ms else None,
    )


class OptionsRequest(BaseModel):
    scenario: Optional[Scenario] = None
    operations: Optional[list] = None


class PinRequest(BaseModel):
    scenario: Optional[Scenario] = None
    # section_id -> {"instructor_id", "room_id", "period" (MWF/TTh) or "day" (block)}
    pins: dict[str, dict] = {}


@app.post("/schedule/options", response_model=list[SolveResult])
def schedule_options(req: OptionsRequest) -> list[SolveResult]:
    """A few schedule options: the same hard constraints, different objectives
    (preference-optimal, balanced faculty load, tightest room fit)."""
    scenario = req.scenario or get_current_scenario()
    ops, _ = validate_operations(
        [Operation.model_validate(o) for o in (req.operations or [])], scenario)
    return [solve(scenario, ops, objective=name)
            for name in ("preference", "balanced_load", "room_fit")]


@app.post("/schedule/pin", response_model=SolveResult)
def schedule_pin(req: PinRequest) -> SolveResult:
    """Keep chosen placements (pin them) and re-solve the rest — 'what to keep'."""
    scenario = req.scenario or get_current_scenario()
    pins_exact: dict[str, tuple[str, int, str]] = {}
    for sid, pin in req.pins.items():
        section = scenario.section_by_id(sid)
        course = scenario.course(section.course_id)
        key = pin.get("period") if course.pattern in ("MWF", "TTh") else pin.get("day")
        if pin.get("instructor_id") and key is not None and pin.get("room_id"):
            pins_exact[sid] = (pin["instructor_id"], key, pin["room_id"])
    return solve(scenario, pins_exact=pins_exact)


@app.post("/copilot", response_model=CopilotResponse)
def copilot(req: MessageRequest) -> CopilotResponse:
    scenario = req.scenario or get_current_scenario()
    return run_copilot(scenario, req.message, speaker_id=req.speaker_id)


@app.post("/emergency", response_model=EmergencyResponse)
def emergency(req: MessageRequest) -> EmergencyResponse:
    scenario = req.scenario or get_current_scenario()
    return run_emergency(scenario, req.message)


@app.post("/emergency/audio", response_model=EmergencyResponse)
async def emergency_audio(file: UploadFile = File(...)) -> EmergencyResponse:
    """Voice call-in: Muse Voice Transcribe -> the same verified emergency flow."""
    audio = await file.read()
    transcript = transcribe_wav(audio, file.filename or "voice-note.wav")
    response = run_emergency(get_current_scenario(), transcript)
    response.transcript = transcript
    response.agent_trace.insert(0, AgentStep(
        step="transcribe", actor="Muse Voice Transcribe · muse-voice-transcribe-1.0",
        detail=f"Transcribed the voice note: \"{transcript}\""))
    return response


# --- intelligence services: sparse matrices, spectral radar, AI tightening ----

class TightenRequest(BaseModel):
    scenario: Optional[Scenario] = None
    operations: Optional[list] = None


@app.get("/intelligence/matrices", response_model=MatricesReport)
def intelligence_matrices() -> MatricesReport:
    """Every entity relationship as a scipy sparse matrix (COO on the wire)."""
    return build_matrices(get_current_scenario()).to_report()


@app.get("/intelligence/spectral", response_model=SpectralReport)
def intelligence_spectral() -> SpectralReport:
    """Spectral radar: conflict-graph spectrum, deadlock warnings, warm-start hints."""
    return analyze(get_current_scenario())


@app.get("/intelligence/margins", response_model=MarginsReport)
def intelligence_margins() -> MarginsReport:
    """C39 four-course guarantee, audited against a fresh CP-SAT solve."""
    scenario = get_current_scenario()
    result = solve(scenario)
    return compute_margins(scenario, result.timetable, config.MIN_COURSES_PER_COHORT)


@app.get("/intelligence/utilization", response_model=UtilizationReport)
def intelligence_utilization() -> UtilizationReport:
    """Campus (room) + faculty utilization against a fresh CP-SAT solve."""
    scenario = get_current_scenario()
    result = solve(scenario)
    return compute_utilization(scenario, result.timetable)


@app.get("/planning/whatif/{change_id}", response_model=WhatIfReport)
def planning_whatif(change_id: str) -> WhatIfReport:
    """What-if planning: simulate a change (new lab, growth, repurpose) and
    report the before/after impact."""
    return whatif(get_current_scenario(), change_id)


@app.post("/intelligence/tighten", response_model=TightenResponse)
def intelligence_tighten(req: TightenRequest) -> TightenResponse:
    """Muse proposes typed repair moves; CP-SAT verifies every one."""
    scenario = req.scenario or get_current_scenario()
    ops, _ = validate_operations(
        [Operation.model_validate(o) for o in (req.operations or [])], scenario)
    return run_tightener(scenario, ops)
