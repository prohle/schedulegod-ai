"""Student schedule suggestion: parse -> exact select -> independent verify.

Mock mode throughout (zero credits). The seed's CS 2025 cohort sits at term 3
(plan: CS 201 + MATH 201); the story seed only guarantees 2/4 cohorts a
four-course fit, so targets here use what the placed timetable can prove.
"""

from __future__ import annotations

from app.main import load_seed_scenario
from app.parsing.student import mock_student_parse
from app.services.student_plan import suggest_student_plan

MSG = "I work Tuesdays and Thursdays. I need CS 201 this term, and no 8:00 classes."
MSG_FITS = "I work Tuesdays and Thursdays. I need CS 201 this term."


def test_mock_student_parse_extracts_life_constraints():
    sc = load_seed_scenario()
    cohort = next(c for c in sc.cohorts if c.id == "cs2025")
    c = mock_student_parse(MSG, sc, cohort)
    assert c.must_course_ids == ["cs201"]
    assert c.avoid_days == [1, 3]          # Tue / Thu work days
    assert c.avoid_periods == [0]          # no 8:00
    assert c.target_courses == 4


def test_suggestion_is_conflict_free_and_respects_availability():
    sc = load_seed_scenario()
    resp = suggest_student_plan(sc, "cs2025", MSG_FITS)
    assert resp.parser_mode == "mock"
    codes = [c.course_code for c in resp.courses]
    assert "CS 201" in codes  # the must-take course made the plan
    assert len(codes) >= 3
    # Nothing suggested sits on a work day.
    for course in resp.courses:
        assert not ({1, 3} & set(course.days)), course
    # Pairwise non-overlap, re-derived from the response alone.
    cells = []
    for course in resp.courses:
        cells.append({(d, p) for d in course.days for p in ([course.period] if course.period is not None else [])})
    for i, a in enumerate(cells):
        for b in cells[i + 1:]:
            assert not (a & b)
    steps = [s.step for s in resp.agent_trace]
    assert steps == ["parse", "select", "verify", "audit"]


def test_suggestion_flags_impossible_must_course():
    sc = load_seed_scenario()
    # Unavailable every weekday: no section of anything can fit.
    resp = suggest_student_plan(
        sc, "cs2025",
        "I work Mondays, Tuesdays, Wednesdays, Thursdays and Fridays. I need CS 201.")
    assert resp.courses == []
    assert resp.target_met is False
    assert any("CS 201" in n for n in resp.notes)


def test_suggestion_explains_must_course_blocked_by_availability():
    # Seed truth: CS 201's only section is MWF 8:00 — "no 8:00" blocks it,
    # and the answer must say so instead of silently dropping the course.
    sc = load_seed_scenario()
    resp = suggest_student_plan(sc, "cs2025", MSG)
    assert all(c.course_code != "CS 201" for c in resp.courses)
    assert any("CS 201 has no section outside your unavailable times" in n
               for n in resp.notes)


def test_student_plan_api(client):
    r = client.post("/student/plan", json={"cohort_id": "cs2025", "message": MSG_FITS})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["cohort_id"] == "cs2025"
    assert any(c["course_code"] == "CS 201" for c in body["courses"])
    r = client.post("/student/plan", json={"cohort_id": "nope", "message": "hi"})
    assert r.status_code == 400
