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
from app.models.results import CopilotResponse, ResolutionOption, SolveResult
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
) -> CopilotResponse:
    parser = parser or ConstraintParser()
    diagnoser = diagnoser or DiagnosisParser()
    parsed = parser.parse(message, scenario)
    record_submission(message, parsed.summary, parser.mode)  # type: ignore[arg-type]

    ops, notes = validate_operations(parsed.operations, scenario)
    healing_notes = list(notes)

    remaining: list[Operation] = list(ops)
    dropped: list[Operation] = []
    options: list[ResolutionOption] = []
    diagnosis: str | None = None
    diagnosis_mode: str | None = None
    result: SolveResult | None = None

    for _ in range(MAX_HEALING_ROUNDS):
        result = solve(scenario, remaining)
        if result.status != "infeasible":
            break

        conflict = result.conflicts
        if not conflict or not conflict.conflicting_operation_indices:
            break  # base scenario infeasible — dropping requests won't help

        core = conflict.conflicting_operation_indices

        # --- layer 1: Muse diagnoses; layer 2: CP-SAT verifies each option ---
        if diagnosis is None:
            diag, dmode = diagnoser.diagnose(scenario, message, remaining, conflict)
            diagnosis = diag.diagnosis
            diagnosis_mode = dmode
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
            if options:
                best = options[0]  # Muse's least-disruptive, now solver-verified
                victim = remaining[best.dropped_operation_index]
                dropped.append(victim)
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
        record_event("drop", f"Dropped '{victim.explanation}' — conflicts with the other request(s).",
                     {"op": victim.op, "explanation": victim.explanation})
        healing_notes.append(
            f"Self-healing: dropped '{victim.explanation}' — it conflicts with the other "
            f"request(s). {conflict.suggestion}"
        )

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
    )
