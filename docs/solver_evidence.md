# Solver evidence: an AI-authored rival to CP-SAT, proven

## The claim, scoped honestly

ScheduleGod ships two independent solvers behind one interface
(`GET /engines`, `POST /solve` with `engine`, one `SolveResult` shape):

- **CP-SAT** (`cpsat`) — Google's industrial C++ constraint solver.
- **Ours** (`ours`) — an AI-authored solver built for this problem class:
  a native **C++17 search core** (`backend/native/schedulergod_solver.cpp`)
  fed domains/penalties by the same preparation code CP-SAT's model uses,
  so the engines differ *only in search*. A Python reference implementation
  of the same algorithm (`backend/app/solver/home_solver.py`) remains as
  the readable specification and as fallback when the binary is unbuilt.
- **Greedy** (`greedy`) — the first descent only, to show what the
  optimization phases buy.

**Why not CP-SAT alone?** Wrapping an industrial solver is commodity.
The contribution is a domain-specialized engine that *proves the same
optima* — with the receipts below — plus a standardized interface that
lets the two cross-check each other live.

**Why not pure Python?** We measured it: the Python search reaches
CP-SAT's penalty at department/university scale but hits its 5 s budget
**unproven** (`feasible`, not `optimal`). Language was not the goal —
proof was. The hot loop (branch-and-bound) moved to C++; everything
else (domains, penalties, validation, output) stays in the shared
Python layer, which is what makes the comparison fair.

**Why not Julia?** JIT warm-up and the deployment tax (Docker, Modal,
CI all gain a second runtime) buy nothing at 8–41 sections; C++ compiles
with the `g++` already present in every build image we use.

## Measured head-to-head (`backend/scripts/benchmark.py`, dev laptop)

| Scenario | CP-SAT | Ours (native C++) | Ours (Python ref) |
|---|---|---|---|
| Story seed (8 sections) | optimal · −6 · 16 ms | **optimal · −6 · 5 ms** | optimal · −6 · 47 ms |
| Department (25 sections) | optimal · −40 · 164 ms | **optimal · −40 · 22 ms** | feasible · −40 · 5013 ms |
| University (41 sections) | optimal · −40 · 258 ms | **optimal · −40 · 31 ms** | feasible · −40 · 5000 ms |

Same proven objective at every scale; the native core proves it
3–8× faster than CP-SAT on this problem class. Placement agreement with
CP-SAT is low (37% / 12% / 2%) — expected: these instances have many
tied optima and the engines break ties differently. Agreement is *not*
the equivalence claim; the proven objective + independent hard-constraint
verification is.

## What makes the proof finish (the interesting part)

Plain branch-and-bound (the Python reference) cannot close the last
penalty points: one section (`sec-math201`) sits +6 above its static
lower bound because its preferred option needs Prof. Patel in a slot
another section holds. The native core adds three domain-aware proof
techniques on top of greedy descent + single/ejection hill-climbing:

1. **Live admissible bound** — at every node, current penalty plus the
   cheapest *currently viable* option per unassigned section.
2. **Pairwise-conflict bound** — for contending section pairs whose
   cheapest viable options clash (same instructor/room slot, or a
   demanded cohort pair), at least one side must pay its deviation
   cost; summed over a disjoint matching of such pairs, this stays
   admissible and lifts the bound by exactly the contested points.
3. **Unit propagation** — sections with one viable option are forced
   immediately; zero viable options is an instant dead end.

Variable ordering is MRV with the bound computed in the same pass.
Deterministic: single thread, sorted domains, no randomness — two runs
return identical placements (tested).

## Equivalence evidence (all in `backend/tests/test_native_solver.py`)

- Proven parity: `optimal` status and identical objective vs CP-SAT at
  seed, department, and university scale.
- Independent verification: hard constraints checked from placements
  alone (qualification, room type/capacity/equipment, blackouts, load /
  prep caps, no instructor/room/cohort overlap) — the shared checker in
  `backend/tests/test_home_solver.py`.
- Same minimal conflict core on the Diaz overload: `[0, 1, 2]`, via
  deletion minimization with the native solver as its own oracle (the
  same contract CP-SAT's assumption literals provide).
- Determinism and request-op semantics (unavailability ops honored).

## Honest limits

- CP-SAT is a general solver; ours is specialized. On adversarial or
  much larger instances CP-SAT's clause learning will win, and the UI
  says so — the compare view ranks engines from outputs only.
- Term Change coverage probes (`propose_candidates`) still run on CP-SAT;
  the engines share the contract, so this is a configuration choice,
  not a limitation of the native core.
- If the native binary is not built (e.g. a platform without `g++`),
  `ours` transparently falls back to the Python reference search and
  still returns CP-SAT's penalty at scale — labeled `feasible` when it
  cannot prove optimality inside the budget. No silent claims.

## Reproduce

```bash
bash backend/scripts/build_native.sh          # g++ -O3, ~2 s
cd backend && .venv/bin/python scripts/benchmark.py
.venv/bin/python -m pytest -q                 # incl. native parity tests
```
