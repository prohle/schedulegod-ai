"""Co-pilot orchestration: parse -> validate -> solve -> Muse-diagnosed self-heal.

When the solver reports infeasibility, CP-SAT has already named the minimal
conflicting subset (assumption literals). The self-healing loop works in two
layers:

1. Muse Spark translates the proof into a plain-English diagnosis and ranks
   resolutions (each drops exactly one conflicting request).
2. CP-SAT verifies every proposed resolution by re-solving. Only verified
   options are shown; the least-disruptive one is auto-applied.

The LLM never decides feasibility; the solver never talks to humans.
"""

from __future__ import annotations

from app.agent.diagnosis import DiagnosisParser
from app.models.results import AgentStep, CopilotResponse, ResolutionOption, SolveResult
from app.models.scenario import Operation, Scenario
from app.parsing.parser import ConstraintParser, validate_operations
from app.services.audit import record_event, record_submission
from app.solver.scheduling_model import solve

MAX_HEALING_ROUNDS = 5


def run_copilot(
    scenario: Scenario,
    message: str,
    parser: ConstraintParser | None = None,
    diagnoser: DiagnosisParser | None = None,
    speaker_id: str | None = None,
) -> CopilotResponse:
    parser = parser or ConstraintParser()
    diagnoser = diagnoser or DiagnosisParser()
    parsed = parser.parse(message, scenario, speaker_id)
    record_submission(message, parsed.summary, parser.mode)  # type: ignore[arg-type]

    trace: list[AgentStep] = []
    actor = f"Muse Spark · {parser.model}" if parser.mode == "muse-spark" else "Deterministic mock parser"
    latency = f" in {parser.last_latency_ms} ms" if parser.last_latency_ms else ""
    trace.append(AgentStep(
        step="parse", actor=actor,
        detail=f"Parsed the message into {len(parsed.operations)} typed operation(s){latency}: {parsed.summary}"))

    ops, notes = validate_operations(parsed.operations, scenario)
    trace.append(AgentStep(
        step="validate", actor="Validator",
        detail=f"{len(ops)} operation(s) passed schema + scenario validation"
               + (f"; {len(notes)} note(s): {'; '.join(notes)}" if notes else "")))
    healing_notes = list(notes)

    remaining: list[Operation] = list(ops)
    dropped: list[Operation] = []
    options: list[ResolutionOption] = []
    diagnosis: str | None = None
    diagnosis_mode: str | None = None
    result: SolveResult | None = None

    for round_no in range(MAX_HEALING_ROUNDS):
        result = solve(scenario, remaining)
        trace.append(AgentStep(
            step="solve", actor="CP-SAT",
            detail=f"Solve attempt {round_no + 1} with {len(remaining)} operation(s): "
                   f"{result.status} in {result.solve_time_ms} ms",
            status="ok" if result.status != "infeasible" else "blocked"))
        if result.status != "infeasible":
            break

        conflict = result.conflicts
        if not conflict or not conflict.conflicting_operation_indices:
            trace.append(AgentStep(
                step="conflict-core", actor="CP-SAT", status="blocked",
                detail="Infeasible against the base scenario — no request operation is in the conflict core."))
            break  # base scenario infeasible — dropping requests won't help

        core = conflict.conflicting_operation_indices
        trace.append(AgentStep(
            step="conflict-core", actor="CP-SAT", status="blocked",
            detail=f"Minimal conflicting subset: operation(s) {core} — {conflict.explanation}"))

        # --- layer 1: Muse diagnoses; layer 2: CP-SAT verifies each option ---
        if diagnosis is None:
            diag, dmode = diagnoser.diagnose(scenario, message, remaining, conflict)
            diagnosis = diag.diagnosis
            diagnosis_mode = dmode
            dactor = f"Muse Spark · {diagnoser.model}" if dmode == "muse-spark" else "Template diagnosis (fallback)"
            trace.append(AgentStep(
                step="diagnose", actor=dactor,
                detail=f"Translated the solver proof into plain English with "
                       f"{len(diag.resolutions)} ranked resolution(s): {diag.diagnosis}"))
            for res in diag.resolutions:
                if res.drop_operation_index >= len(remaining):
                    continue
                victim = remaining[res.drop_operation_index]
                candidate_ops = [o for i, o in enumerate(remaining)
                                 if i != res.drop_operation_index]
                verified = solve(scenario, candidate_ops)
                if verified.status != "infeasible":
                    options.append(ResolutionOption(
                        dropped_operation_index=res.drop_operation_index,
                        dropped_explanation=victim.explanation,
                        tradeoff=res.tradeoff,
                        result=verified,
                    ))
            trace.append(AgentStep(
                step="verify", actor="CP-SAT",
                detail=f"Re-solved every proposed resolution: {len(options)} of "
                       f"{len(diag.resolutions)} proven feasible — only verified options are shown."))
            if options:
                best = options[0]  # Muse's least-disruptive, now solver-verified
                victim = remaining[best.dropped_operation_index]
                dropped.append(victim)
                trace.append(AgentStep(
                    step="apply", actor="Agent (auto-apply)",
                    detail=f"Applied the least-disruptive verified resolution: dropped "
                           f"'{victim.explanation}' ({best.tradeoff})"))
                healing_notes.append(
                    f"Self-healing: applied the least-disruptive verified resolution — "
                    f"dropped '{victim.explanation}' ({best.tradeoff})"
                )
                remaining = [o for i, o in enumerate(remaining)
                             if i != best.dropped_operation_index]
                record_event("drop", f"Self-healed: dropped '{victim.explanation}' — {best.tradeoff}",
                             {"op": victim.op, "explanation": victim.explanation})
                result = best.result
                break

        # --- fallback: drop the most recently stated conflicting request ---
        drop_idx = max(core)
        victim = remaining.pop(drop_idx)
        dropped.append(victim)
        trace.append(AgentStep(
            step="apply", actor="Agent (fallback)", status="info",
            detail=f"No verified Muse resolution; dropped the most recently stated "
                   f"conflicting request: '{victim.explanation}'"))
        record_event("drop", f"Dropped '{victim.explanation}' — conflicts with the other request(s).",
                     {"op": victim.op, "explanation": victim.explanation})
        healing_notes.append(
            f"Self-healing: dropped '{victim.explanation}' — it conflicts with the other "
            f"request(s). {conflict.suggestion}"
        )

    trace.append(AgentStep(
        step="audit", actor="Audit trail",
        detail=f"Recorded the submission and {len(dropped)} dropped operation(s); "
               f"{len(remaining)} operation(s) stand applied to the term."))
    return CopilotResponse(
        summary=parsed.summary,
        operations=parsed.operations,
        applied_operations=remaining,
        dropped_operations=dropped,
        healing_notes=healing_notes,
        diagnosis=diagnosis,
        diagnosis_mode=diagnosis_mode,
        options=options,
        result=result,
        parser_mode=parser.mode,  # type: ignore[arg-type]
        model=parser.model,
        parser_latency_ms=parser.last_latency_ms,
        agent_trace=trace,
    )
