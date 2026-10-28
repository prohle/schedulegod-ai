"""Result types: timetable, conflict reports, and emergency coverage proposals."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel


class Placement(BaseModel):
    """Where one section landed: instructor, timeslot(s), room."""

    section_id: str
    course_id: str
    course_code: str
    instructor_id: str
    instructor_name: str
    days: list[int]          # meeting days
    period: Optional[int]    # one-period patterns; None for blocks
    periods: list[int]       # occupied periods (1 or 2 entries)
    room_id: str
    room_name: str
    building_id: str


class Timetable(BaseModel):
    placements: list[Placement]
    sections_per_instructor: dict[str, int]


class ConflictReport(BaseModel):
    """Minimal conflicting subset of the requested operations (CP-SAT IIS)."""

    conflicting_operation_indices: list[int]
    explanation: str
    suggestion: str


class SolveResult(BaseModel):
    status: Literal["optimal", "feasible", "infeasible"]
    timetable: Optional[Timetable] = None
    objective: Optional[int] = None
    conflicts: Optional[ConflictReport] = None
    solve_time_ms: int


class CandidateProposal(BaseModel):
    """One instructor's CP-SAT-verified viability for covering a section."""

    section_id: str
    course_code: str
    instructor_id: str
    instructor_name: str
    feasible: bool
    objective_delta: Optional[int] = None
    load_after: Optional[int] = None
    reason: str


class Resolution(BaseModel):
    """One Muse-proposed fix: drop exactly one conflicting request."""

    drop_operation_index: int
    tradeoff: str


class DiagnosisResult(BaseModel):
    """Structured-output contract for the Muse Spark diagnosis call."""

    diagnosis: str
    resolutions: list[Resolution]


class ResolutionOption(BaseModel):
    """A resolution Muse proposed AND CP-SAT re-solved successfully."""

    dropped_operation_index: int
    dropped_explanation: str
    tradeoff: str
    result: SolveResult


class EmergencyResponse(BaseModel):
    removed_instructor_id: str
    removed_instructor_name: str
    affected_section_ids: list[str]
    proposals: list[CandidateProposal]
    chosen: dict[str, str]           # section_id -> chosen instructor_id
    healing_notes: list[str]
    result: Optional[SolveResult] = None
    parser_mode: Literal["muse-spark", "mock"]


class CopilotResponse(BaseModel):
    summary: str
    operations: list = []
    applied_operations: list = []
    dropped_operations: list = []
    healing_notes: list[str] = []
    diagnosis: Optional[str] = None
    diagnosis_mode: Optional[str] = None
    options: list[ResolutionOption] = []
    result: Optional[SolveResult] = None
    parser_mode: Literal["muse-spark", "mock"]
