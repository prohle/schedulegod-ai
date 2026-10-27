"""ScheduleGod AI — backend entry point.

    text/voice request -> Muse Spark constraint parsing -> OR-Tools solve
    -> schedule or infeasibility report -> self-healing agent loop.

Built during the Meta Global AI Developer Hackathon (Oct 27 - Nov 4, 2026).
"""

from __future__ import annotations

import json
from typing import Optional

from fastapi import FastAPI
from pydantic import BaseModel

from app import config
from app.models.results import CopilotResponse, SolveResult
from app.models.scenario import ParsedRequest, Scenario
from app.parsing.parser import ConstraintParser, validate_operations
from app.services.copilot import run_copilot
from app.solver.scheduling_model import solve

app = FastAPI(title="ScheduleGod AI", version="0.1.0")


def load_seed_scenario() -> Scenario:
    with open(config.SEED_SCENARIO_PATH) as f:
        return Scenario.model_validate(json.load(f))


class CopilotRequest(BaseModel):
    message: str
    scenario: Optional[Scenario] = None


class SolveRequest(BaseModel):
    scenario: Scenario
    operations: Optional[list] = None


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "schedulegod-ai-backend"}


@app.get("/scenario", response_model=Scenario)
def get_scenario() -> Scenario:
    return load_seed_scenario()


@app.post("/parse", response_model=ParsedRequest)
def parse(req: CopilotRequest) -> ParsedRequest:
    scenario = req.scenario or load_seed_scenario()
    return ConstraintParser().parse(req.message, scenario)


@app.post("/solve", response_model=SolveResult)
def solve_scenario(req: SolveRequest) -> SolveResult:
    ops, _ = validate_operations(req.operations or [], req.scenario)
    return solve(req.scenario, ops)


@app.post("/copilot", response_model=CopilotResponse)
def copilot(req: CopilotRequest) -> CopilotResponse:
    scenario = req.scenario or load_seed_scenario()
    return run_copilot(scenario, req.message)
