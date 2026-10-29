"""Department-scale scenario: the story seed grown to a real department.

The seed scenario (6 instructors, 8 sections) is the rehearsed demo story.
This module deterministically expands it — same core faculty, courses, and
cohorts, plus Mathematics and Data Science wings sharing the campus — into
the scale a real term actually has:

  26 instructors · 25 courses/sections · 16 rooms · 4 buildings
  3 degree programs · 12 cohorts

It exists so judges can verify the engine at department scale in one click
(`POST /scenario/department`) and so `scripts/benchmark.py` can quote real
solve numbers. The core wing is untouched: every demo beat (Patel, Chen,
Diaz, Okafor, Nguyen) behaves exactly as it does on the seed. The only core
patch is two course preferences for Dr. Chen, which keep her on CS 301 /
CS 310 — the sections the emergency beat re-homes — at the larger scale.
"""

from __future__ import annotations

from app.models.scenario import (
    Building,
    Cohort,
    Course,
    Instructor,
    InstructorPreference,
    Program,
    RoadmapRequirement,
    Room,
    Scenario,
    Section,
    SlotRef,
)


def _req(course_id: str, required: bool = True, seat_estimate: int | None = None):
    return RoadmapRequirement(course_id=course_id, required=required,
                              seat_estimate=seat_estimate)


_NEW_ROOMS = [
    Room(id="s-201", name="Science 201", building_id="S", capacity=45,
         room_type="lecture", equipment=["projector", "whiteboard"]),
    Room(id="s-hall60", name="Science Hall 60", building_id="S", capacity=60,
         room_type="lecture", equipment=["projector", "mic", "lecture-capture"]),
    Room(id="e-101", name="Engineering 101", building_id="E", capacity=40,
         room_type="lecture", equipment=["projector", "whiteboard"]),
    Room(id="e-305", name="Engineering 305", building_id="E", capacity=35,
         room_type="lecture", equipment=["projector", "lecture-capture"]),
    Room(id="e-lab1", name="Engineering Lab 1", building_id="E", capacity=30,
         room_type="lab", equipment=["computers"]),
    Room(id="l-105", name="Library 105", building_id="L", capacity=40,
         room_type="lecture", equipment=["projector", "whiteboard"]),
    Room(id="l-201", name="Library 201", building_id="L", capacity=35,
         room_type="seminar", equipment=["video-conf", "whiteboard"]),
    Room(id="a-101", name="Arts 101", building_id="A", capacity=50,
         room_type="lecture", equipment=["projector", "mic"]),
    Room(id="a-210", name="Arts 210", building_id="A", capacity=30,
         room_type="seminar", equipment=["video-conf", "whiteboard"]),
]

_NEW_COURSES = [
    # Mathematics wing
    Course(id="math101", code="MATH 101", title="Calculus I", pattern="MWF",
           room_type="lecture", seats=28, equipment=["projector"]),
    Course(id="math230", code="MATH 230", title="Discrete Mathematics", pattern="MWF",
           room_type="lecture", seats=54, equipment=["projector"]),
    Course(id="math210", code="MATH 210", title="Linear Algebra", pattern="TTh",
           room_type="lecture", seats=26, equipment=["projector"]),
    Course(id="stat201", code="STAT 201", title="Statistical Methods", pattern="MWF",
           room_type="lecture", seats=50, equipment=["projector"]),
    Course(id="math301", code="MATH 301", title="Real Analysis", pattern="MWF",
           room_type="lecture", seats=24, equipment=["whiteboard"]),
    Course(id="math310", code="MATH 310", title="Probability", pattern="TTh",
           room_type="lecture", seats=24, equipment=["projector"]),
    Course(id="math320", code="MATH 320", title="Abstract Algebra", pattern="TTh",
           room_type="lecture", seats=12, equipment=["whiteboard"]),
    Course(id="math401", code="MATH 401", title="Topology", pattern="MWF",
           room_type="lecture", seats=22, equipment=["whiteboard"]),
    Course(id="math410", code="MATH 410", title="Senior Seminar", pattern="TTh",
           room_type="seminar", seats=22, equipment=["video-conf"]),
    # Data Science wing (shares MATH 230 / STAT 201 with Mathematics)
    Course(id="ds101", code="DS 101", title="Data Science Foundations", pattern="MWF",
           room_type="lecture", seats=26, equipment=["projector"]),
    Course(id="ds210", code="DS 210", title="Data Wrangling Lab", pattern="block",
           room_type="lab", seats=24, equipment=["computers"], duration=3.0),
    Course(id="stat310", code="STAT 310", title="Statistical Inference", pattern="TTh",
           room_type="lecture", seats=22, equipment=["projector"]),
    Course(id="ds320", code="DS 320", title="Data Visualization", pattern="TTh",
           room_type="lecture", seats=22, equipment=["projector"]),
    Course(id="ds410", code="DS 410", title="Data Ethics & Society", pattern="MWF",
           room_type="seminar", seats=20, equipment=["video-conf"]),
    # CS electives opened on the existing degree map
    Course(id="cs280", code="CS 280", title="Software Engineering Studio", pattern="block",
           room_type="lab", seats=14, equipment=["computers"], duration=3.0),
    Course(id="cs330", code="CS 330", title="Databases", pattern="TTh",
           room_type="lecture", seats=16, equipment=["projector"]),
    Course(id="cs420", code="CS 420", title="Advanced Machine Learning", pattern="TTh",
           room_type="lecture", seats=26, equipment=["lecture-capture"]),
]

