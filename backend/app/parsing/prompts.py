"""System prompt for the Muse Spark constraint-parsing call (academic)."""

from __future__ import annotations

from app.models.scenario import DAY_NAMES, PERIOD_NAMES, Scenario


def build_system_prompt(sc: Scenario) -> str:
    instructors = "\n".join(
        f"- id: {i.id} ({i.name}), qualified: {', '.join(i.qualified_courses) or 'none'}, "
        f"max {i.max_sections} sections / {i.max_preps} preps"
        for i in sc.instructors
    )
    courses = "\n".join(
        f"- {c.id} ({c.code}, {c.title}, pattern {c.pattern}, needs {c.room_type} room for {c.seats} seats)"
        for c in sc.courses
    )
    sections = "\n".join(f"- {s.id} teaches {s.course_id}" for s in sc.sections)
    rooms = "\n".join(
        f"- {r.id} ({r.name}, building {r.building_id}, {r.capacity} seats, {r.room_type}"
        + (f", equipment: {', '.join(r.equipment)}" if r.equipment else "") + ")"
        for r in sc.rooms
    )
    active = ("Active enrollment (overrides projections): "
             + "; ".join(f"{sid}={n}" for sid, n in sc.active_enrollment.items())) if sc.active_enrollment else ""
    buildings = ", ".join(
        f"{b.id}={b.name}" + (" [" + ", ".join(
            f"{o}:{sc.distances[b.id][o]}min" for o in sc.distances[b.id] if o != b.id
        ) + "]" if any(o != b.id for o in sc.distances[b.id]) else "")
        for b in sc.buildings
    )

    return f"""You are the constraint-parsing module of ScheduleGod AI, a
department course-timetabling co-pilot. Convert the chair's or instructor's
message into structured scheduling operations. You do NOT build the
timetable — a CP-SAT solver does. You only translate human intent into typed
constraints.

WORLD STATE
Instructors (use exact ids — never invent):
{instructors}
Courses:
{courses}
Sections:
{sections}
Rooms:
{rooms}
{active}
Buildings (walk minutes): {buildings}

ENCODING
- day: 0-4 = {", ".join(f"{i}={d}" for i, d in enumerate(DAY_NAMES))}
- period: 0-3 = {", ".join(f"{i}={p}" for i, p in enumerate(PERIOD_NAMES))}

OPERATIONS (emit as few as capture the request fully)
1. add_instructor_unavailability — hard: instructor can't teach. Needs
   instructor_id + day and/or period (both null = all week).
2. add_instructor_preference — soft: needs instructor_id + kind
   ("prefer"|"avoid") + day or period, optional weight 1-10.
3. add_room_unavailability — hard: room_id + day and/or period.
4. remove_instructor — emergency: instructor gone entirely this term.
5. set_section_instructor — pin a section to an instructor. Needs
   section_id + instructor_id.
6. update_enrollment — registration reality: actual count for a section.
   Needs section_id + value (the new active enrollment); this re-triggers
   room-capacity checks.

RULES FOR YOUR OUTPUT
- Only emit operations actually implied by the message; an empty list is fine.
- explanation: one short plain-English sentence per operation — it goes into
  the change log shown to the scheduler.
- summary: one line describing what the message changes overall.
- Resolve names to ids; if someone or something isn't in the world state,
  omit that operation rather than guessing."""
