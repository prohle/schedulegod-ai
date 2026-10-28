"""Core data contract: academic course timetabling.

The world a department scheduler actually faces every term:

- Instructors with hard schedules, soft preferences, load and prep caps
- Cohorts identified by admission year / expected graduation / current term
  index, whose position on a degree roadmap determines what MUST be offered
- A fixed inventory of rooms across campus buildings with a walk-distance
  matrix (a 15-minute sprint between buildings breaks back-to-back classes)
- Course sections with fixed meeting patterns (MWF / TTh / weekly lab block)

Flat and recursion-free by design (Meta Model API rejects recursive JSON
schemas; flat schemas are more reliable for structured output).
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
PERIOD_NAMES = ["8:00", "10:00", "13:00", "15:00"]

# A weekly "block" (lab) occupies two consecutive afternoon periods,
# scheduled on one of these days.
BLOCK_DAYS = [1, 2, 3]
BLOCK_PERIODS = [2, 3]

PATTERN_DAYS: dict[str, list[int]] = {"MWF": [0, 2, 4], "TTh": [1, 3]}

RoomType = Literal["lecture", "lab", "seminar"]
Pattern = Literal["MWF", "TTh", "block"]


class Building(BaseModel):
    id: str
    name: str


class Room(BaseModel):
    id: str
    name: str
    building_id: str
    capacity: int
    room_type: RoomType


class RoomBlackout(BaseModel):
    room_id: str
    day: int = Field(ge=0, le=4)
    period: Optional[int] = Field(default=None, ge=0, le=3)  # None = whole day


class SlotRef(BaseModel):
    day: int = Field(ge=0, le=4)
    period: int = Field(ge=0, le=3)


class InstructorPreference(BaseModel):
    kind: Literal["prefer", "avoid"]
    day: Optional[int] = Field(default=None, ge=0, le=4)
    period: Optional[int] = Field(default=None, ge=0, le=3)
    course_id: Optional[str] = None
    weight: int = 10


class Instructor(BaseModel):
    id: str
    name: str
    qualified_courses: list[str]
    max_sections: int = 2
    max_preps: int = 2
    hard_unavailable: list[SlotRef] = []
    preferences: list[InstructorPreference] = []


class Course(BaseModel):
    id: str
    code: str
    title: str
    pattern: Pattern
    room_type: RoomType
    seats: int  # minimum room capacity needed (per-section enrollment)


class Section(BaseModel):
    id: str
    course_id: str


class Program(BaseModel):
    id: str
    name: str
    roadmap: dict[str, list[str]]  # "term index" -> required course ids


class Cohort(BaseModel):
    """How far along a cohort is decides what must be offered this term."""

    id: str
    program_id: str
    name: str
    admission_year: int
    graduation_year: int
    current_term: int = Field(ge=0)
    size: int


class Scenario(BaseModel):
    name: str
    buildings: list[Building]
    rooms: list[Room]
    instructors: list[Instructor]
    courses: list[Course]
    sections: list[Section]
    programs: list[Program]
    cohorts: list[Cohort]
    distances: dict[str, dict[str, int]]  # building_id -> building_id -> walk minutes
    room_blackouts: list[RoomBlackout] = []
    walk_limit_min: int = 10  # max walk between back-to-back classes

    # --- lookups -----------------------------------------------------------
    def course(self, course_id: str) -> Course:
        return next(c for c in self.courses if c.id == course_id)

    def course_code(self, course_id: str) -> str:
        return self.course(course_id).code

    def sections_of_course(self, course_id: str) -> list[Section]:
        return [s for s in self.sections if s.course_id == course_id]

    def instructor(self, instructor_id: str) -> Instructor:
        return next(i for i in self.instructors if i.id == instructor_id)

    def room(self, room_id: str) -> Room:
        return next(r for r in self.rooms if r.id == room_id)

    def section_by_id(self, section_id: str) -> Section:
        return next(s for s in self.sections if s.id == section_id)

    # --- demand ------------------------------------------------------------
    def cohort_term_courses(self, cohort: Cohort) -> list[str]:
        program = next(p for p in self.programs if p.id == cohort.program_id)
        return program.roadmap.get(str(cohort.current_term), [])

    def enrollment_for_section(self, section: Section) -> int:
        """Projected enrollment: all cohort demand for the course / sections."""
        course = self.course(section.course_id)
        demand = sum(
            c.size for c in self.cohorts
            if course.id in self.cohort_term_courses(c)
        )
        return demand // max(1, len(self.sections_of_course(course.id)))

    def demanded_section_pairs(self) -> list[tuple[Section, Section]]:
        """Section pairs that some cohort needs simultaneously (C7)."""
        pairs: list[tuple[Section, Section]] = []
        needed = {
            c.id: {s.id for cid in self.cohort_term_courses(c)
                   for s in self.sections_of_course(cid)}
            for c in self.cohorts
        }
        for c in self.cohorts:
            ids = sorted(needed[c.id])
            for i, a in enumerate(ids):
                for b in ids[i + 1:]:
                    sa = next(s for s in self.sections if s.id == a)
                    sb = next(s for s in self.sections if s.id == b)
                    pairs.append((sa, sb))
        # dedupe across cohorts
        seen: set[tuple[str, str]] = set()
        out = []
        for sa, sb in pairs:
            key = (min(sa.id, sb.id), max(sa.id, sb.id))
            if key not in seen:
                seen.add(key)
                out.append((sa, sb))
        return out


class Operation(BaseModel):
    """One structured edit extracted from natural language.

    Muse Spark emits these via structured output; Pydantic validates before
    anything touches the solver. `explanation` goes to the UI change log.
    """

    op: Literal[
        "add_instructor_unavailability",
        "add_instructor_preference",
        "add_room_unavailability",
        "remove_instructor",
        "set_section_instructor",
    ]
    instructor_id: Optional[str] = None
    section_id: Optional[str] = None
    room_id: Optional[str] = None
    day: Optional[int] = Field(default=None, ge=0, le=4)
    period: Optional[int] = Field(default=None, ge=0, le=3)
    kind: Optional[Literal["prefer", "avoid"]] = None
    weight: Optional[int] = None
    explanation: str


class ParsedRequest(BaseModel):
    """Structured-output contract for the Muse Spark parsing call."""

    summary: str
    operations: list[Operation]
