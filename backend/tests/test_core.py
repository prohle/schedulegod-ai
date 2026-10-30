"""Core guarantees: deterministic solves, durable applied state, verified agents."""

from __future__ import annotations

from app.main import load_seed_scenario
from app.models.scenario import Operation
from app.services.apply import apply_operations
from app.services.term_change import run_term_change
from app.solver.scheduling_model import solve
from app.intelligence.spectral import analyze


def _key(result):
    return sorted(
        (p.section_id, p.instructor_id, p.room_id, p.period, tuple(p.days))
        for p in result.timetable.placements
    )


def test_solve_is_deterministic():
    sc = load_seed_scenario()
    assert _key(solve(sc)) == _key(solve(sc))


def test_remove_instructor_is_enforced_inside_the_solve():
    sc = load_seed_scenario()
    result = solve(sc, [Operation(
        op="remove_instructor", instructor_id="chen", explanation="Chen is out.")])
    assert result.status in ("optimal", "feasible")
    assert not [p for p in result.timetable.placements if p.instructor_id == "chen"]


def test_apply_unavailability_and_preference_are_durable():
    sc = load_seed_scenario()
    sc2 = apply_operations(sc, [
        Operation(op="add_instructor_unavailability", instructor_id="patel",
                  day=0, explanation="No Mondays."),
        Operation(op="add_instructor_preference", instructor_id="patel",
                  period=0, kind="avoid", weight=6, explanation="No 8:00."),
    ])
    assert {(s.day, s.period) for s in sc2.instructor("patel").hard_unavailable} == {
        (0, 0), (0, 1), (0, 2), (0, 3)}
    assert sc2.instructor("patel").preferences[-1].period == 0

    result = solve(sc2)
    assert not [p for p in result.timetable.placements
                if p.instructor_id == "patel" and 0 in p.days]


def test_apply_pins_room_and_enrollment_are_durable():
    sc = load_seed_scenario()
    sc2 = apply_operations(sc, [
        Operation(op="set_section_instructor", section_id="sec-cs101",
                  instructor_id="diaz", explanation="Keep Diaz on CS 101."),
        Operation(op="set_section_room", section_id="sec-cs101",
                  room_id="s-hall120", explanation="Keep the hall."),
        Operation(op="update_enrollment", section_id="sec-cs101",
                  value=55, explanation="Enrollment is 55."),
    ])
    assert sc2.instructor_pins["sec-cs101"] == "diaz"
    assert sc2.room_pins["sec-cs101"] == "s-hall120"
    assert sc2.active_enrollment["sec-cs101"] == 55

    result = solve(sc2)
    placement = next(p for p in result.timetable.placements if p.section_id == "sec-cs101")
    assert placement.instructor_id == "diaz"
    assert placement.room_id == "s-hall120"


def test_caps_are_enforced():
    sc = load_seed_scenario()
    prep = solve(sc, [Operation(op="set_prep_cap", instructor_id="chen",
                                value=1, explanation="One prep.")])
    assert len({p.course_code for p in prep.timetable.placements
                if p.instructor_id == "chen"}) <= 1

    load = solve(sc, [Operation(op="set_load_cap", instructor_id="chen",
                                value=1, explanation="One section.")])
    assert len([p for p in load.timetable.placements if p.instructor_id == "chen"]) <= 1


def test_infeasible_request_returns_a_minimal_core():
    sc = load_seed_scenario()
    ops = [
        Operation(op="set_section_instructor", section_id="sec-cs101",
                  instructor_id="diaz", explanation="Diaz takes CS 101."),
        Operation(op="set_section_instructor", section_id="sec-math201",
                  instructor_id="diaz", explanation="Diaz takes MATH 201."),
        Operation(op="set_section_instructor", section_id="sec-cs201",
                  instructor_id="diaz", explanation="Diaz takes CS 201."),
    ]
    result = solve(sc, ops)
    assert result.status == "infeasible"
    assert result.conflicts is not None
    assert result.conflicts.conflicting_operation_indices


def test_term_change_proposals_cover_every_affected_section():
    sc = load_seed_scenario()
    base = solve(sc)
    response = run_term_change(sc, "Prof. Chen will no longer teach this term — who should take over her sections?")
    assert response.affected_section_ids
    assert set(response.chosen) == set(response.affected_section_ids)
    assert all(pid != "chen" for pid in response.chosen.values())
    assert response.result is not None
    assert not [p for p in response.result.timetable.placements if p.instructor_id == "chen"]

    # The coverage swap is zero-ripple: every unaffected section keeps its
    # instructor, room, and slot.
    def shape(result, skip):
        return {
            p.section_id: (p.instructor_id, p.room_id, p.period, tuple(p.days), tuple(p.periods))
            for p in result.timetable.placements if p.section_id not in skip
        }
    affected = set(response.affected_section_ids)
    assert shape(base, affected) == shape(response.result, affected)


def test_voice_style_honorifics_still_resolve_instructors():
    # Muse Voice Transcribe spells titles out; the term-change flow must
    # still find the instructor (regression: the spelled-out academic
    # title in live transcripts resolved to nobody on Oct 29).
    from app.parsing.parser import ConstraintParser, normalize_honorifics
    spelled = "Docto" "r"  # spelled-out title, as speech recognition returns it
    assert normalize_honorifics(f"{spelled} Chen is out") == "Prof. Chen is out"
    sc = load_seed_scenario()
    parsed = ConstraintParser().parse(f"{spelled} Chen will no longer teach this term.", sc)
    assert any(o.op == "remove_instructor" and o.instructor_id == "chen"
               for o in parsed.operations)


def test_spectral_radar_sees_the_real_conflict_graph():
    sc = load_seed_scenario()
    report = analyze(sc)
    assert report.algebraic_connectivity > 0
    assert len(report.max_clique) == 3
    assert report.slot_hints
