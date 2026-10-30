"""Ingestion normalizer: free-form faculty availability must survive into the solver."""

from __future__ import annotations

from app.ingestion.normalize import build_scenario
from app.models.ingestion import (
    ExtractedCohort,
    ExtractedCourse,
    ExtractedDistance,
    ExtractedInstructor,
    ExtractedRequirement,
    InstitutionData,
)


def test_faculty_availability_becomes_typed_constraints():
    data = InstitutionData(
        courses=[ExtractedCourse(code="CS 101", title="Intro", seats=50)],
        instructors=[
            ExtractedInstructor(
                name="Prof. Chen",
                qualified_courses=["CS 101"],
                availability="unavailable Mondays; prefers mornings",
            )
        ],
        cohorts=[ExtractedCohort(
            name="CS 2026", program="BSc CS", current_term=1, size=30)],
        degree_map=[ExtractedRequirement(
            program="BSc CS", term=1, course="CS 101", required=True)],
    )
    scenario = build_scenario(data)
    chen = scenario.instructor("prof-chen")

    # "unavailable Mondays" -> all four Monday slots are hard-blocked.
    assert {(s.day, s.period) for s in chen.hard_unavailable} == {
        (0, 0), (0, 1), (0, 2), (0, 3)}
    # "prefers mornings" -> a soft period preference, not a hard block.
    assert any(p.period == 0 and p.kind == "prefer" for p in chen.preferences)


def test_campus_distances_override_the_default_walk_matrix():
    data = InstitutionData(
        buildings=["Science", "Engineering"],
        distances=[ExtractedDistance(
            from_building="Science", to_building="Engineering", minutes=8)],
    )
    scenario = build_scenario(data)
    assert scenario.distances["science"]["engineering"] == 8
    assert scenario.distances["engineering"]["science"] == 8


def test_degree_map_links_cohorts_to_programs():
    data = InstitutionData(
        courses=[ExtractedCourse(code="CS 101"), ExtractedCourse(code="CS 201")],
        instructors=[ExtractedInstructor(name="Prof. Chen", qualified_courses=["CS 101", "CS 201"])],
        cohorts=[ExtractedCohort(
            name="CS 2026", program="BSc CS", current_term=1, size=30)],
        degree_map=[
            ExtractedRequirement(program="BSc CS", term=1, course="CS 101"),
            ExtractedRequirement(program="BSc CS", term=3, course="CS 201"),
        ],
    )
    scenario = build_scenario(data)
    assert scenario.cohorts[0].program_id == scenario.programs[0].id
    assert scenario.cohort_term_courses(scenario.cohorts[0]) == ["cs-101"]
