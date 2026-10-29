"""ScheduleGod AI — backend entry point.

    instructor/chair message -> Muse Spark constraint parsing -> CP-SAT
    solve -> timetable, minimal-conflict diagnosis, or verified emergency
    coverage proposals.

Built during the Meta Global AI Developer Hackathon (Oct 27 - Nov 4, 2026).
"""

from __future__ import annotations

import json
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI
from pydantic import BaseModel

from app import config
from app.db import init_db
from app.intelligence import analyze, build_matrices, run_tightener
from app.intelligence.matrices import compute_margins
from app.models.intelligence import (
    MarginsReport,
    MatricesReport,
    SpectralReport,
    TightenResponse,
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


class MessageRequest(BaseModel):
    message: str
    scenario: Optional[Scenario] = None


class SolveRequest(BaseModel):
    scenario: Scenario
    operations: Optional[list] = None


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "schedulegod-ai-backend"}


@app.get("/history")
def history() -> dict:
    """The audit trail: every intake submission + change event, most recent first."""
    return audit.history()


@app.get("/scenario", response_model=Scenario)
def get_scenario() -> Scenario:
    return load_seed_scenario()


@app.post("/parse", response_model=ParsedRequest)
def parse(req: MessageRequest) -> ParsedRequest:
    scenario = req.scenario or load_seed_scenario()
    return ConstraintParser().parse(req.message, scenario)


@app.post("/solve", response_model=SolveResult)
def solve_scenario(req: SolveRequest) -> SolveResult:
    from app.models.scenario import Operation
    ops, _ = validate_operations(
        [Operation.model_validate(o) for o in (req.operations or [])], req.scenario)
    return solve(req.scenario, ops)


@app.post("/copilot", response_model=CopilotResponse)
def copilot(req: MessageRequest) -> CopilotResponse:
    scenario = req.scenario or load_seed_scenario()
    return run_copilot(scenario, req.message)


@app.post("/emergency", response_model=EmergencyResponse)
def emergency(req: MessageRequest) -> EmergencyResponse:
    scenario = req.scenario or load_seed_scenario()
    return run_emergency(scenario, req.message)


# --- intelligence services: sparse matrices, spectral radar, AI tightening ----

class TightenRequest(BaseModel):
    scenario: Optional[Scenario] = None
    operations: Optional[list] = None


@app.get("/intelligence/matrices", response_model=MatricesReport)
def intelligence_matrices() -> MatricesReport:
    """Every entity relationship as a scipy sparse matrix (COO on the wire)."""
    return build_matrices(load_seed_scenario()).to_report()


@app.get("/intelligence/spectral", response_model=SpectralReport)
def intelligence_spectral() -> SpectralReport:
    """Spectral radar: conflict-graph spectrum, deadlock warnings, warm-start hints."""
    return analyze(load_seed_scenario())


@app.get("/intelligence/margins", response_model=MarginsReport)
def intelligence_margins() -> MarginsReport:
    """C39 four-course guarantee, audited against a fresh CP-SAT solve."""
    scenario = load_seed_scenario()
    result = solve(scenario)
    return compute_margins(scenario, result.timetable, config.MIN_COURSES_PER_COHORT)


@app.post("/intelligence/tighten", response_model=TightenResponse)
def intelligence_tighten(req: TightenRequest) -> TightenResponse:
    """Muse proposes typed repair moves; CP-SAT verifies every one."""
    scenario = req.scenario or load_seed_scenario()
    ops, _ = validate_operations(
        [Operation.model_validate(o) for o in (req.operations or [])], scenario)
    return run_tightener(scenario, ops)
