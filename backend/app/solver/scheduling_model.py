"""OR-Tools CP-SAT scheduling model.

Hard constraints: coverage per role, one shift/worker/day, weekly min/max
shifts, minimum rest between shifts, max consecutive working days,
unavailability, forced assignments.

The self-healing hook: every constraint that comes from the current request
is guarded by a CP-SAT *assumption literal*. If the model is infeasible,
`solver.SufficientAssumptionsForInfeasibility()` returns the minimal
conflicting subset of the request — the solver, not the LLM, diagnoses the
conflict.
"""

from __future__ import annotations

import time
from typing import Optional

from ortools.sat.python import cp_model

from app import config
from app.models.results import (
    Assignment,
    ConflictReport,
    Schedule,
    SolveResult,
)
from app.models.scenario import DAY_NAMES, Operation, Preference, Scenario

SHIFT_START_H = {"day": 7, "evening": 15, "night": 23}
SHIFT_LEN_H = 8


def _slot_start_h(day: int, shift: str) -> int:
    return day * 24 + SHIFT_START_H[shift]


def _rest_gap(t1: tuple[int, str], t2: tuple[int, str]) -> int:
    """Hours of rest between end of slot t1 and start of slot t2."""
    return _slot_start_h(t2[0], t2[1]) - (_slot_start_h(t1[0], t1[1]) + SHIFT_LEN_H)


def _preference_vars(p: Preference, scenario: Scenario, x: dict) -> object:
    """Linear expression over the slots a preference applies to."""
    if p.day is not None and p.shift_type is not None:
        return x[(p.worker_id, p.day, p.shift_type)]
    if p.day is not None:
        return cp_model.LinearExpr.Sum([x[(p.worker_id, p.day, s)] for s in scenario.shift_types])
    if p.shift_type is not None:
        return cp_model.LinearExpr.Sum([x[(p.worker_id, d, p.shift_type)] for d in scenario.days])
    return cp_model.LinearExpr.Sum(
        [x[(p.worker_id, d, s)] for d in scenario.days for s in scenario.shift_types]
    )


