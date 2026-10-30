"""Plug-and-play solver engines behind one standardized interface.

Every engine implements the same contract:

    solve(scenario, request_ops, pins_exact, instructor_pins,
          slot_hints, objective) -> SolveResult

Registering a new engine is one entry in `ENGINES` plus a solve function —
the API (`POST /solve` with `engine`, `GET /engines`), the benchmark, and
the Build-step engine picker all discover it from here. That standardized
interface is what makes the head-to-head comparison a level playing field:
identical scenario, identical ops, identical objective, identical output
shape — only the search differs.

  cpsat   OR-Tools CP-SAT (Google): industrial C++ constraint solver,
          clause learning, proves optimality in fractions of a second.
  ours    ScheduleGod home solver: AI-crafted pure-Python search
          (MRV + forward checking + branch-and-bound + ejection
          hill-climbing), designed around this problem's trade-offs.
  greedy  The home solver's first descent only — a milliseconds-fast
          "good enough" layout that shows what the optimization phases buy.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Optional

from app.models.results import SolveResult
from app.models.scenario import Operation, Scenario


@dataclass(frozen=True)
class EngineInfo:
    id: str
    label: str
    kind: str
    description: str


ENGINES: list[EngineInfo] = [
    EngineInfo(
        id="cpsat", label="OR-Tools CP-SAT", kind="industrial",
        description="Google's C++ constraint solver — clause learning, "
                    "assumption-literal conflict cores, proven optima in milliseconds."),
    EngineInfo(
        id="ours", label="ScheduleGod solver (ours)", kind="ai-crafted",
        description="From-scratch pure-Python solver built for this problem: MRV + "
                    "forward checking, branch-and-bound, ejection hill-climbing, "
                    "deletion-minimized conflict cores."),
    EngineInfo(
        id="greedy", label="Greedy descent (ours, fast)", kind="ai-crafted",
        description="The home solver's first greedy descent only — no optimization "
                    "phases. Milliseconds-fast, visibly worse preferences."),
]

ENGINE_IDS = [e.id for e in ENGINES]


def list_engines() -> list[dict]:
    return [asdict(e) for e in ENGINES]


def solve_with(engine: str, sc: Scenario,
               request_ops: Optional[list[Operation]] = None,
               pins_exact: Optional[dict] = None,
               instructor_pins: Optional[dict[str, str]] = None,
               slot_hints: Optional[dict[str, int]] = None,
               objective: str = "preference") -> SolveResult:
    """Dispatch to a registered engine. Raises KeyError for unknown ids."""
    if engine == "cpsat":
        from app.solver.scheduling_model import solve as cpsat_solve
        return cpsat_solve(sc, request_ops, pins_exact=pins_exact,
                           instructor_pins=instructor_pins, slot_hints=slot_hints,
                           objective=objective, engine="cpsat")
    if engine in ("ours", "greedy"):
        from app.solver.home_solver import solve_home
        return solve_home(sc, request_ops, pins_exact=pins_exact,
                          instructor_pins=instructor_pins, slot_hints=slot_hints,
                          objective=objective, quick=(engine == "greedy"))
    raise KeyError(f"unknown solver engine: {engine!r} (available: {ENGINE_IDS})")
