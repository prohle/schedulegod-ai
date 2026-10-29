"""Emergency resource changes: impact analysis + verified coverage proposals.

Flow: parse the emergency ("Dr. Chen is out all week") -> solve the base
timetable -> identify affected sections -> `propose_candidates` (CP-SAT
probe per candidate: qualified ∩ load headroom ∩ zero-ripple feasibility)
-> auto-pick the best candidate per section -> re-solve -> report.

The proposals are the demo centerpiece: the LLM explains, the solver
verifies. No name is suggested that CP-SAT hasn't proven can cover.
"""

from __future__ import annotations

from app.models.results import AgentStep, EmergencyResponse, SolveResult
from app.models.scenario import Operation, Scenario
from app.parsing.parser import ConstraintParser, validate_operations
from app.services.audit import record_event, record_submission
from app.solver.scheduling_model import propose_candidates, solve


def run_emergency(
    scenario: Scenario,
    message: str,
    parser: ConstraintParser | None = None,
) -> EmergencyResponse:
    parser = parser or ConstraintParser()
    parsed = parser.parse(message, scenario)
    record_submission(message, parsed.summary, parser.mode)  # type: ignore[arg-type]
    ops, notes = validate_operations(parsed.operations, scenario)
    muse = {"model": parser.model, "parser_latency_ms": parser.last_latency_ms}
    trace: list[AgentStep] = []
    actor = f"Muse Spark · {parser.model}" if parser.mode == "muse-spark" else "Deterministic mock parser"
    latency = f" in {parser.last_latency_ms} ms" if parser.last_latency_ms else ""
    trace.append(AgentStep(
        step="parse", actor=actor,
        detail=f"Parsed the emergency into {len(parsed.operations)} typed operation(s){latency}: {parsed.summary}"))
    trace.append(AgentStep(
        step="validate", actor="Validator",
        detail=f"{len(ops)} operation(s) passed schema + scenario validation."))

    removed = next((o for o in ops if o.op == "remove_instructor" and o.instructor_id), None)
    if removed is None:
        # "Out all week" often parses as full-week unavailability —
        # semantically identical to a removal for scheduling purposes.
        removed = next((o for o in ops
                        if o.op == "add_instructor_unavailability"
                        and o.instructor_id
                        and o.day is None and o.period is None), None)
    if removed is None or not removed.instructor_id:
        trace.append(AgentStep(
            step="impact", actor="Agent", status="blocked",
            detail="No instructor removal found in the message — nothing to re-home."))
        return EmergencyResponse(
            removed_instructor_id="", removed_instructor_name="",
            affected_section_ids=[], proposals=[], chosen={}, healing_notes=
            ["No instructor removal found in the message."] + notes,
            result=None, parser_mode=parser.mode, agent_trace=trace, **muse,  # type: ignore[arg-type]
        )

    removed_id = removed.instructor_id
    base = solve(scenario)
    trace.append(AgentStep(
        step="solve", actor="CP-SAT",
        detail=f"Base timetable: {base.status} in {base.solve_time_ms} ms.",
        status="ok" if base.status != "infeasible" else "blocked"))
    if base.status == "infeasible" or base.timetable is None:
        return EmergencyResponse(
            removed_instructor_id=removed_id,
            removed_instructor_name=scenario.instructor(removed_id).name,
            affected_section_ids=[], proposals=[], chosen={},
            healing_notes=["Base timetable is already infeasible."] + notes,
            result=base, parser_mode=parser.mode, agent_trace=trace, **muse,  # type: ignore[arg-type]
        )

    affected_ids = [p.section_id for p in base.timetable.placements
                    if p.instructor_id == removed_id]
    record_event("emergency",
                 f"{scenario.instructor(removed_id).name} out — {len(affected_ids)} section(s) affected",
                 {"instructor_id": removed_id, "sections": affected_ids})
    healing_notes = list(notes)
    healing_notes.append(
        f"Base timetable built ({base.status}, {base.solve_time_ms} ms) — "
        f"{len(affected_ids)} section(s) assigned to {scenario.instructor(removed_id).name}."
    )

    trace.append(AgentStep(
        step="impact", actor="Agent",
        detail=f"Impact analysis: {len(affected_ids)} section(s) were assigned to "
               f"{scenario.instructor(removed_id).name}: {', '.join(affected_ids) or 'none'}."))

    if not affected_ids:
        return EmergencyResponse(
            removed_instructor_id=removed_id,
            removed_instructor_name=scenario.instructor(removed_id).name,
            affected_section_ids=[], proposals=[], chosen={},
            healing_notes=healing_notes + ["That instructor had no sections to lose."],
            result=base, parser_mode=parser.mode, agent_trace=trace, **muse,  # type: ignore[arg-type]
        )

    proposals = propose_candidates(scenario, base, removed_id)
    n_feasible = sum(1 for p in proposals if p.feasible)
    trace.append(AgentStep(
        step="probe", actor="CP-SAT",
        detail=f"Probed every qualified instructor per affected section: "
               f"{len(proposals)} candidate probe(s), {n_feasible} proven zero-ripple feasible."))

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

    # The absent instructor must be gone from the result, even for a section
    # with no verified candidate. Otherwise the "after" timetable quietly puts
    # them back on the board.
    remove_op = Operation(
        op="remove_instructor", instructor_id=removed_id,
        explanation=f"{scenario.instructor(removed_id).name} is out.")

    result: SolveResult | None = None
    if chosen:
        # Freeze every unaffected placement: the coverage swap must be
        # zero-ripple, not a global reshuffle. Only the affected sections may
        # move (and only if the candidate needs a different slot/room).
        pins_exact = {
            p.section_id: (p.instructor_id,
                           p.period if p.period is not None else p.days[0],
                           p.room_id)
            for p in base.timetable.placements
            if p.section_id not in affected_ids
        }
        result = solve(scenario, [remove_op],
                       instructor_pins=chosen, pins_exact=pins_exact)
        if result.status == "infeasible":
            healing_notes.append(
                "Zero-ripple coverage is not possible; re-solving the affected sections.")
            result = solve(scenario, [remove_op])
    else:
        result = solve(scenario, [remove_op])
    if result.status == "infeasible":
        healing_notes.append(
            "No verified coverage exists for every affected section — "
            "the request needs a structural change (new section, qualification, or load cap).")

    chosen_txt = ", ".join(
        f"{sid} -> {scenario.instructor(iid).name}" for sid, iid in chosen.items()) or "none"
    trace.append(AgentStep(
        step="choose", actor="Agent (auto-pick)",
        detail=f"Best verified candidate per section: {chosen_txt}."))
    trace.append(AgentStep(
        step="re-solve", actor="CP-SAT",
        detail=f"Re-solved with {scenario.instructor(removed_id).name} removed and coverage pinned: "
               f"{result.status} in {result.solve_time_ms} ms.",
        status="ok" if result.status != "infeasible" else "blocked"))
    trace.append(AgentStep(
        step="audit", actor="Audit trail",
        detail="Emergency event recorded; applying it commits the removal and coverage pins to the term."))

    return EmergencyResponse(
        removed_instructor_id=removed_id,
        removed_instructor_name=scenario.instructor(removed_id).name,
        affected_section_ids=affected_ids,
        proposals=proposals,
        chosen=chosen,
        healing_notes=healing_notes,
        result=result,
        parser_mode=parser.mode, agent_trace=trace, **muse,  # type: ignore[arg-type]
    )
