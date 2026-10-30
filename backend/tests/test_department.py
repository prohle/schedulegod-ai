"""Department scale + agent trace: the top-prize proof points.

The story seed is small on purpose; these tests lock in that the same
engine solves a real department (26 instructors / 25 sections / 12 cohorts)
optimally, keeps the C39 four-course guarantee for every cohort, preserves
every demo beat, and exposes the autonomous agent loop as a trace.
"""

from app.data.department import (
    build_department_scenario,
    build_full_university_scenario,
    build_university_scenario,
)
from app.intelligence.matrices import compute_margins
from app.main import load_seed_scenario
from app.models.scenario import Operation
from app.services.copilot import run_copilot
from app.services.term_change import run_term_change
from app.solver.scheduling_model import solve


def _dept():
    return build_department_scenario(load_seed_scenario())


def test_department_is_real_scale():
    sc = _dept()
    assert len(sc.instructors) >= 24
    assert len(sc.sections) >= 24
    assert len(sc.rooms) >= 16
    assert len(sc.programs) >= 3
    assert len(sc.cohorts) >= 12
    # every course has at least two qualified instructors (no single point
    # of failure a coordinator would flag on day one)
    for c in sc.courses:
        assert sum(c.id in i.qualified_courses for i in sc.instructors) >= 2, c.id


def test_department_solves_optimal_with_c39_guarantee():
    sc = _dept()
    result = solve(sc)
    assert result.status == "optimal"
    assert result.timetable is not None
    assert len(result.timetable.placements) == len(sc.sections)
    margins = compute_margins(sc, result.timetable, 4)
    assert margins.all_ok, [(c.cohort_id, c.margin) for c in margins.cohorts if not c.ok]


def test_department_preserves_demo_beats():
    sc = _dept()
    base = solve(sc)
    chen_sections = {p.course_code for p in base.timetable.placements
                     if p.instructor_id == "chen"}
    assert chen_sections == {"CS 301", "CS 310"}

    overload = solve(sc, [
        Operation(op="set_section_instructor", section_id="sec-cs101",
                  instructor_id="diaz", explanation="Diaz takes CS 101."),
        Operation(op="set_section_instructor", section_id="sec-math201",
                  instructor_id="diaz", explanation="Diaz takes MATH 201."),
        Operation(op="set_section_instructor", section_id="sec-cs201",
                  instructor_id="diaz", explanation="Diaz takes CS 201."),
    ])
    assert overload.status == "infeasible"
    assert overload.conflicts.conflicting_operation_indices

    resp = run_term_change(sc, "Prof. Chen will no longer teach this term — who should take over her sections?")
    assert resp.affected_section_ids == ["sec-cs301", "sec-cs310"]
    assert resp.chosen and all(v != "chen" for v in resp.chosen.values())
    assert resp.result.status in ("optimal", "feasible")
    assert not [p for p in resp.result.timetable.placements if p.instructor_id == "chen"]


def test_university_scale_solves_with_c39_guarantee():
    sc = build_university_scenario(load_seed_scenario())
    assert len(sc.instructors) >= 36
    assert len(sc.sections) >= 40
    assert len(sc.programs) >= 5
    assert len(sc.cohorts) >= 20
    result = solve(sc)
    assert result.status == "optimal"
    margins = compute_margins(sc, result.timetable, 4)
    assert margins.all_ok, [(c.cohort_id, c.margin) for c in margins.cohorts if not c.ok]
    chen = {p.course_code for p in result.timetable.placements if p.instructor_id == "chen"}
    assert chen == {"CS 301", "CS 310"}


def test_agent_trace_exposes_the_loop():
    sc = load_seed_scenario()
    healed = run_copilot(sc, "Diaz is taking over CS 101, MATH 201 and CS 201 personally.")
    steps = [s.step for s in healed.agent_trace]
    assert steps[0] == "parse" and "validate" in steps and "solve" in steps
    assert "conflict-core" in steps and "explain" in steps and "verify" in steps
    assert steps[-1] == "audit"
    assert all(s.actor and s.detail for s in healed.agent_trace)

    term_change = run_term_change(sc, "Prof. Chen will no longer teach this term — who should take over her sections?")
    esteps = [s.step for s in term_change.agent_trace]
    assert esteps[0] == "parse" and "impact" in esteps and "probe" in esteps
    assert "choose" in esteps and "re-solve" in esteps and esteps[-1] == "audit"


def test_full_university_stress_scale():
    """The realistic tier: hundreds of sections, ~12k students. The native
    solver proves the optimum; CP-SAT honestly cannot complete this scale
    inside its budget (it must say "unknown", never fake "infeasible")."""
    sc = build_full_university_scenario(load_seed_scenario())
    assert len(sc.instructors) == 198
    assert len(sc.sections) == 361
    assert len(sc.cohorts) == 100
    assert len(sc.programs) == 25
    assert sum(c.size for c in sc.cohorts) >= 11000

    ours = solve(sc, engine="ours")
    assert ours.status == "optimal"
    assert ours.timetable is not None
    assert len(ours.timetable.placements) == len(sc.sections)
    # Verified independently from the placements, not the search's word.
    from test_home_solver import assert_hard_constraints_hold
    assert_hard_constraints_hold(sc, ours)
    margins = compute_margins(sc, ours.timetable, 4)
    assert margins.all_ok

    cpsat = solve(sc)
    assert cpsat.status in ("optimal", "feasible", "unknown")
    if cpsat.status == "unknown":
        assert cpsat.conflicts is None
