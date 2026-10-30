"""Student advising: record/progress -> degree-map audit -> proven plan.

Mock mode throughout (zero credits). Seed facts used below: the BSc CS
roadmap is cs101 (term 1) -> cs201/math201 (term 3) -> cs210/cs301 +
elective cs350 (term 5) -> cs310/cs401 (term 7): 7 mandatory + 1 optional.
CS 2025 sits at term 3, so a progress lookup credits it with CS 101 only.
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


def test_progress_lookup_from_cohort():
    sc = load_seed_scenario()
    resp = suggest_student_plan(sc, "cs2025", MSG_FITS)
    p = resp.progress
    assert p.source.startswith("progress lookup")
    assert p.completed_course_ids == ["cs101"]       # term 1, before term 3
    assert p.required_completed == 1 and p.required_total == 7
    assert p.optional_remaining == 1                 # CS 350 elective
    assert p.mandatory_ready == ["CS 201", "MATH 201"]
    assert "CS 301" in p.mandatory_locked            # needs CS 201 first


def test_suggestion_is_conflict_free_and_respects_availability():
    sc = load_seed_scenario()
    resp = suggest_student_plan(sc, "cs2025", MSG_FITS)
    assert resp.parser_mode == "mock"
    codes = [c.course_code for c in resp.courses]
    assert codes == ["CS 201", "MATH 201"]           # the two mandatory-ready
    assert all(c.required for c in resp.courses)     # both mandatory picks
    for course in resp.courses:
        assert not ({1, 3} & set(course.days)), course
    cells = [{(d, course.period) for d in course.days} for course in resp.courses]
    for i, a in enumerate(cells):
        for b in cells[i + 1:]:
            assert not (a & b)
    steps = [s.step for s in resp.agent_trace]
    assert steps == ["parse", "progress", "select", "verify", "audit"]


def test_study_record_unlocks_next_sequence():
    sc = load_seed_scenario()
    resp = suggest_student_plan(
        sc, "cs2025", "I need CS 301 this term.",
        study_record="Completed courses: CS 101, CS 201, MATH 201.")
    assert resp.progress.source == "study record you provided"
    assert resp.progress.required_completed == 3
    codes = [c.course_code for c in resp.courses]
    assert "CS 301" in codes                          # depth-5 now unlocked
    assert "CS 201" not in codes                      # already on the record


def test_must_course_locked_by_unfinished_prerequisites():
    sc = load_seed_scenario()
    resp = suggest_student_plan(sc, "cs2025", "I need CS 301 this term.")
    assert all(c.course_code != "CS 301" for c in resp.courses)
    assert any("CS 301 is still locked" in n for n in resp.notes)


def test_completed_named_in_message_counts_as_record():
    sc = load_seed_scenario()
    resp = suggest_student_plan(
        sc, None, "I've passed CS 101 and CS 201. What should I take?",
        program_id="bscs")
    assert resp.progress.required_completed == 2
    codes = [c.course_code for c in resp.courses]
    assert "MATH 201" in codes and "CS 201" not in codes


def test_suggestion_explains_must_course_blocked_by_availability():
    # Seed truth: CS 201's only section is MWF 8:00 — "no 8:00" blocks it,
    # and the answer must say so instead of silently dropping the course.
    sc = load_seed_scenario()
    resp = suggest_student_plan(sc, "cs2025", MSG)
    assert all(c.course_code != "CS 201" for c in resp.courses)
    assert any("CS 201 has no section outside your unavailable times" in n
               for n in resp.notes)


def test_suggestion_flags_impossible_availability():
    sc = load_seed_scenario()
    resp = suggest_student_plan(
        sc, "cs2025",
        "I work Mondays, Tuesdays, Wednesdays, Thursdays and Fridays. I need CS 201.")
    assert resp.courses == []
    assert resp.target_met is False


def test_student_plan_api(client):
    r = client.post("/student/plan", json={"cohort_id": "cs2025", "message": MSG_FITS})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["progress"]["completed_course_ids"] == ["cs101"]
    assert any(c["course_code"] == "CS 201" for c in body["courses"])
    r = client.post("/student/plan", json={
        "message": "advise me", "study_record": "CS 101 CS 201 MATH 201",
        "program_id": "bscs"})
    assert r.status_code == 200, r.text
    assert r.json()["progress"]["required_completed"] == 3
    r = client.post("/student/plan", json={"cohort_id": "nope", "message": "hi"})
    assert r.status_code == 400
    r = client.post("/student/plan", json={"message": "hi"})
    assert r.status_code == 400  # no cohort, no degree: cannot advise
