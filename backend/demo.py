"""Offline end-to-end demo: the full co-pilot loop with the mock parser.

Run:  python demo.py   (no API key required)

Shows:
  1. A messy human request that parses cleanly and re-solves to optimality.
  2. An over-constrained request where the solver names the conflicting
     requests and the agent self-heals by dropping the latest one.
"""

from __future__ import annotations

from app.main import load_seed_scenario
from app.models.results import CopilotResponse
from app.services.copilot import run_copilot

MSG_FEASIBLE = (
    "Maria can't do Tuesday night — she has a family thing. "
    "Also, can we make sure everyone gets at least 10 hours between shifts?"
)

MSG_INFEASIBLE = "John wants Monday night and Tuesday day back to back."

DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def print_response(message: str, resp: CopilotResponse) -> None:
    print("=" * 74)
    print(f'NURSE:  "{message}"')
    print(f"PARSER ({resp.parser_mode}): {resp.summary}")
    for op in resp.operations:
        detail = f"{op.op}"
        if op.worker_id:
            detail += f" {op.worker_id}"
        if op.day is not None:
            detail += f" day={op.day}"
        if op.shift_type:
            detail += f" {op.shift_type}"
        print(f"  - [{detail}] {op.explanation}")
    for note in resp.healing_notes:
        print(f"  ! {note}")

    assert resp.result is not None
    r = resp.result
    if r.status == "infeasible":
        print(f"SOLVER: INFEASIBLE ({r.solve_time_ms} ms)")
        assert r.conflicts is not None
        print(f"  conflict core: {r.conflicts.conflicting_operation_indices}")
        print(f"  {r.conflicts.explanation}")
        return

    print(f"SOLVER: {r.status.upper()} in {r.solve_time_ms} ms (objective={r.objective})")
    assert r.schedule is not None

    days = sorted({a.day for a in r.schedule.assignments})
    name_of = {}
    for a in r.schedule.assignments:
        name_of[(a.day, a.shift_type)] = name_of.get((a.day, a.shift_type), []) + [a.worker_name]

    header = "        " + "".join(f"{DAY_ABBR[d]:<16}" for d in days)
    print(header)
    for s in ("day", "evening", "night"):
        row = f"{s:<8}"
        for d in days:
            names = ", ".join(sorted(name_of.get((d, s), ["—"])))
            row += f"{names:<16}"
        print(row)
    print("shifts/week:", ", ".join(f"{k}={v}" for k, v in sorted(r.schedule.shifts_per_worker.items())))


def main() -> None:
    scenario = load_seed_scenario()
    print("ScheduleGod AI — offline demo (mock parser; set MODEL_API_KEY for Muse Spark)")
    print(f"Scenario: {scenario.name} — {len(scenario.workers)} workers, "
          f"{len(scenario.days)} days x {len(scenario.shift_types)} shifts\n")
    print_response(MSG_FEASIBLE, run_copilot(scenario, MSG_FEASIBLE))
    print()
    print_response(MSG_INFEASIBLE, run_copilot(scenario, MSG_INFEASIBLE))


if __name__ == "__main__":
    main()
