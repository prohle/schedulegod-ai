"""Deterministic offline parser — the mock fallback when no MODEL_API_KEY is set.

Not a model: a rule-based stand-in so the full pipeline (parse -> validate ->
solve -> self-heal -> propose) runs end-to-end without spending credits. The
real Muse Spark path lives in parser.py. Clearly labeled in every summary.
"""

from __future__ import annotations

import re

from app.models.scenario import DAY_NAMES, Operation, ParsedRequest, Scenario

_DAY = {
    "monday": 0, "mondays": 0, "mon": 0, "mons": 0,
    "tuesday": 1, "tuesdays": 1, "tues": 1, "tue": 1, "tues": 1,
    "wednesday": 2, "wednesdays": 2, "weds": 2, "wed": 2,
    "thursday": 3, "thursdays": 3, "thurs": 3, "thur": 3, "thu": 3,
    "friday": 4, "fridays": 4, "fri": 4,
}
_PERIOD = {
    "8:00": 0, "8am": 0, "8 am": 0, "morning": 0, "mornings": 0,
    "10:00": 1, "10am": 1,
    "1:00": 2, "13:00": 2, "afternoon": 2, "afternoons": 2, "1pm": 2,
    "3:00": 3, "15:00": 3, "3pm": 3,
}

_DAY_RE = r"(?:monday|mon|tuesday|tues|tue|wednesday|weds|wed|thursday|thurs|thu|friday|fri)s?"


def _mentioned_instructors(message: str, scenario: Scenario):
    lower = message.lower()
    return [i for i in scenario.instructors
            if re.search(rf"\b{re.escape(i.id)}\b", lower)
            or re.search(rf"\b{re.escape(i.name.lower().replace('dr. ', '').replace('prof. ', ''))}\b", lower)]


def _mentioned_courses(message: str, scenario: Scenario):
    lower = re.sub(r"\s+", "", message.lower())  # "cs 101" -> "cs101"
    hits = []
    for c in scenario.courses:
        if c.id in lower or c.code.lower().replace(" ", "") in lower:
            hits.append(c)
    return hits


def _first_day(message: str):
    m = re.search(rf"\b({_DAY_RE})\b", message.lower())
    return _DAY[m.group(1)] if m else None


def _first_period(message: str):
    lower = message.lower()
    for token, p in _PERIOD.items():
        if re.search(rf"\b{re.escape(token)}\b", lower):
            return p
    return None


def mock_parse(message: str, scenario: Scenario) -> ParsedRequest:
    lower = message.lower()
    instructors = _mentioned_instructors(message, scenario)
    courses = _mentioned_courses(message, scenario)
    ops: list[Operation] = []
    parts: list[str] = []

    if not instructors and not courses:
        return ParsedRequest(summary="(mock parser) No recognizable instructors or courses in this message.",
                             operations=[])

    inst = instructors[0] if instructors else None

    # Emergency: "Dr. Chen is out all week"
    if inst and re.search(r"\b(?:out|away|gone|on leave)\b", lower):
        ops.append(Operation(op="remove_instructor", instructor_id=inst.id,
                             explanation=f"{inst.name} is out entirely this term."))
        parts.append(f"remove {inst.name}")

    # "taking over CS101, MATH201 and CS201 personally"
    elif inst and courses and re.search(r"\b(?:taking over|covering|will teach|must teach)\b", lower):
        for c in courses:
            section = next((s for s in scenario.sections if s.course_id == c.id), None)
            if section:
                ops.append(Operation(op="set_section_instructor", section_id=section.id,
                                     instructor_id=inst.id,
                                     explanation=f"{inst.name} personally takes over {c.code}."))
                parts.append(f"pin {c.code} to {inst.name}")

    # hard unavailability: "can't teach Tuesdays"
    elif inst and re.search(r"\b(?:can'?t|cannot)\b", lower):
        day = _first_day(lower)
        if day is not None:
            ops.append(Operation(op="add_instructor_unavailability", instructor_id=inst.id,
                                  day=day,
                                  explanation=f"{inst.name} can't teach on {DAY_NAMES[day]}s."))
            parts.append(f"{inst.name} unavailable {DAY_NAMES[day]}")

    # soft preference: "would rather not teach at 8:00"
    if inst and re.search(r"\b(?:rather not|prefers?|likes?|avoid)\b", lower):
        period = _first_period(lower)
        if period is not None:
            kind = "avoid" if re.search(r"\b(?:rather not|avoid|hates?)\b", lower) else "prefer"
            ops.append(Operation(op="add_instructor_preference", instructor_id=inst.id,
                                 kind=kind, period=period, weight=6,
                                 explanation=f"{inst.name} {kind}s the {period} period."))
            parts.append(f"{inst.name} {kind}s period {period}")

    # room closures: "the Science Hall is closed"
    if re.search(r"\bclos(?:ed|e|ing)\b", lower):
        for r in scenario.rooms:
            name = r.name.lower()
            if name in lower or r.building_id.lower() in lower:
                ops.append(Operation(op="add_room_unavailability", room_id=r.id,
                                     explanation=f"{r.name} closed all week."))
                parts.append(f"close {r.name}")

    if not ops:
        return ParsedRequest(summary="(mock parser) Message recognized but no operations extracted.",
                             operations=[])

    return ParsedRequest(summary="Mock parse: " + "; ".join(parts) + ".", operations=ops)
