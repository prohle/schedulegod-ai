#!/usr/bin/env python3
"""Department-scale benchmark: real numbers, measured, not marketing.

Solves the story seed and the department scenario with the production
solver (single worker, deterministic) and prints a markdown table the
README quotes verbatim. Run from `backend/`:

    .venv/bin/python scripts/benchmark.py
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.data.department import build_department_scenario, build_university_scenario
from app.intelligence.matrices import compute_margins, compute_utilization
from app.main import load_seed_scenario
from app.services.emergency import run_emergency
from app.solver.scheduling_model import solve


def bench(name: str, sc) -> dict:
    t0 = time.perf_counter()
    result = solve(sc)
    wall_ms = int((time.perf_counter() - t0) * 1000)
    ours = solve(sc, engine="ours")
    margins = compute_margins(sc, result.timetable, 4)
    util = compute_utilization(sc, result.timetable)
    emergency = run_emergency(sc, "Dr. Chen is out all week — who could cover her sections?")
    return {
        "name": name,
        "instructors": len(sc.instructors),
        "sections": len(sc.sections),
        "rooms": len(sc.rooms),
        "cohorts": len(sc.cohorts),
        "programs": len(sc.programs),
        "status": result.status,
        "solve_ms": result.solve_time_ms,
        "wall_ms": wall_ms,
        "objective": result.objective,
        "ours_status": ours.status,
        "ours_ms": ours.solve_time_ms,
        "ours_objective": ours.objective,
        "c39": f"{sum(c.ok for c in margins.cohorts)}/{len(margins.cohorts)} cohorts >= 4 courses",
        "room_util": util.room_utilization,
        "emergency": (f"{len(emergency.affected_section_ids)} affected, "
                      f"{sum(p.feasible for p in emergency.proposals)}/{len(emergency.proposals)} probes feasible, "
                      f"re-solve {emergency.result.status}"),
    }


def main() -> None:
    seed = load_seed_scenario()
    rows = [bench("Story seed (demo)", seed),
            bench("Department scale", build_department_scenario(seed)),
            bench("University scale", build_university_scenario(seed))]
    print("| Scenario | Instructors | Sections | Rooms | Cohorts | Programs | CP-SAT | Ours (home solver) | C39 guarantee | Room util. | Emergency (Chen out) |")
    print("|---|---:|---:|---:|---:|---:|---|---|---|---:|---|")
    for r in rows:
        print(f"| {r['name']} | {r['instructors']} | {r['sections']} | {r['rooms']} | "
              f"{r['cohorts']} | {r['programs']} | {r['status']} {r['solve_ms']} ms · penalty {r['objective']} | "
              f"{r['ours_status']} {r['ours_ms']} ms · penalty {r['ours_objective']} | "
              f"{r['c39']} | {r['room_util']:.0%} | {r['emergency']} |")


if __name__ == "__main__":
    main()