_NEW_INSTRUCTORS = [
    Instructor(id="ahern", name="Dr. Ahern", qualified_courses=["math101", "math230"],
               max_sections=2, max_preps=2,
               hard_unavailable=[SlotRef(day=0, period=0)]),
    Instructor(id="brooks", name="Prof. Brooks", qualified_courses=["math101", "math210"],
               max_sections=2, max_preps=2),
    Instructor(id="costa", name="Dr. Costa", qualified_courses=["math230", "math210"],
               max_sections=2, max_preps=2),
    Instructor(id="dubois", name="Prof. Dubois", qualified_courses=["stat201", "math310"],
               max_sections=2, max_preps=2,
               preferences=[InstructorPreference(kind="avoid", day=4, weight=8)]),
    Instructor(id="ellis", name="Dr. Ellis", qualified_courses=["math301", "math320"],
               max_sections=2, max_preps=2),
    Instructor(id="farrell", name="Prof. Farrell", qualified_courses=["math301", "math401"],
               max_sections=2, max_preps=2),
    Instructor(id="gupta", name="Dr. Gupta", qualified_courses=["stat201", "stat310"],
               max_sections=2, max_preps=2),
    Instructor(id="hassan", name="Prof. Hassan",
               qualified_courses=["math310", "math320", "math401"],
               max_sections=2, max_preps=2),
    Instructor(id="iyer", name="Dr. Iyer", qualified_courses=["ds101", "ds320"],
               max_sections=2, max_preps=2,
               preferences=[InstructorPreference(kind="prefer", period=1, weight=6)]),
    Instructor(id="jensen", name="Prof. Jensen", qualified_courses=["ds210", "ds101"],
               max_sections=2, max_preps=2),
    Instructor(id="kim", name="Dr. Kim", qualified_courses=["stat310", "ds320"],
               max_sections=2, max_preps=2,
               hard_unavailable=[SlotRef(day=3, period=0)]),
    Instructor(id="lopez", name="Prof. Lopez", qualified_courses=["ds410", "cs420"],
               max_sections=2, max_preps=2),
    Instructor(id="mensah", name="Dr. Mensah", qualified_courses=["ds210", "cs280"],
               max_sections=2, max_preps=2),
    Instructor(id="novak", name="Prof. Novak", qualified_courses=["ds410", "math410"],
               max_sections=2, max_preps=2),
    Instructor(id="osman", name="Dr. Osman", qualified_courses=["cs280", "cs330"],
               max_sections=2, max_preps=2,
               preferences=[InstructorPreference(kind="prefer", course_id="cs330", weight=6)]),
    Instructor(id="park", name="Prof. Park", qualified_courses=["cs330", "cs420"],
               max_sections=2, max_preps=2),
    Instructor(id="quinn", name="Dr. Quinn", qualified_courses=["cs330", "ds320"],
               max_sections=2, max_preps=2),
    Instructor(id="rossi", name="Prof. Rossi", qualified_courses=["cs420", "ds101"],
               max_sections=2, max_preps=2),
    Instructor(id="singh", name="Dr. Singh", qualified_courses=["cs280", "ds210", "cs210"],
               max_sections=2, max_preps=2),
    Instructor(id="turner", name="Prof. Turner", qualified_courses=["math401", "math410"],
               max_sections=2, max_preps=2),
]