def solve(scenario: Scenario, request_ops: Optional[list[Operation]] = None) -> SolveResult:
    t0 = time.perf_counter()
    request_ops = request_ops or []
    m = cp_model.CpModel()

    workers = scenario.workers
    days = sorted(scenario.days)
    shifts = list(scenario.shift_types)

    x: dict[tuple[str, int, str], cp_model.BoolVar] = {}
    for w in workers:
        for d in days:
            for s in shifts:
                x[(w.id, d, s)] = m.NewBoolVar(f"x_{w.id}_{d}_{s}")

    # worked-day indicators (exactly one shift per day per worker)
    y: dict[tuple[str, int], cp_model.BoolVar] = {}
    for w in workers:
        for d in days:
            yv = m.NewBoolVar(f"y_{w.id}_{d}")
            m.Add(cp_model.LinearExpr.Sum([x[(w.id, d, s)] for s in shifts]) == yv)
            y[(w.id, d)] = yv

    # weekly shift bounds per worker
    for w in workers:
        total = cp_model.LinearExpr.Sum([x[(w.id, d, s)] for d in days for s in shifts])
        m.Add(total >= w.min_shifts_per_week)
        m.Add(total <= w.max_shifts_per_week)

    # coverage per slot and role
    for d in days:
        for s in shifts:
            for cov in scenario.coverage:
                m.Add(cp_model.LinearExpr.Sum(
                    [x[(w.id, d, s)] for w in workers if w.role == cov.role]
                ) >= cov.count)

    base_rest = max((r.value for r in scenario.hard_rules if r.rule_type == "min_rest_hours"), default=8)
    base_consec = max((r.value for r in scenario.hard_rules if r.rule_type == "max_consecutive_days"),
                      default=len(days))

    slots = [(d, s) for d in days for s in shifts]

    # base minimum-rest pairs (hard)
    for w in workers:
        for i, t1 in enumerate(slots):
            for t2 in slots[i + 1:]:
                g = _rest_gap(t1, t2)
                if g < base_rest:
                    m.Add(x[(w.id, *t1)] + x[(w.id, *t2)] <= 1)

    # base max-consecutive-days windows (hard)
    if base_consec < len(days):
        for w in workers:
            for i in range(len(days) - base_consec):
                window = days[i:i + base_consec + 1]
                m.Add(cp_model.LinearExpr.Sum([y[(w.id, d)] for d in window]) <= base_consec)

    # base unavailability (hard)
    for u in scenario.unavailability:
        if u.shift_type is None:
            m.Add(cp_model.LinearExpr.Sum([x[(u.worker_id, u.day, s)] for s in shifts]) == 0)
        else:
            m.Add(x[(u.worker_id, u.day, u.shift_type)] == 0)

    # base forced assignments (hard)
    for f in scenario.forced:
        m.Add(x[(f.worker_id, f.day, f.shift_type)] == 1)

    # ---- request operations behind assumption literals ----------------------
    lit_to_op: dict[int, int] = {}
    for i, op in enumerate(request_ops):
        lit = m.NewBoolVar(f"op_{i}")
        m.AddAssumption(lit)
        lit_to_op[lit.Index()] = i

        if op.op == "add_unavailability":
            if op.shift_type is None:
                m.Add(cp_model.LinearExpr.Sum(
                    [x[(op.worker_id, op.day, s)] for s in shifts]) == 0).OnlyEnforceIf(lit)
            else:
                m.Add(x[(op.worker_id, op.day, op.shift_type)] == 0).OnlyEnforceIf(lit)

        elif op.op == "force_assignment":
            m.Add(x[(op.worker_id, op.day, op.shift_type)] == 1).OnlyEnforceIf(lit)

        elif op.op == "add_hard_rule":
            if op.rule_type == "min_rest_hours" and (op.value or 0) > base_rest:
                # additional pairs blocked only if this rule stands
                for w in workers:
                    for i2, t1 in enumerate(slots):
                        for t2 in slots[i2 + 1:]:
                            g = _rest_gap(t1, t2)
                            if base_rest <= g < (op.value or 0):
                                m.Add(x[(w.id, *t1)] + x[(w.id, *t2)] <= 1).OnlyEnforceIf(lit)
            elif op.rule_type == "max_consecutive_days" and (op.value or len(days)) < base_consec:
                v = op.value or len(days)
                for w in workers:
                    for i2 in range(len(days) - v):
                        window = days[i2:i2 + v + 1]
                        m.Add(cp_model.LinearExpr.Sum(
                            [y[(w.id, d)] for d in window]) <= v).OnlyEnforceIf(lit)
        # add_preference is soft — handled in the objective below.

    # ---- objective: minimize preference violations --------------------------
    prefs: list[Preference] = list(scenario.preferences)
    for op in request_ops:
        if op.op == "add_preference" and op.worker_id:
            prefs.append(Preference(worker_id=op.worker_id, kind=op.kind or "avoid",
                                    day=op.day, shift_type=op.shift_type,
                                    weight=op.weight or 10))

    terms = []
    # Discourage overstaffing: every assignment carries a small cost so the
    # solver staffs exactly to coverage unless a preference justifies more.
    terms.append(cp_model.LinearExpr.Sum(
        [x[(w.id, d, s)] for w in workers for d in days for s in shifts]
    ))
    for p in prefs:
        expr = _preference_vars(p, scenario, x)
        if p.kind == "avoid":
            terms.append(p.weight * expr)
        else:
            terms.append(p.weight * (1 - expr))
    if terms:
        m.Minimize(cp_model.LinearExpr.Sum(terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = config.SOLVER_TIME_LIMIT_S
    status = solver.Solve(m)
    elapsed_ms = int((time.perf_counter() - t0) * 1000)

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        by_name = {w.id: w.name for w in workers}
        assignments = [
            Assignment(day=d, day_name=DAY_NAMES[d], shift_type=s, worker_id=wid, worker_name=by_name[wid])
            for (wid, d, s), var in x.items() if solver.Value(var)
        ]
        totals = {w.id: sum(solver.Value(x[(w.id, d, s)]) for d in days for s in shifts) for w in workers}
        return SolveResult(
            status="optimal" if status == cp_model.OPTIMAL else "feasible",
            schedule=Schedule(assignments=assignments, shifts_per_worker=totals),
            objective=int(solver.ObjectiveValue()) if terms else None,
            solve_time_ms=elapsed_ms,
        )

    # ---- infeasible: extract the minimal conflicting request subset ---------
    core = solver.SufficientAssumptionsForInfeasibility()
    op_indices = sorted({lit_to_op[idx] for idx in core if idx in lit_to_op})

    if op_indices:
        named = " / ".join(f"'{request_ops[i].explanation}'" for i in op_indices)
        conflict = ConflictReport(
            conflicting_operation_indices=op_indices,
            explanation=f"These requests cannot hold together (with the base rules): {named}.",
            suggestion="Drop or relax one of the conflicting requests and re-solve.",
        )
    elif request_ops:
        conflict = ConflictReport(
            conflicting_operation_indices=[],
            explanation="Infeasible even without the new requests — the base scenario is over-constrained.",
            suggestion="Relax coverage, worker limits, or base rules.",
        )
    else:
        conflict = ConflictReport(
            conflicting_operation_indices=[],
            explanation="The base schedule rules are infeasible on their own.",
            suggestion="Relax coverage, worker limits, or base rules.",
        )

    return SolveResult(status="infeasible", conflicts=conflict, solve_time_ms=elapsed_ms)
