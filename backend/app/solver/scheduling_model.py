"""CP-SAT academic course timetabling model.

Decisions: for each section -> (instructor, timeslot, room), honoring:

- C13 qualification, C14 hard unavailability (pre-filtered at build time)
- C15 load caps, C16 prep caps
- C17 instructor no-overlap, C23 room no-double-booking
- C24 capacity, C25 room-type match, C26 room blackouts (pre-filtered)
- C29 fixed meeting patterns (MWF / TTh / weekly lab block)
- C7  same-cohort sections never overlap
- C8  cohort daily load cap
- C32 campus geography: back-to-back classes must be walkable
- C19/C20 instructor soft preferences as objective penalties

Every constraint coming from the current request is guarded by a CP-SAT
assumption literal, so `SufficientAssumptionsForInfeasibility()` returns the
minimal conflicting subset of the request — the solver, not the LLM,
diagnoses conflicts.

`propose_candidates` answers "who could potentially be available": for each
instructor qualified for an affected section, it probes a CP-SAT solve with
everything else frozen, returning verified feasibility + preference delta.
"""

from __future__ import annotations

import time
from typing import Optional

from ortools.sat.python import cp_model

from app import config
from app.models.results import (
    CandidateProposal,
    ConflictReport,
    Placement,
    SolveResult,
    Timetable,
)
from app.models.scenario import (
    BLOCK_DAYS,
    BLOCK_PERIODS,
    DAY_NAMES,
    InstructorPreference,
    Operation,
    PATTERN_DAYS,
    PERIOD_NAMES,
    Scenario,
    Section,
)

VAR_KEY = tuple  # (section_id, instructor_id, slot_key, room_id)


def _pattern_of(sc: Scenario, section_id: str) -> str:
    return sc.course(sc.section_by_id(section_id).course_id).pattern


def _slot_blackout(sc: Scenario, room_id: str, day: int, period: int) -> bool:
    return any(
        b.room_id == room_id and b.day == day and (b.period is None or b.period == period)
        for b in sc.room_blackouts
    )


def _hard_blocked(instructor, day: int, period: int) -> bool:
    return any(s.day == day and s.period == period for s in instructor.hard_unavailable)


def _options(sc: Scenario, section: Section) -> list[tuple[str, str, int, str]]:
    """Eligible (instructor_id, slot_key, room_id) options; slot_key is the
    period (0-3) for MWF/TTh or the day (BLOCK_DAYS) for weekly blocks."""
    course = sc.course(section.course_id)
    rooms = [r for r in sc.rooms
             if r.room_type == course.room_type
             and r.capacity >= sc.enrollment_for_section(section)
             and set(course.equipment) <= set(r.equipment)]  # C34
    insts = [i for i in sc.instructors if section.course_id in i.qualified_courses]
    opts: list[tuple[str, str, int, str]] = []
    if course.pattern in ("MWF", "TTh"):
        days = PATTERN_DAYS[course.pattern]
        for i in insts:
            for p in range(4):
                if any(_hard_blocked(i, d, p) for d in days):
                    continue
                for r in rooms:
                    if any(_slot_blackout(sc, r.id, d, p) for d in days):
                        continue
                    opts.append((i.id, p, r.id))
    else:  # weekly block
        for i in insts:
            for d in BLOCK_DAYS:
                if any(_hard_blocked(i, d, p) for p in BLOCK_PERIODS):
                    continue
                for r in rooms:
                    if any(_slot_blackout(sc, r.id, d, p) for p in BLOCK_PERIODS):
                        continue
                    opts.append((i.id, d, r.id))
    return opts


def _covers(sc: Scenario, section_id: str, slot_key: int, day: Optional[int], period: Optional[int]) -> bool:
    """Does an assignment (section at slot_key) occupy (day, period)? None = wildcard."""
    pattern = _pattern_of(sc, section_id)
    if pattern in ("MWF", "TTh"):
        if day is not None and day not in PATTERN_DAYS[pattern]:
            return False
        return period is None or slot_key == period
    # block
    if day is not None and slot_key != day:
        return False
    return period is None or period in BLOCK_PERIODS