_NEW_PROGRAMS = [
    Program(id="bsmath", name="BSc Mathematics", roadmap={
        "1": [_req("math101"), _req("math230")],
        "3": [_req("math210"), _req("stat201")],
        "5": [_req("math301"), _req("math310"),
              _req("math320", required=False, seat_estimate=12)],
        "7": [_req("math401"), _req("math410")],
    }),
    Program(id="bsds", name="BSc Data Science", roadmap={
        "1": [_req("ds101"), _req("math230")],
        "3": [_req("ds210"), _req("stat201")],
        "5": [_req("stat310"), _req("ds320")],
        "7": [_req("ds410"), _req("cs420", required=False, seat_estimate=12)],
    }),
]

# Electives opened on the existing CS degree map (checked against C7/C8:
# never a third same-day meeting for any cohort).
_CS_ELECTIVES = {
    "3": [_req("cs280", required=False, seat_estimate=14)],
    "5": [_req("cs330", required=False, seat_estimate=16)],
    "7": [_req("cs420", required=False, seat_estimate=14)],
}

_NEW_COHORTS = [
    Cohort(id="math2026", program_id="bsmath", name="Math 2026 cohort",
           admission_year=2026, graduation_year=2030, current_term=1, size=28),
    Cohort(id="math2025", program_id="bsmath", name="Math 2025 cohort",
           admission_year=2025, graduation_year=2029, current_term=3, size=26),
    Cohort(id="math2024", program_id="bsmath", name="Math 2024 cohort",
           admission_year=2024, graduation_year=2028, current_term=5, size=24),
    Cohort(id="math2023", program_id="bsmath", name="Math 2023 cohort",
           admission_year=2023, graduation_year=2027, current_term=7, size=22),
    Cohort(id="ds2026", program_id="bsds", name="DS 2026 cohort",
           admission_year=2026, graduation_year=2030, current_term=1, size=26),
    Cohort(id="ds2025", program_id="bsds", name="DS 2025 cohort",
           admission_year=2025, graduation_year=2029, current_term=3, size=24),
    Cohort(id="ds2024", program_id="bsds", name="DS 2024 cohort",
           admission_year=2024, graduation_year=2028, current_term=5, size=22),
    Cohort(id="ds2023", program_id="bsds", name="DS 2023 cohort",
           admission_year=2023, graduation_year=2027, current_term=7, size=20),
]


def build_department_scenario(seed: Scenario) -> Scenario:
    """Expand the story seed to department scale (see module docstring)."""
    sc = seed.model_copy(deep=True)
    sc.name = "Department Cluster — Autumn Term (CS + Mathematics + Data Science)"

    sc.buildings.append(Building(id="A", name="Arts & Humanities"))
    for b in ("S", "E", "L"):
        sc.distances[b]["A"] = {"S": 8, "E": 12, "L": 6}[b]
    sc.distances["A"] = {"S": 8, "E": 12, "L": 6, "A": 0}

    sc.rooms.extend(_NEW_ROOMS)
    sc.courses.extend(_NEW_COURSES)
    sc.sections.extend(Section(id=f"sec-{c.id}", course_id=c.id) for c in _NEW_COURSES)
    sc.instructors.extend(_NEW_INSTRUCTORS)
    sc.programs.extend(_NEW_PROGRAMS)
    sc.cohorts.extend(_NEW_COHORTS)

    bscs = next(p for p in sc.programs if p.id == "bscs")
    for term, reqs in _CS_ELECTIVES.items():
        bscs.roadmap[term] = [*bscs.roadmap.get(term, []), *reqs]

    # Keep the emergency beat's subject on her two sections at this scale.
    chen = sc.instructor("chen")
    chen.preferences = [
        *chen.preferences,
        InstructorPreference(kind="prefer", course_id="cs301", weight=8),
        InstructorPreference(kind="prefer", course_id="cs310", weight=8),
    ]
    return sc
