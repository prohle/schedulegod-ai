"""Repo-root smoke test: the standardized interface every engine honors.

The full suite lives in backend/tests; this root-level test is
the fast signal that the repo is healthy — it loads the seed and proves a
home-solver timetable satisfies the core hard constraints.
"""

from app.main import load_seed_scenario
from app.solver.scheduling_model import solve


def test_seed_solves_with_either_engine():
    sc = load_seed_scenario()
    for engine in ("cpsat", "ours"):
        result = solve(sc, engine=engine)
        assert result.status == "optimal"
        assert result.timetable is not None
        assert len(result.timetable.placements) == len(sc.sections)
