"""Result types: what the solver and the co-pilot orchestration return."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel

from app.models.scenario import DAY_NAMES, Operation, ShiftType


class Assignment(BaseModel):
    day: int
    day_name: str
    shift_type: ShiftType
    worker_id: str
    worker_name: str


class Schedule(BaseModel):
    assignments: list[Assignment]
    shifts_per_worker: dict[str, int]


class ConflictReport(BaseModel):
    """Minimal conflicting subset of the requested operations (CP-SAT IIS)."""

    conflicting_operation_indices: list[int]
    explanation: str
    suggestion: str


class SolveResult(BaseModel):
    status: Literal["optimal", "feasible", "infeasible"]
    schedule: Optional[Schedule] = None
    objective: Optional[int] = None
    conflicts: Optional[ConflictReport] = None
    solve_time_ms: int


class CopilotResponse(BaseModel):
    summary: str
    operations: list[Operation]
    applied_operations: list[Operation]
    dropped_operations: list[Operation]
    healing_notes: list[str]
    result: Optional[SolveResult] = None
    parser_mode: Literal["muse-spark", "mock"]


def describe_day(day: int) -> str:
    return DAY_NAMES[day]
