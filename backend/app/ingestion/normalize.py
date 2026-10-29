"""Deterministic normalizer: Muse-extracted entities -> solver Scenario.

Muse autocleans; this assembles. All ids are slugified deterministically so the
resulting scenario solves identically every run (no hallucinated ids reach the
solver). Missing pieces get sensible defaults so a partial extraction still
schedules.
"""

from __future__ import annotations

import re

from app.models.ingestion import InstitutionData
from app.models.scenario import (
    Building,
    Cohort,
    Course,
    Instructor,
    Program,
    RoadmapRequirement,
    Room,
    Scenario,
    Section,
)

DEFAULT_WALK_MIN = 5  # between distinct buildings when no campus map is given


def slug(s: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s or "x"


def _pattern(p: str) -> str:
    u = p.strip().upper()
    return "block" if u == "BLOCK" else ("TTh" if u == "TTH" else "MWF")


def _room_type(t: str) -> str:
    t = t.strip().lower()
    return t if t in ("lecture", "lab", "seminar") else "lecture"


def build_scenario(data: InstitutionData) -> Scenario:
    # --- buildings ----------------------------------------------------------
    names: list[str] = list(dict.fromkeys(data.buildings))
    for r in data.rooms:
        if r.building and r.building not in names:
            names.append(r.building)
    if not names:
        names = ["Main Campus"]
    buildings = [Building(id=slug(b), name=b) for b in names]

    # --- courses + sections -------------------------------------------------
    courses: list[Course] = []
    sections: list[Section] = []
    code_to_id: dict[str, str] = {}
    for c in data.courses:
        cid = slug(c.code) or f"course-{len(courses)}"
        code_to_id[c.code.strip()] = cid
        code_to_id[slug(c.code)] = cid
        courses.append(Course(
            id=cid, code=c.code.strip(), title=c.title or c.code,
            pattern=_pattern(c.pattern), room_type=_room_type(c.room_type), seats=c.seats,
            equipment=c.equipment,
        ))
        sections.append(Section(id=f"sec-{cid}", course_id=cid))

    # --- instructors --------------------------------------------------------
    def resolve_code(code: str) -> str:
        return code_to_id.get(code.strip()) or code_to_id.get(slug(code), "")

    instructors: list[Instructor] = []
    for inst in data.instructors:
        iid = slug(inst.name) or f"instructor-{len(instructors)}"
        qualified = [c for c in (resolve_code(q) for q in inst.qualified_courses) if c]
        instructors.append(Instructor(
            id=iid, name=inst.name, qualified_courses=qualified,
            max_sections=inst.max_sections, max_preps=inst.max_preps,
            hard_unavailable=[], preferences=[],
        ))

    # --- rooms --------------------------------------------------------------
    rooms: list[Room] = []
    for r in data.rooms:
        b = slug(r.building) if r.building else buildings[0].id
        rooms.append(Room(
            id=slug(r.name), name=r.name, building_id=b, capacity=r.capacity,
            room_type=_room_type(r.room_type), equipment=r.equipment,
        ))

    # --- programs / degree maps ----------------------------------------------
    program_names = list(dict.fromkeys(
        [c.program for c in data.cohorts if c.program] +
        [req.program for req in data.degree_map if req.program]
    )) or ["default"]
    programs: list[Program] = []
    for pname in program_names:
        roadmap: dict[str, list[RoadmapRequirement]] = {}
        for req in data.degree_map:
            if req.program and req.program != pname:
                continue
            cid = resolve_code(req.course)
            if not cid:
                continue
            roadmap.setdefault(str(req.term), []).append(
                RoadmapRequirement(course_id=cid, required=req.required))
        programs.append(Program(id=slug(pname), name=pname, roadmap=roadmap))

    # --- cohorts ------------------------------------------------------------
    cohorts: list[Cohort] = []
    for c in data.cohorts:
        prog = slug(c.program) if c.program else programs[0].id
        cohorts.append(Cohort(
            id=slug(c.name) or f"cohort-{len(cohorts)}", program_id=prog,
            name=c.name or f"Cohort {len(cohorts) + 1}",
            admission_year=c.admission_year, graduation_year=c.graduation_year,
            current_term=c.current_term, size=c.size,
        ))

    # --- distances (default walk matrix; campus-map hints can refine later) ---
    distances: dict[str, dict[str, int]] = {}
    for b1 in buildings:
        row: dict[str, int] = {}
        for b2 in buildings:
            row[b2.id] = 0 if b1.id == b2.id else DEFAULT_WALK_MIN
        distances[b1.id] = row

    return Scenario(
        name="Ingested scenario", buildings=buildings, rooms=rooms,
        instructors=instructors, courses=courses, sections=sections,
        programs=programs, cohorts=cohorts, distances=distances,
        room_blackouts=[], walk_limit_min=10, active_enrollment={},
    )