"""Offline end-to-end demo: the full co-pilot loop with the mock parser.

Run:  python demo.py   (no API key required)

Beats:
  1. Build the term timetable from the full constraint world (CP-SAT).
  2. Intake: one instructor sentence reshuffles the timetable legally.
  3. Emergency: an instructor drops out -> CP-SAT-verified coverage
     proposals ("who could potentially be available") -> auto-pick -> re-solve.
  4. Overload: an impossible request -> minimal conflict core -> self-heal.
"""

from __future__ import annotations

from app.main import load_seed_scenario
from app.models.results import CandidateProposal, CopilotResponse, EmergencyResponse, SolveResult
from app.models.scenario import DAY_NAMES, PERIOD_NAMES
from app.services.copilot import run_copilot
from app.services.emergency import run_emergency

INTAKE_MSG = (
    "Professor Patel can't teach Mondays — committee duty. "
    "She'd rather not teach at 8:00."
)
EMERGENCY_MSG = "Dr. Chen is out all week — who could cover her sections?"
OVERLOAD_MSG = "Diaz is taking over CS 101, MATH 201 and CS 201 personally."
ENROLLMENT_MSG = "CS 350 enrollment jumped to 45 after registration ended."


def print_timetable(result: SolveResult, title: str) -> None:
    print(f"\n{title}: {result.status.upper()} in {result.solve_time_ms} ms"
          + (f" (preference penalty={result.objective})" if result.objective is not None else ""))
    if result.timetable is None:
        if result.conflicts:
            print(f"  CONFLICT: {result.conflicts.explanation}")
        return
    grid = {p: ["—"] * 5 for p in range(4)}
    for pl in result.timetable.placements:
        for d in pl.days:
            for p in pl.periods:
                grid[p][d] = f"{pl.course_code.split()[1] if ' ' in pl.course_code else pl.course_code}|{pl.instructor_name.split()[-1]}"
    print("          " + "".join(f"{DAY_NAMES[d]:<12}" for d in range(5)))
    for p in range(4):
        print(f"{PERIOD_NAMES[p]:<10}" + "".join(f"{cell:<12}" for cell in grid[p]))
    for pl in sorted(result.timetable.placements, key=lambda x: x.course_code):
        days = "/".join(DAY_NAMES[d][:3] for d in pl.days)
        slots = f"{days} @{PERIOD_NAMES[pl.periods[0]]}" + (f"-{PERIOD_NAMES[pl.periods[1]]}" if len(pl.periods) > 1 else "")
        print(f"    {pl.course_code:<9} {pl.instructor_name:<12} {pl.room_name} [{pl.building_id}]  {slots}")
    print("    loads: " + ", ".join(f"{k}={v}" for k, v in sorted(result.timetable.sections_per_instructor.items())))


def print_copilot(message: str, resp: CopilotResponse) -> None:
    print("=" * 78)
    print(f'CHAIR:   "{message}"')
    print(f"PARSER ({resp.parser_mode}): {resp.summary}")
    for op in resp.operations:
        print(f"  - [{op.op}] {op.explanation}")
    for note in resp.healing_notes:
        print(f"  ! {note}")
    if resp.diagnosis:
        print(f"  DIAGNOSIS ({resp.diagnosis_mode}): {resp.diagnosis}")
    if resp.options:
        print("  Solver-verified resolution options (Muse proposes, CP-SAT proves):")
        for i, opt in enumerate(resp.options, 1):
            obj = f", preference penalty={opt.result.objective}" if opt.result.objective is not None else ""
            print(f"    {i}. drop '{opt.dropped_explanation}' — {opt.tradeoff} "
                  f"[{opt.result.status.upper()}{obj}]")
    if resp.result:
        print_timetable(resp.result, "TIMETABLE")


def print_emergency(message: str, resp: EmergencyResponse) -> None:
    print("=" * 78)
    print(f'CHAIR:   "{message}"')
    print(f"PARSER ({resp.parser_mode}) — emergency: {resp.removed_instructor_name} removed.")
    print(f"  affected sections: {', '.join(resp.affected_section_ids)}")
    print("  CP-SAT-verified coverage proposals:")
    for p in resp.proposals:
        mark = "✓" if p.feasible else "✗"
        print(f"    {mark} {p.course_code:<8} -> {p.instructor_name:<12} {p.reason}")
    print("  chosen: " + (", ".join(f"{sid} -> {resp.chosen[sid]}" for sid in resp.chosen) or "(none)"))
    for note in resp.healing_notes:
        print(f"  ! {note}")
    if resp.result:
        print_timetable(resp.result, "TIMETABLE AFTER EMERGENCY")


def print_intelligence(scenario) -> None:
    """BEAT 5: sparse matrices + spectral radar + AI tightening on demand."""
    from app import config
    from app.intelligence import analyze, build_matrices, run_tightener

    print("=" * 78)
    print("BEAT 5 — INTELLIGENCE LAYER: spectral radar -> C39 audit -> AI tightening")

    bundle = build_matrices(scenario)
    print("  Sparse matrices (scipy CSR):")
    for name in ("classroom", "fulfilment", "demand", "faculty_availability",
                 "qualification"):
        m = getattr(bundle, name)
        print(f"    {name:<20} shape={m.shape} nnz={m.nnz} density={m.density}")

    radar = analyze(scenario)
    print("  Spectral radar:")
    print(f"    algebraic connectivity mu2={radar.algebraic_connectivity}  "
          f"Hoffman chi>={radar.hoffman_chromatic_lower_bound}  "
          f"max clique={radar.max_clique}")
    print(f"    slot hints (AddHint warm-start): {radar.slot_hints}")
    for w in radar.deadlock_warnings:
        print(f"    ! {w}")

    resp = run_tightener(scenario)
    print(f"  Tightener [{resp.trigger}] ({resp.muse_mode}): {resp.assessment}")
    for mv in resp.moves:
        mark = "OK " if mv.verified else "REJECTED"
        print(f"    [{mark}] {mv.kind} {mv.instructor_id or ''}{mv.course_id or ''}"
              f"{mv.cohort_id or ''} — {mv.detail}")
    if resp.margins and resp.margins.cohorts:
        print("  Four-course guarantee (C39) after verified moves:")
        for m in resp.margins.cohorts:
            print(f"    {m.cohort_id:<8} margin {m.margin}/{resp.margins.min_courses} "
                  f"{'OK' if m.ok else 'SHORTFALL'}  track={m.example_track}")


def main() -> None:
    scenario = load_seed_scenario()
    print("ScheduleGod AI — offline demo (mock parser; set MODEL_API_KEY for Muse Spark)")
    print(f"Scenario: {scenario.name}")
    print(f"Cohorts: " + "; ".join(
        f"{c.name} (term {c.current_term}, {c.size} students)"
        for c in scenario.cohorts))

    from app.solver.scheduling_model import solve
    print_timetable(solve(scenario), "\nBEAT 1 — BUILD THE TERM")

    print_copilot(INTAKE_MSG, run_copilot(scenario, INTAKE_MSG))
    print("\n  (intake shown against the base scenario; in production the "
          "window would merge this into the world state)")

    print_emergency(EMERGENCY_MSG, run_emergency(scenario, EMERGENCY_MSG))
    print_copilot(OVERLOAD_MSG, run_copilot(scenario, OVERLOAD_MSG))
    print_copilot(ENROLLMENT_MSG, run_copilot(scenario, ENROLLMENT_MSG))

    print_intelligence(scenario)


if __name__ == "__main__":
    main()
