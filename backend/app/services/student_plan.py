"""Student schedule suggestion: a personal timetable that fits a life.

The coordinator builds one timetable for the institution. A student then
asks the opposite question: "Given my job, which of these placed courses can
*I* actually take without slipping a semester?" This service answers it:

  parse (Muse Spark: work days, must-take courses, time preferences)
  -> select (exact search over the placed timetable: one section per course,
     no overlaps, nothing inside the student's unavailable cells, required
     roadmap courses first)
  -> verify (an independent re-check of the finished plan: pairwise overlap,
     roadmap membership, availability — the plan is only shown if it passes)

The model proposes constraints; it never picks classes. If the student's
must-take course has no section outside their work hours, the answer says
exactly that instead of quietly suggesting a plan that delays graduation.
"""

from __future__ import annotations

from app.intelligence.matrices import cohort_pool, placement_intervals
from app.models.results import (
    AgentStep,
    StudentConstraints,
    StudentPlanCourse,
    StudentPlanResponse,
)
from app.models.scenario import Scenario
from app.parsing.student import StudentPlanParser
from app.solver.scheduling_model import solve

_MAX_NODES = 200_000


def _section_score(period: int | None, c: StudentConstraints) -> int:
    if period is None:
        return 0
    score = 0
    if c.prefer_morning:
        score += (3 - period) * 2
    if c.prefer_afternoon:
        score += period * 2
    return score