def solve(
    sc: Scenario,
    request_ops: Optional[list[Operation]] = None,
    pins_exact: Optional[dict[str, tuple[str, int, str]]] = None,
    instructor_pins: Optional[dict[str, str]] = None,
    slot_hints: Optional[dict[str, int]] = None,
) -> SolveResult:
    t0 = time.perf_counter()
    request_ops = list(request_ops or [])
    m = cp_model.CpModel()

    opts: dict[str, list[tuple[str, int, str, str]]] = {
        s.id: _options(sc, s) for s in sc.sections
    }

    a: dict[VAR_KEY, cp_model.BoolVar] = {}
    for s in sc.sections:
        for (iid, key, rid) in opts[s.id]:
            a[(s.id, iid, key, rid)] = m.NewBoolVar(f"a_{s.id}_{iid}_{key}_{rid}")
        m.Add(cp_model.LinearExpr.Sum(
            [a[(s.id, *o)] for o in opts[s.id]]
        ) == 1)

    def vars_of(section_id: str):
        return [(k, v) for k, v in a.items() if k[0] == section_id]

    # C15 instructor load
    for i in sc.instructors:
        covering = [v for k, v in a.items() if k[1] == i.id]
        if covering:
            m.Add(cp_model.LinearExpr.Sum(covering) <= i.max_sections)

    # C16 prep caps
    t: dict[tuple[str, str], cp_model.BoolVar] = {}
    for i in sc.instructors:
        courses = {sc.section_by_id(k[0]).course_id for k, v in a.items() if k[1] == i.id}
        for cid in sorted(courses):  # sorted: deterministic constraint order
            tv = m.NewBoolVar(f"t_{i.id}_{cid}")
            t[(i.id, cid)] = tv
            for k, v in a.items():
                if k[1] == i.id and sc.section_by_id(k[0]).course_id == cid:
                    m.Add(tv >= v)
        if courses:
            m.Add(cp_model.LinearExpr.Sum([t[(i.id, c)] for c in sorted(courses)]) <= i.max_preps)

    # C17 instructor busy: one thing at a time per (day, period)
    for i in sc.instructors:
        for d in range(5):
            for p in range(4):
                covering = [v for k, v in a.items()
                            if k[1] == i.id and _covers(sc, k[0], k[2], d, p)]
                if len(covering) > 1:
                    m.Add(cp_model.LinearExpr.Sum(covering) <= 1)

    # C23 room busy: one section per room per (day, period)
    for r in sc.rooms:
        for d in range(5):
            for p in range(4):
                covering = [v for k, v in a.items()
                            if k[3] == r.id and _covers(sc, k[0], k[2], d, p)]
                if len(covering) > 1:
                    m.Add(cp_model.LinearExpr.Sum(covering) <= 1)

    # C7 same-cohort sections never overlap
    for (sa, sb) in sc.demanded_section_pairs():
        pa, pb = _pattern_of(sc, sa.id), _pattern_of(sc, sb.id)
        if pa == "block" and pb in ("MWF", "TTh"):  # normalize: one-period first
            sa, sb, pa, pb = sb, sa, pb, pa
        if pa in ("MWF", "TTh") and pb in ("MWF", "TTh"):
            if set(PATTERN_DAYS[pa]) & set(PATTERN_DAYS[pb]):
                for p in range(4):
                    qa = [v for k, v in a.items() if k[0] == sa.id and k[2] == p]
                    qb = [v for k, v in a.items() if k[0] == sb.id and k[2] == p]
                    if qa and qb:
                        m.Add(cp_model.LinearExpr.Sum(qa + qb) <= 1)
        elif pa in ("MWF", "TTh") and pb == "block":
            for d in sorted(set(PATTERN_DAYS[pa]) & set(BLOCK_DAYS)):
                for p in BLOCK_PERIODS:
                    qa = [v for k, v in a.items() if k[0] == sa.id and k[2] == p]
                    qbd = [v for k, v in a.items() if k[0] == sb.id and k[2] == d]
                    if qa and qbd:
                        m.Add(cp_model.LinearExpr.Sum(qa + qbd) <= 1)
        elif pa == "block" and pb == "block":
            for d in BLOCK_DAYS:
                qda = [v for k, v in a.items() if k[0] == sa.id and k[2] == d]
                qdb = [v for k, v in a.items() if k[0] == sb.id and k[2] == d]
                if qda and qdb:
                    m.Add(cp_model.LinearExpr.Sum(qda + qdb) <= 1)

    # C8 cohort daily load cap (<= 2 meetings/day)
    for c in sc.cohorts:
        sids = {s.id for cid in sc.cohort_term_courses(c) for s in sc.sections_of_course(cid)}
        for d in range(5):
            covering = []
            for sid in sorted(sids):  # sorted: deterministic constraint order
                pattern = _pattern_of(sc, sid)
                if pattern in ("MWF", "TTh"):
                    if d in PATTERN_DAYS[pattern]:
                        covering += [v for k, v in a.items() if k[0] == sid]
                else:
                    covering += [v for k, v in a.items() if k[0] == sid and k[2] == d]
            if len(covering) > 2:
                m.Add(cp_model.LinearExpr.Sum(covering) <= 2)

    # C32 campus geography: back-to-back cohort classes must be walkable
    bl: dict[tuple[str, str], cp_model.BoolVar] = {}
    for s in sc.sections:
        for b in sc.buildings:
            terms = [v for k, v in a.items() if k[0] == s.id and sc.room(k[3]).building_id == b.id]
            bv = m.NewBoolVar(f"bl_{s.id}_{b.id}")
            bl[(s.id, b.id)] = bv
            if terms:
                m.Add(cp_model.LinearExpr.Sum(terms) == bv)
            else:
                m.Add(bv == 0)
    for (sa, sb) in sc.demanded_section_pairs():
        pa, pb = _pattern_of(sc, sa.id), _pattern_of(sc, sb.id)
        if pa == pb and pa in ("MWF", "TTh"):
            for p in range(3):
                for b1 in sc.buildings:
                    for b2 in sc.buildings:
                        if sc.distances[b1.id][b2.id] > sc.walk_limit_min:
                            qa = [v for k, v in a.items() if k[0] == sa.id and k[2] == p]
                            qb = [v for k, v in a.items() if k[0] == sb.id and k[2] == p + 1]
                            if qa and qb:
                                m.Add(cp_model.LinearExpr.Sum(qa) + bl[(sa.id, b1.id)] + bl[(sb.id, b2.id)] <= 2)
                                m.Add(cp_model.LinearExpr.Sum(qb) + bl[(sb.id, b1.id)] + bl[(sa.id, b2.id)] <= 2)

    # exact pins (probes: freeze every other section to a known schedule)
    for sid, (iid, key, rid) in (pins_exact or {}).items():
        m.Add(a[(sid, iid, key, rid)] == 1)

    # hard instructor pins (emergency: chosen candidate keeps the section)
    for sid, iid in (instructor_pins or {}).items():
        m.Add(cp_model.LinearExpr.Sum(
            [v for k, v in a.items() if k[0] == sid and k[1] == iid]
        ) == 1)

    # spectral warm start (intelligence layer): color-derived period hints on
    # cohort-conflicting sections. Hints only guide the search — they can
    # never make a feasible model infeasible.
    for sid, key in (slot_hints or {}).items():
        for k, v in a.items():
            if k[0] == sid:
                m.AddHint(v, 1 if k[2] == key else 0)

    # ---- request operations behind assumption literals ----------------------
    lit_to_op: dict[int, int] = {}
    for idx, op in enumerate(request_ops):
        lit = m.NewBoolVar(f"op_{idx}")
        m.AddAssumption(lit)
        lit_to_op[lit.Index()] = idx
        if op.op == "add_instructor_unavailability":
            for k, v in a.items():
                if k[1] == op.instructor_id and _covers(sc, k[0], k[2], op.day, op.period):
                    m.Add(v == 0).OnlyEnforceIf(lit)
        elif op.op == "add_room_unavailability":
            for k, v in a.items():
                if k[3] == op.room_id and _covers(sc, k[0], k[2], op.day, op.period):
                    m.Add(v == 0).OnlyEnforceIf(lit)
        elif op.op == "set_section_instructor":
            terms = [v for k, v in a.items() if k[0] == op.section_id and k[1] == op.instructor_id]
            if terms:
                m.Add(cp_model.LinearExpr.Sum(terms) == 1).OnlyEnforceIf(lit)
            else:
                m.Add(lit == 0)  # impossible ask -> surfaces as conflict on this op
        elif op.op == "update_enrollment" and op.section_id and op.value:
            # C37: active enrollment re-triggers the capacity check (C24):
            # every too-small room for this section is blocked while the op holds.
            for k, v in a.items():
                if k[0] == op.section_id and sc.room(k[3]).capacity < (op.value or 0):
                    m.Add(v == 0).OnlyEnforceIf(lit)

    # ---- soft preferences (C19/C20) as objective ----------------------------
    prefs: list[tuple[str, InstructorPreference]] = []
    for i in sc.instructors:
        for p in i.preferences:
            prefs.append((i.id, p))
    for op in request_ops:
        if op.op == "add_instructor_preference" and op.instructor_id:
            prefs.append((op.instructor_id, InstructorPreference(
                kind=op.kind or "avoid", day=op.day, period=op.period,
                weight=op.weight or 10)))

    obj_terms = []
    for iid, p in prefs:
        if p.period is not None:
            covering = [v for k, v in a.items() if k[1] == iid and _covers(sc, k[0], k[2], None, p.period)]
            if covering:
                iv = m.NewIntVar(0, 4, f"ip_{iid}_{p.period}")
                m.Add(cp_model.LinearExpr.Sum(covering) == iv)
                obj_terms.append(p.weight * iv if p.kind == "avoid" else -p.weight * iv)
        elif p.day is not None:
            covering = [v for k, v in a.items() if k[1] == iid and _covers(sc, k[0], k[2], p.day, None)]
            if covering:
                dv = m.NewIntVar(0, 5, f"id_{iid}_{p.day}")
                m.Add(cp_model.LinearExpr.Sum(covering) == dv)
                obj_terms.append(p.weight * dv if p.kind == "avoid" else -p.weight * dv)
    if obj_terms:
        m.Minimize(cp_model.LinearExpr.Sum(obj_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = config.SOLVER_TIME_LIMIT_S
    # Deterministic solves (stable demo output; ties broken the same way every run)
    solver.parameters.num_search_workers = 1
    status = solver.Solve(m)
    elapsed_ms = int((time.perf_counter() - t0) * 1000)

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        placements = []
        counts: dict[str, int] = {}
        for s in sc.sections:
            (sid, iid, key, rid) = next(k for k, v in a.items()
                                         if k[0] == s.id and solver.Value(v))
            course = sc.course(sc.section_by_id(sid).course_id)
            inst = sc.instructor(iid)
            room = sc.room(rid)
            if course.pattern in ("MWF", "TTh"):
                days, period, periods = PATTERN_DAYS[course.pattern], key, [key]
            else:
                days, period, periods = [key], None, list(BLOCK_PERIODS)
            placements.append(Placement(
                section_id=sid, course_id=course.id, course_code=course.code,
                instructor_id=iid, instructor_name=inst.name,
                days=days, period=period, periods=periods,
                room_id=room.id, room_name=room.name, building_id=room.building_id))
            counts[iid] = counts.get(iid, 0) + 1
        for i in sc.instructors:
            counts.setdefault(i.id, 0)
        return SolveResult(
            status="optimal" if status == cp_model.OPTIMAL else "feasible",
            timetable=Timetable(placements=placements, sections_per_instructor=counts),
            objective=int(solver.ObjectiveValue()) if obj_terms else None,
            solve_time_ms=elapsed_ms,
        )

    core = solver.SufficientAssumptionsForInfeasibility()
    op_indices = sorted({lit_to_op[idx] for idx in core if idx in lit_to_op})
    if op_indices:
        named = " / ".join(f"'{request_ops[i].explanation}'" for i in op_indices)
        conflict = ConflictReport(
            conflicting_operation_indices=op_indices,
            explanation=f"These requests cannot hold together (with the base rules): {named}.",
            suggestion="Drop or relax one of the conflicting requests and re-solve.",
        )
    else:
        conflict = ConflictReport(
            conflicting_operation_indices=[],
            explanation="Infeasible against the base scenario (no request could fix this).",
            suggestion="Relax room inventory, loads, or hard unavailability.",
        )
    return SolveResult(status="infeasible", conflicts=conflict, solve_time_ms=elapsed_ms)


def propose_candidates(sc: Scenario, base: SolveResult, removed_instructor_id: str) -> list[CandidateProposal]:
    """"Who could potentially be available?" — CP-SAT-verified coverage proposals."""
    if base.timetable is None:
        return []
    placements = {p.section_id: p for p in base.timetable.placements}
    affected = [p for p in base.timetable.placements if p.instructor_id == removed_instructor_id]
    if not affected:
        return []

    proposals: list[CandidateProposal] = []
    for lost in affected:
        pins = {
            sid: (p.instructor_id, p.period if p.period is not None else p.days[0], p.room_id)
            for sid, p in placements.items() if sid != lost.section_id
        }
        for cand in sc.instructors:
            if cand.id == removed_instructor_id or lost.course_id not in cand.qualified_courses:
                continue
            current = base.timetable.sections_per_instructor.get(cand.id, 0)
            if current + 1 > cand.max_sections:
                continue
            probe = solve(
                sc,
                request_ops=[Operation(
                    op="set_section_instructor",
                    section_id=lost.section_id,
                    instructor_id=cand.id,
                    explanation=f"probe {cand.id}",
                )],
                pins_exact=pins,
            )
            feasible = probe.status in ("optimal", "feasible")
            delta = None
            if feasible and probe.objective is not None and base.objective is not None:
                delta = probe.objective - base.objective
            reason = (f"qualified for {lost.course_code}; load {current + 1}/{cand.max_sections}"
                      + (f"; preference delta {delta}" if delta not in (None, 0) else "")
                      + ("; zero-ripple swap verified by CP-SAT" if feasible else "; would break the timetable"))
            proposals.append(CandidateProposal(
                section_id=lost.section_id, course_code=lost.course_code,
                instructor_id=cand.id, instructor_name=cand.name,
                feasible=feasible, objective_delta=delta,
                load_after=current + 1, reason=reason,
            ))
    proposals.sort(key=lambda p: (not p.feasible, p.objective_delta if p.objective_delta is not None else 9999))
    return proposals
