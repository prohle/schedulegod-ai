"""ScheduleGod AI — backend entry point.

    instructor/chair message -> Muse Spark constraint parsing -> CP-SAT
    solve -> timetable, minimal-conflict diagnosis, or verified emergency
    coverage proposals.

Built during the Meta Global AI Developer Hackathon (Oct 27 - Nov 4, 2026).
"""

from __future__ import annotations

import io
import json
import zipfile
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, File, UploadFile
from pydantic import BaseModel

from app import config
from app.db import init_db
from app.ingestion import check_completeness, ingest
from app.ingestion.parser import IngestionParser
from app.intelligence import analyze, build_matrices, compute_utilization, run_tightener
from app.intelligence.matrices import compute_margins
from app.models.ingestion import CompletenessReport, InstitutionData
from app.models.intelligence import (
    MarginsReport,
    MatricesReport,
    SpectralReport,
    TightenResponse,
    UtilizationReport,
)
from app.models.results import CopilotResponse, EmergencyResponse, SolveResult
from app.models.scenario import Operation, ParsedRequest, Scenario
from app.parsing.parser import ConstraintParser, validate_operations
from app.services import audit
from app.services.copilot import run_copilot
from app.services.emergency import run_emergency
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


class SolveRequest(BaseModel):
    scenario: Scenario
    operations: Optional[list] = None


class IngestRequest(BaseModel):
    text: str


class IngestResponse(BaseModel):
    scenario: Scenario
    parsed: InstitutionData
    parser_mode: str
    completeness: CompletenessReport


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
                          completeness=check_completeness(data))


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
    """Drop one file, many files, or a zip. Every file's text is concatenated
    (zips are extracted) and autocleaned; the response reports which of the six
    required inputs were found and which are missing."""
    chunks: list[str] = []
    for f in files:
        content = await f.read()
        if f.filename and f.filename.lower().endswith(".zip"):
            with zipfile.ZipFile(io.BytesIO(content)) as z:
                for name in z.namelist():
                    if name.endswith("/"):
                        continue
                    chunks.append(f"\n--- {name} ---\n" + z.read(name).decode("utf-8", errors="replace"))
        else:
            chunks.append(f"\n--- {f.filename or 'file'} ---\n"
                          + content.decode("utf-8", errors="replace"))
    return _ingest_text("".join(chunks))


@app.post("/scenario/reset", response_model=Scenario)
def reset_scenario() -> Scenario:
    """Discard the ingested scenario and return to the seed."""
    global _current_scenario
    _current_scenario = None
    return get_current_scenario()


@app.post("/parse", response_model=ParsedRequest)
def parse(req: MessageRequest) -> ParsedRequest:
    scenario = req.scenario or get_current_scenario()
    return ConstraintParser().parse(req.message, scenario)


@app.post("/solve", response_model=SolveResult)
def solve_scenario(req: SolveRequest) -> SolveResult:
    from app.models.scenario import Operation
    ops, _ = validate_operations(
        [Operation.model_validate(o) for o in (req.operations or [])], req.scenario)
    return solve(req.scenario, ops)


@app.post("/copilot", response_model=CopilotResponse)
def copilot(req: MessageRequest) -> CopilotResponse:
    scenario = req.scenario or get_current_scenario()
    return run_copilot(scenario, req.message)


@app.post("/emergency", response_model=EmergencyResponse)
def emergency(req: MessageRequest) -> EmergencyResponse:
    scenario = req.scenario or get_current_scenario()
    return run_emergency(scenario, req.message)


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


@app.post("/intelligence/tighten", response_model=TightenResponse)
def intelligence_tighten(req: TightenRequest) -> TightenResponse:
    """Muse proposes typed repair moves; CP-SAT verifies every one."""
    scenario = req.scenario or get_current_scenario()
    ops, _ = validate_operations(
        [Operation.model_validate(o) for o in (req.operations or [])], scenario)
    return run_tightener(scenario, ops)