def suggest_student_plan(
    scenario: Scenario,
    cohort_id: str,
    message: str,
    parser: StudentPlanParser | None = None,
    target_override: int | None = None,
) -> StudentPlanResponse:
    cohort = next((c for c in scenario.cohorts if c.id == cohort_id), None)
    if cohort is None:
        raise ValueError(f"Unknown cohort '{cohort_id}'.")
    parser = parser or StudentPlanParser()
    plan, pool = cohort_pool(scenario, cohort)
    constraints = parser.parse(message, scenario, cohort, plan, pool)
    if target_override:
        constraints.target_courses = max(1, min(6, target_override))
    target = constraints.target_courses

    trace: list[AgentStep] = []
    actor = f"Muse Spark · {parser.model}" if parser.mode == "muse-spark" else "Deterministic mock parser"
    latency = f" in {parser.last_latency_ms} ms" if parser.last_latency_ms else ""
    trace.append(AgentStep(
        step="parse", actor=actor,
        detail=f"Parsed the student's request{latency}: must={constraints.must_course_ids or '—'}, "
               f"unavailable days={constraints.avoid_days or '—'}, "
               f"unavailable periods={constraints.avoid_periods or '—'}, target={target} courses."))

    result = solve(scenario)
    notes: list[str] = []
    if result.status in ("infeasible", "unknown") or result.timetable is None:
        trace.append(AgentStep(
            step="solve", actor="CP-SAT", status="blocked",
            detail=f"No placed timetable to suggest from (solve {result.status})."))
        return StudentPlanResponse(
            cohort_id=cohort.id, cohort_name=cohort.name, constraints=constraints,
            target_courses=target, notes=["No timetable could be built for this term, "
                                           "so no personal plan can be suggested yet."],
            parser_mode=parser.mode, model=parser.model,  # type: ignore[arg-type]
            parser_latency_ms=parser.last_latency_ms, agent_trace=trace)

    by_course: dict[str, list] = {}
    for pl in result.timetable.placements:
        by_course.setdefault(pl.course_id, []).append(pl)

    forbidden = {(d, p) for d in constraints.avoid_days for p in range(4)} | \
                {(d, p) for d in range(5) for p in constraints.avoid_periods}
    must = [c for c in constraints.must_course_ids if c in by_course]
    for cid in constraints.must_course_ids:
        if cid not in by_course:
            notes.append(f"{scenario.course_code(cid)} is not offered this term, "
                         f"so it cannot be in your plan.")

    # Candidate sections per course, best-preference first; hard-filter any
    # section that touches an unavailable cell.
    candidates: dict[str, list] = {}
    for cid in pool:
        sections = [pl for pl in by_course.get(cid, [])
                    if not (placement_intervals(pl) & forbidden)]
        if sections:
            sections.sort(key=lambda pl: -_section_score(pl.period, constraints))
            candidates[cid] = sections
        elif cid in must:
            notes.append(f"{scenario.course_code(cid)} has no section outside your "
                         f"unavailable times — taking it this term would clash with "
                         f"what you told us. Talk to your coordinator about a swap.")

    order = sorted(
        candidates,
        key=lambda cid: (cid not in must, cid not in plan,
                         -_section_score(candidates[cid][0].period, constraints), cid))

    # Exact branch-and-bound: maximize (must taken, required taken, courses
    # up to target, preference score). One section per course, no overlaps.
    best: dict = {"key": None, "chosen": []}
    nodes = [0]

    def search(idx: int, chosen: list, used: set) -> None:
        nodes[0] += 1
        if nodes[0] > _MAX_NODES:
            return
        if idx == len(order):
            key = (sum(1 for pl in chosen if pl.course_id in must),
                   sum(1 for pl in chosen if pl.course_id in plan),
                   min(len(chosen), target),
                   sum(_section_score(pl.period, constraints) for pl in chosen))
            if best["key"] is None or key > best["key"]:
                best["key"], best["chosen"] = key, list(chosen)
            return
        # Upper bound: even taking everything left cannot beat the incumbent.
        if best["key"] is not None:
            optimistic = (sum(1 for pl in chosen if pl.course_id in must)
                          + sum(1 for c in order[idx:] if c in must),
                          sum(1 for pl in chosen if pl.course_id in plan)
                          + sum(1 for c in order[idx:] if c in plan),
                          min(len(chosen) + (len(order) - idx), target),
                          10_000)
            if optimistic[:3] < best["key"][:3]:
                return
        cid = order[idx]
        for pl in candidates[cid]:
            cells = placement_intervals(pl)
            if not (cells & used):
                chosen.append(pl)
                search(idx + 1, chosen, used | cells)
                chosen.pop()
        search(idx + 1, chosen, used)  # skip this course

    search(0, [], set())
    chosen = best["chosen"]
    trace.append(AgentStep(
        step="select", actor="Exact selector (over CP-SAT timetable)",
        detail=f"Searched {nodes[0]} combinations across {len(candidates)} offered "
               f"courses in your degree pool; best plan takes "
               f"{sum(1 for pl in chosen if pl.course_id in must)}/{len(must)} must-take "
               f"and {sum(1 for pl in chosen if pl.course_id in plan)} required course(s)."))

    # Independent verification of the finished plan — not the search's word.
    cells_seen: set = set()
    verified = True
    for pl in chosen:
        cells = placement_intervals(pl)
        if cells & cells_seen or cells & forbidden or pl.course_id not in pool:
            verified = False
        cells_seen |= cells
    trace.append(AgentStep(
        step="verify", actor="Validator",
        detail=("Re-checked the finished plan independently: no overlapping "
                "courses, nothing in your unavailable times, every course in "
                "your degree pool." if verified else
                "Verification failed — plan withheld."),
        status="ok" if verified else "blocked"))
    if not verified:
        chosen = []

    courses: list[StudentPlanCourse] = []
    for pl in sorted(chosen, key=lambda p: (min(p.days), p.period or 0)):
        course = scenario.course(pl.course_id)
        required = pl.course_id in plan
        courses.append(StudentPlanCourse(
            course_id=pl.course_id, course_code=pl.course_code, title=course.title,
            section_id=pl.section_id, instructor_name=pl.instructor_name,
            days=pl.days, period=pl.period, start_time=pl.start_time,
            end_time=pl.end_time, room_name=pl.room_name, required=required,
            reason=("Required this term on your degree roadmap — skipping it risks "
                    "a delayed semester." if required else
                    "Counts toward your degree pool this term.")
                   + " Fits your stated availability."))

    target_met = len(courses) >= target
    if not target_met and not any("no section outside" in n for n in notes):
        notes.append(f"Only {len(courses)} non-conflicting courses fit your "
                     f"availability (target {target}). Loosening a work block or "
                     f"accepting an early slot would open more of your roadmap.")
    trace.append(AgentStep(
        step="audit", actor="Audit trail",
        detail=f"Suggested {len(courses)} course(s) for {cohort.name}: "
               f"target {'met' if target_met else 'not met'}."))

    return StudentPlanResponse(
        cohort_id=cohort.id, cohort_name=cohort.name, constraints=constraints,
        courses=courses, target_courses=target, target_met=target_met, notes=notes,
        parser_mode=parser.mode, model=parser.model,  # type: ignore[arg-type]
        parser_latency_ms=parser.last_latency_ms, agent_trace=trace)
