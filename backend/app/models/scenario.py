"""Core data contract: the scheduling scenario and the LLM operation vocabulary.

The whole system revolves around two structures:

1. `Scenario`      - the deterministic world the solver reasons over.
2. `Operation`     - one edit a human request maps to; Muse Spark produces a
                     list of these, and the solver guards each incoming
                     operation behind an *assumption literal* so that when a
                     request set is infeasible, CP-SAT can name the minimal
                     conflicting subset (the self-healing hook).

Kept flat and recursion-free by design: the Meta Model API rejects recursive
JSON schemas, and flat schemas make structured output more reliable.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

ShiftType = Literal["day", "evening", "night"]
Role = Literal["RN", "CNA"]

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


class Worker(BaseModel):
    id: str
    name: str
    role: Role
    max_shifts_per_week: int = 5
    min_shifts_per_week: int = 2


class Coverage(BaseModel):
    """Minimum staff required per shift slot, per role."""

    role: Role
    count: int


class HardRule(BaseModel):
    """Unit-wide rule. `value` semantics depend on `rule_type` (hours / days)."""

    rule_type: Literal["min_rest_hours", "max_consecutive_days"]
    value: int
    label: Optional[str] = None


class Unavailability(BaseModel):
    worker_id: str
    day: int = Field(ge=0, le=6)
    shift_type: Optional[ShiftType] = None  # None = entire day


class ForcedAssignment(BaseModel):
    worker_id: str
    day: int = Field(ge=0, le=6)
    shift_type: ShiftType


class Preference(BaseModel):
    """Soft constraint: `avoid` penalizes assignment, `prefer` rewards it."""

    worker_id: str
    kind: Literal["prefer", "avoid"]
    day: Optional[int] = Field(default=None, ge=0, le=6)
    shift_type: Optional[ShiftType] = None
    weight: int = 10


class Scenario(BaseModel):
    name: str
    workers: list[Worker]
    days: list[int]
    shift_types: list[ShiftType]
    coverage: list[Coverage]
    hard_rules: list[HardRule]
    unavailability: list[Unavailability] = []
    forced: list[ForcedAssignment] = []
    preferences: list[Preference] = []

    def worker_ids(self) -> set[str]:
        return {w.id for w in self.workers}


class Operation(BaseModel):
    """One structured edit extracted from a natural-language request.

    Muse Spark emits these via structured output (JSON-schema constrained
    decoding); every field is validated with Pydantic before it may touch
    the solver. `explanation` is plain English for the UI / change log.
    """

    op: Literal["add_unavailability", "force_assignment", "add_hard_rule", "add_preference"]
    worker_id: Optional[str] = None
    day: Optional[int] = Field(default=None, ge=0, le=6)
    shift_type: Optional[ShiftType] = None
    rule_type: Optional[Literal["min_rest_hours", "max_consecutive_days"]] = None
    value: Optional[int] = None
    kind: Optional[Literal["prefer", "avoid"]] = None
    weight: Optional[int] = None
    explanation: str


class ParsedRequest(BaseModel):
    """Structured-output contract for the constraint-parsing model call."""

    summary: str
    operations: list[Operation]
