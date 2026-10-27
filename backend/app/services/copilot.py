"""Co-pilot orchestration: parse -> validate -> solve -> self-heal.

The self-healing loop: when the solver reports infeasibility, CP-SAT has
already named the minimal conflicting subset of the request (see the
assumption literals in the solver). We drop the most recently stated
conflicting request, explain the drop in plain English, and re-solve —
bounded to a few iterations. The LLM never decides feasibility; it only
translates. The solver never talks to humans; the agent layer explains.
"""

from __future__ import annotations

from app.models.results import CopilotResponse, SolveResult
from app.models.scenario import Operation, Scenario
from app.parsing.parser import ConstraintParser, validate_operations
from app.solver.scheduling_model import solve

MAX_HEALING_ROUNDS = 5


def run_copilot(
    scenario: Scenario,
    message: str,
    parser: ConstraintParser | None = None,
) -> CopilotResponse:
    parser = parser or ConstraintParser()
    parsed = parser.parse(message, scenario)

    ops, notes = validate_operations(parsed.operations, scenario)
    healing_notes = list(notes)

    remaining: list[Operation] = list(ops)
    dropped: list[Operation] = []
    result: SolveResult | None = None

    for _ in range(MAX_HEALING_ROUNDS):
        result = solve(scenario, remaining)
        if result.status != "infeasible":
            break

        conflict = result.conflicts
        if not conflict or not conflict.conflicting_operation_indices:
            break  # base scenario infeasible — dropping requests won't help

        # Self-heal: drop the most recently stated conflicting request.
        drop_idx = max(conflict.conflicting_operation_indices)
        victim = remaining.pop(drop_idx)
        dropped.append(victim)
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
        result=result,
        parser_mode=parser.mode,  # type: ignore[arg-type]
    )
