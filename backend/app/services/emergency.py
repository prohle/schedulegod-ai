"""Emergency resource changes: impact analysis + verified coverage proposals.

Flow: parse the emergency ("Dr. Chen is out all week") -> solve the base
timetable -> identify affected sections -> `propose_candidates` (CP-SAT
probe per candidate: qualified ∩ load headroom ∩ zero-ripple feasibility)
-> auto-pick the best candidate per section -> re-solve -> report.

The proposals are the demo centerpiece: the LLM explains, the solver
verifies. No name is suggested that CP-SAT hasn't proven can cover.
"""

from __future__ import annotations

from app.models.results import EmergencyResponse, SolveResult
from app.models.scenario import Operation, Scenario
from app.parsing.parser import ConstraintParser, validate_operations
from app.solver.scheduling_model import propose_candidates, solve


def run_emergency(
    scenario: Scenario,
    message: str,
    parser: ConstraintParser | None = None,
) -> EmergencyResponse:
    parser = parser or ConstraintParser()
    parsed = parser.parse(message, scenario)
    ops, notes = validate_operations(parsed.operations, scenario)

    removed = next((o for o in ops if o.op == "remove_instructor" and o.instructor_id), None)
    if removed is None:
        # "Out all week" often parses as full-week unavailability —
        # semantically identical to a removal for scheduling purposes.
        removed = next((o for o in ops
                        if o.op == "add_instructor_unavailability"
                        and o.instructor_id
                        and o.day is None and o.period is None), None)
    if removed is None or not removed.instructor_id:
        return EmergencyResponse(
            removed_instructor_id="", removed_instructor_name="",
            affected_section_ids=[], proposals=[], chosen={}, healing_notes=
            ["No instructor removal found in the message."] + notes,
            result=None, parser_mode=parser.mode,  # type: ignore[arg-type]
        )

    removed_id = removed.instructor_id
    base = solve(scenario)
    if base.status == "infeasible" or base.timetable is None:
        return EmergencyResponse(
            removed_instructor_id=removed_id,
            removed_instructor_name=scenario.instructor(removed_id).name,
            affected_section_ids=[], proposals=[], chosen={},
            healing_notes=["Base timetable is already infeasible."] + notes,
            result=base, parser_mode=parser.mode,  # type: ignore[arg-type]
        )

    affected_ids = [p.section_id for p in base.timetable.placements
                    if p.instructor_id == removed_id]
    healing_notes = list(notes)
    healing_notes.append(
        f"Base timetable built ({base.status}, {base.solve_time_ms} ms) — "
        f"{len(affected_ids)} section(s) assigned to {scenario.instructor(removed_id).name}."
    )

    if not affected_ids:
        return EmergencyResponse(
            removed_instructor_id=removed_id,
            removed_instructor_name=scenario.instructor(removed_id).name,
            affected_section_ids=[], proposals=[], chosen={},
            healing_notes=healing_notes + ["That instructor had no sections to lose."],
            result=base, parser_mode=parser.mode,  # type: ignore[arg-type]
        )

    proposals = propose_candidates(scenario, base, removed_id)

    # Auto-pick: best feasible candidate per affected section, tracking load.
    loads = dict(base.timetable.sections_per_instructor)
    chosen: dict[str, str] = {}
    for sid in affected_ids:
        best = next(
            (p for p in proposals
             if p.section_id == sid and p.feasible
             and loads.get(p.instructor_id, 0) + 1 <= scenario.instructor(p.instructor_id).max_sections),
            None,
        )
        if best is not None:
            chosen[sid] = best.instructor_id
            loads[best.instructor_id] = loads.get(best.instructor_id, 0) + 1
            healing_notes.append(
                f"{best.instructor_name} covers {best.course_code}: {best.reason}."
            )
        else:
            healing_notes.append(f"No verified candidate found for section {sid}; leaving it to re-solve freely.")

    result: SolveResult | None = None
    if chosen:
        result = solve(scenario, instructor_pins=chosen)
        if result.status == "infeasible":
            healing_notes.append("Pinned choices conflicted; re-solving freely instead.")
            result = solve(scenario)
    else:
        result = solve(scenario)

    return EmergencyResponse(
        removed_instructor_id=removed_id,
        removed_instructor_name=scenario.instructor(removed_id).name,
        affected_section_ids=affected_ids,
        proposals=proposals,
        chosen=chosen,
        healing_notes=healing_notes,
        result=result,
        parser_mode=parser.mode,  # type: ignore[arg-type]
    )
