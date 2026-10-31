"""ScheduleSolve home solver vs CP-SAT: same contract, independently verified.

The home solver must (a) produce timetables that satisfy every hard
constraint — checked here from the placements alone, not by trusting the
search — (b) match CP-SAT's objective on the seed, (c) prove the same
infeasibility with the same minimal conflict core, and (d) be deterministic.
"""

from app.data.department import build_department_scenario
from app.main import load_seed_scenario
from app.models.scenario import Operation, PATTERN_DAYS
from app.solver.scheduling_model import solve


def _slots(p):
    return {(d, per) for d in p.days for per in p.periods}


def assert_hard_constraints_hold(sc, result):
    assert result.timetable is not None
    placements = result.timetable.placements
    assert len(placements) == len(sc.sections)
    by_section = {p.section_id: p for p in placements}

    for p in placements:
        inst = sc.instructor(p.instructor_id)
        course = sc.course(p.course_id)
        room = sc.room(p.room_id)
        assert p.course_id in inst.qualified_courses
        assert room.room_type == course.room_type
        assert room.capacity >= p.enrollment
        assert set(course.equipment) <= set(room.equipment)
        assert not any(s.day in p.days and s.period in p.periods
                       for s in inst.hard_unavailable)
    loads = {}
    for p in placements:
        loads[p.instructor_id] = loads.get(p.instructor_id, 0) + 1
    for iid, n in loads.items():
        assert n <= sc.instructor(iid).max_sections
    for i, a in enumerate(placements):
        for b in placements[i + 1:]:
            if a.instructor_id == b.instructor_id:
                assert not (_slots(a) & _slots(b)), (a, b)
            if a.room_id == b.room_id:
                assert not (_slots(a) & _slots(b)), (a, b)
    for sa, sb in sc.demanded_section_pairs():
        assert not (_slots(by_section[sa.id]) & _slots(by_section[sb.id])), (sa.id, sb.id)


def test_home_solver_matches_cpsat_on_seed():
    sc = load_seed_scenario()
    ours = solve(sc, engine="ours")
    cpsat = solve(sc, engine="cpsat")
    assert ours.status == "optimal" and cpsat.status == "optimal"
    assert ours.objective == cpsat.objective
    assert_hard_constraints_hold(sc, ours)


def test_home_solver_department_scale_is_valid():
    sc = build_department_scenario(load_seed_scenario())
    ours = solve(sc, engine="ours")
    cpsat = solve(sc, engine="cpsat")
    assert ours.status in ("optimal", "feasible")
    assert ours.objective == cpsat.objective  # ties the proven optimum
    assert_hard_constraints_hold(sc, ours)


def test_home_solver_same_conflict_core_as_cpsat():
    sc = load_seed_scenario()
    ops = [
        Operation(op="set_section_instructor", section_id="sec-cs101",
                  instructor_id="diaz", explanation="Diaz takes CS 101."),
        Operation(op="set_section_instructor", section_id="sec-math201",
                  instructor_id="diaz", explanation="Diaz takes MATH 201."),
        Operation(op="set_section_instructor", section_id="sec-cs201",
                  instructor_id="diaz", explanation="Diaz takes CS 201."),
    ]
    ours = solve(sc, ops, engine="ours")
    cpsat = solve(sc, ops, engine="cpsat")
    assert ours.status == cpsat.status == "infeasible"
    assert ours.conflicts.conflicting_operation_indices == \
        cpsat.conflicts.conflicting_operation_indices == [0, 1, 2]


def test_engines_are_plug_and_play():
    from app.solver.engine import ENGINE_IDS, list_engines, solve_with
    assert ENGINE_IDS == ["cpsat", "ours", "greedy"]
    assert all(e["label"] and e["description"] for e in list_engines())
    sc = load_seed_scenario()
    greedy = solve_with("greedy", sc)
    assert greedy.status in ("optimal", "feasible")
    assert_hard_constraints_hold(sc, greedy)
    # the greedy first descent is never better than the optimized engines
    assert greedy.objective >= solve(sc, engine="ours").objective


def test_ranking_comes_from_outputs_only():
    from app.models.results import SolveResult
    from app.solver.engine import rank_results
    fast = SolveResult(status="optimal", objective=-6, solve_time_ms=10)
    slow = SolveResult(status="optimal", objective=-6, solve_time_ms=90)
    winner, verdict = rank_results([("cpsat", slow), ("ours", fast)])
    assert winner == "ours" and "faster" in verdict
    proven = SolveResult(status="optimal", objective=0, solve_time_ms=500)
    unproven = SolveResult(status="feasible", objective=-99, solve_time_ms=1)
    winner, _ = rank_results([("cpsat", proven), ("ours", unproven)])
    assert winner == "cpsat"  # proof of optimality outranks a better raw penalty


def test_home_solver_honors_request_ops_and_is_deterministic():
    sc = load_seed_scenario()
    ops = [Operation(op="add_instructor_unavailability", instructor_id="patel",
                     day=0, explanation="Patel unavailable Mondays.")]
    a = solve(sc, ops, engine="ours")
    b = solve(sc, ops, engine="ours")
    assert a.status == b.status == "optimal"
    assert not [p for p in a.timetable.placements
                if p.instructor_id == "patel" and 0 in p.days]
    key = lambda r: sorted((p.section_id, p.instructor_id, p.period, p.room_id)
                           for p in r.timetable.placements)
    assert key(a) == key(b)
    assert_hard_constraints_hold(sc, a)
