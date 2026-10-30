[![CI](https://github.com/prohle/schedulegod-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/prohle/schedulegod-ai/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Python 3.12](https://img.shields.io/badge/Python-3.12-blue.svg)](./backend)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black.svg)](./frontend)
[![Tests](https://img.shields.io/badge/tests-42%20passing-brightgreen.svg)](#run-it)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](./docker-compose.yml)

# ScheduleGod AI — Agentic Constraint Solver & Timetable Infrastructure

> **Category:** Autonomous Agents & Workflows · Education & Knowledge Systems
> **Domain:** Combinatorial optimization, operations research, constraint programming (CP-SAT), spectral graph analysis
> **Stack:** Meta Model API (Muse Spark) · **dual solver engines — OR-Tools CP-SAT and an AI-built native C++ rival solver that proves the same optima faster on this problem class (evidence: [docs/solver_evidence.md](./docs/solver_evidence.md))** · FastAPI · Next.js · Postgres 18 · multi-user (coordinator / instructor / student logins)

**Every term, every department rediscovers that the course timetable is an NP-hard constraint problem managed with email and spreadsheets.**

A department's instructors — twenty-six in the loadable department-scale scenario, six in the demo seed — with hard constraints ("never Tuesdays, committee duty"), soft preferences ("mornings, please"), teaching-load and prep caps. Four cohorts at different points of the same degree roadmap — the CS 2025 cohort needs CS 201 *this term* or forty-five students slip a semester. Elective pools with estimated take-up, enrollment that surges after registration closes. A fixed inventory of rooms — each course needing the right equipment and size — across a campus you can't cross in ten minutes between classes. And one coordinator whose calendar bleeds a week, every term, translating all of it into a spreadsheet that is wrong the moment reality changes.

**ScheduleGod AI automates that reconciliation.** Messy files go in — in any format, from any office — Muse Spark autocleans them into one model of the entire institution, natural language adds constraints, and a deterministic solver engine guarantees the output: a provably feasible, recommended timetable for the whole college/university, a minimal-conflict explanation when a request can't hold, and when reality breaks the term mid-flight (an instructor drops out, a hall closes), coverage is determined by solver feasibility probes over every qualified instructor, not by model suggestion.

> The LLM never touches the schedule. It only proposes constraints, and every
> constraint — and every coverage proposal — is verified by a solver.

Built for the **Meta Global AI Developer Hackathon** — *Build for Your World* track. This is the problem we know firsthand.

> **▶ Live demo (no account, no API key needed): https://prohle--schedulegod-ai-ui-web.us-east.modal.run** — the full wizard UI (Import → Intake → Build → Emergency → Intelligence), proxied to the backend API at https://prohle--schedulegod-ai-api.us-east.modal.run (`/docs`, `/status`, `/engines`). Both are scale-to-zero on Modal, so the first request may take a few seconds. Judges can also run everything locally in 2 minutes with `docker compose up` — see [Run it](#run-it).
>
> **▶ Demo video (2:55, live Puppeteer screencast of the running app — not screenshots): https://github.com/prohle/schedulegod-ai/releases/download/demo-video/final.mp4** — one-click coordinator login → any-format import autoclean → Patel intake → **dual-engine compare with Rank 1 / Rank 2 ranked from outputs** → university-scale publish → instructor change request approved and re-published → Chen emergency with solver-verified coverage + agent trace → growth what-if re-solve. Script and recording pipeline: [docs/demo_script.md](./docs/demo_script.md).

![Build: visual timetable grid](docs/screenshot-build.png)

![Emergency: before/after with CP-SAT-verified coverage](docs/screenshot-emergency.png)

## How it works

```
INGEST     point the tool at messy institutional files in ANY format — a PDF
           catalog, a Word degree map, a CSV of cohorts, an Excel room sheet,
           plain-text emails, or a zip of all of them. A format layer extracts
           the text (PDF/DOCX/XLSX/CSV/JSON/TXT/MD/ZIP); if the files answer
           the six requirements, Muse Spark autocleans them into typed
           entities and the normalizer assembles the Scenario — one model of
           the entire college/university
INTAKE     the coordinator pastes or drops the term's intake (v1: one
           intake box + a speaker picker; per-instructor windows with
           deadlines are the next step): free-text constraints -> Muse Spark
           (structured output) -> typed hard/soft constraints -> validated
           -> provenance stored
BUILD      both engines assign every section an instructor, timeslot set,
           and room: qualification, loads, prep caps, room capacity/type,
           equipment, meeting patterns, cohort conflicts, electives, campus
           walk distances, active enrollment, preferences. The AI-built
           rival solver and CP-SAT then race on identical data; the compare
           evaluates both final schedules from outputs alone (proven status,
           then penalty, then speed) and ranks Rank 1 / Rank 2
OPERATE    the coordinator publishes the winning timetable; instructors and
           students sign in to their own role-filtered schedules. Changes
           arrive two ways: an emergency (a typed message -> impact analysis
           -> propose_candidates: every qualified instructor solver-probed
           for zero-ripple feasibility + preference delta, ranked with
           plain-English reasons -> pick -> timetable updates), or an
           instructor's own change request, which the coordinator approves
           only after the same verified loop re-proves and re-publishes it
TIGHTEN    when the solver deadlocks or the four-course guarantee fails:
           spectral radar -> Muse Spark proposes typed repair moves
           (raise_load_cap, add_section, add_qualification, open_elective,
           drop_request) -> CP-SAT verifies each -> only proven moves shown
GROW       plan with proof before spending: enrollment +20%, repurpose a
           hall, build a new lab — each what-if re-solved with utilization
           and guarantee deltas. Add a college, a degree, a course, or an
           adjusted degree map by re-ingesting the changed files and
           re-solving the larger institution
```

When a request set is infeasible, the solver doesn't just fail — every incoming constraint is guarded by a CP-SAT *assumption literal*, so the model returns the **minimal conflicting subset** of the request. Then the two-layer self-heal fires: **Muse Spark translates the proof** (plain-English explanation + ranked resolutions, each dropping one conflicting request), and **CP-SAT re-solves every proposed resolution** before it can be shown — the agent presents only *proven* options, and auto-applies the least disruptive one.

**Every co-pilot run returns an agent trace** — the autonomous loop made visible, step by step with the actor named: `parse (Muse Spark) → validate → solve (CP-SAT) → conflict-core → explain (Muse Spark) → verify each resolution (CP-SAT) → auto-apply the least-disruptive proven fix → audit`. The Emergency flow traces the same way (`parse → impact → probe every candidate → choose → re-solve → audit`). The wizard renders the trace live; it is also in the API response (`agent_trace`). No step is a model guess: each one either proposes (Muse) or proves (CP-SAT).

**Spectral warm-start runs on every solve**: the section-conflict graph (cohort hard edges + instructor soft edges) yields Laplacian eigenvalues and the Fiedler vector, whose spectral coloring becomes CP-SAT `AddHint` hints. The same graph powers a **deadlock radar** — algebraic connectivity μ₂, Hoffman chromatic lower bound, exact max clique — that names a structural deadlock (a same-pattern clique exceeding the 4-period MWF/TTh band) *before* the solver wastes a solve, and feeds the tightener.

**Four-course guarantee (C39)** audits every placed timetable: can each cohort assemble ≥4 distinct, mutually non-overlapping courses toward graduation? Shortfalls trigger the tightener's `open_elective` moves, which the solver verifies.

Full constraint catalog — offerings & degree roadmaps, course optionality, active enrollment, equipment, cohort progression, instructor hard/soft schedules, rooms & campus walk matrix, with a coverage map of every real-world consideration: [docs/constraint_catalog.md](./docs/constraint_catalog.md)

## What a demo sounds like

| Who says | What happens |
|---|---|
| "Prof. Patel can't teach Mondays — committee duty." | Her sections legally re-home to other instructors and the rest of the board shifts to keep the cohort conflict-free. One sentence, a multi-section ripple, all solver-verified — and **applied to the term**, so the next solve keeps it. |
| "Prof. Chen is out all week — who could cover her sections?" | Two affected sections. Ranked, CP-SAT-verified coverage proposals — *Okafor (qualified, load 2/3, no preference cost)* over *Nguyen (qualified, +8 preference penalty)* — chosen, re-solved. |
| "Diaz is taking over CS 101, MATH 201 and CS 201 personally." | INFEASIBLE — Diaz's load cap is two sections. Muse Spark's explanation names the binding rule and ranks resolutions ("drop the CS 201 pin — Okafor has capacity to take it"); **every option is re-solved by CP-SAT with its own penalty delta**, the least disruptive one applies. |
| "CS 350 enrollment jumped to 45 after registration ended." | Active enrollment re-triggers every capacity check; the board re-solves and CS 350 lands in the 120-seat hall with zero cohort conflicts. |
| *(coordinator clicks Publish, then signs in as Prof. Chen)* | Chen sees **only her own sections**. Her request "I can't teach Fridays" goes to the coordinator, who approves it — the verified loop re-solves, re-publishes, and her personal grid updates. A student signing in sees only their cohort's courses. |
| "What if enrollment grows 20% — or we repurpose the big hall?" | Each growth/repurpose/build-a-lab what-if is re-solved first: utilization and four-course-guarantee deltas with a plain verdict, before capital is committed. Add a college, degree, or course — or adjust a degree map — by re-ingesting the changed files; the institution re-solves as one. |
| *(C39 shortfall fires)* | "CS 2023 cohort can only fit 2 of 4 non-conflicting courses." → the tightener proposes opening already-offered electives; CP-SAT verifies the margin gains against the current board and **rejects** moves that make the enlarged scenario infeasible. Only verified moves are shown. |

## Proof at university scale

The demo story above is one department slice (6 instructors, 8 sections) so every beat fits in three minutes. The same engine — same code path, one click in the Build step (**Load department scale** / **Load university scale**, or `POST /scenario/department` / `/scenario/university`) — solves a full department cluster (**26 instructors, 25 sections, 12 cohorts, 3 programs**) or the entire university (**38 instructors, 41 sections, 20 cohorts, 5 programs** sharing the same rooms, slots, and campus walk matrix), built deterministically from the seed (`backend/app/data/department.py`). Measured with `backend/scripts/benchmark.py` (single-worker deterministic CP-SAT, dev laptop):

| Scenario | Instructors | Sections | Rooms | Cohorts | Programs | CP-SAT | Ours (native C++) | Ours (Python ref) | C39 guarantee | Room util. | Emergency (Chen out) |
|---|---:|---:|---:|---:|---:|---|---|---|---|---:|---|
| Story seed (demo) | 6 | 8 | 7 | 4 | 1 | optimal 16 ms · penalty −6 | **optimal 5 ms · penalty −6** | optimal 47 ms · penalty −6 | 2/4 (tightener demo world) | 39% | 2 affected, 3/3 probes feasible |
| Department scale | 26 | 25 | 16 | 12 | 3 | optimal 164 ms · penalty −40 | **optimal 22 ms · penalty −40** | feasible 5 s · penalty −40 (unproven) | 12/12 cohorts ≥ 4 courses | 52% | 2 affected, 3/3 probes feasible, re-solve optimal |
| University scale | 38 | 41 | 16 | 20 | 5 | optimal 258 ms · penalty −40 | **optimal 31 ms · penalty −40** | feasible 5 s · penalty −40 (unproven) | **20/20 cohorts ≥ 4 courses** | 64% | 2 affected, 3/3 probes feasible, re-solve optimal |

## Two engines, one contract: industrial CP-SAT vs an AI-crafted solver

**We used AI to build a second solver, not just to call one.** Alongside Google's engine, ScheduleGod ships a complete constraint solver designed and written for this problem — and because both live behind one standardized interface (`GET /engines`, `POST /solve` with `engine`, one `SolveResult` shape), you can choose either per solve, or race them head-to-head on the *exact* same messy constraints, preferences, and room capacities. Two independent implementations therefore cross-check each other on identical inputs, live.

**Second engine, built during the hackathon window.** The initial implementation used CP-SAT only. A domain-specialized engine was then developed against it: first a Python reference search, which matched CP-SAT's objective at department and university scale but exceeded its 5 s budget without an optimality proof; then a native C++17 search core (minimum-remaining-values ordering, unit propagation, live and pairwise-conflict admissible bounds). Measured on identical inputs, it returns the same proven objective at every scale with lower proof time (university: 31 ms vs 258 ms). The Build step ranks both engines from outputs alone (Rank 1 / Rank 2 + verdict). CP-SAT remains the general-purpose solver and still powers the emergency feasibility probes; the scope and limits of the comparison are documented in [docs/solver_evidence.md](./docs/solver_evidence.md).

- **OR-Tools CP-SAT** (`cpsat`): industrial brute force done right — C++, clause learning, cuts through the search space and returns a *mathematically proven* optimum in fractions of a second. Assumption literals give minimal conflict cores.
- **ScheduleGod native solver** (`ours`, `backend/native/schedulergod_solver.cpp` + `backend/app/solver/native_solver.py`): an AI-authored C++17 search core built for this problem — MRV over live domains, unit propagation, branch-and-bound with a live admissible bound plus a *pairwise-conflict bound* (contending sections whose cheapest options clash force a deviation cost), single/ejection hill-climbing, and deletion-minimization conflict cores with itself as oracle. Domains and penalties come from the identical preparation code CP-SAT uses, so the engines differ only in search. A Python reference implementation of the same algorithm (`backend/app/solver/home_solver.py`) is the readable specification and the fallback when the binary is unbuilt. No OR-Tools anywhere in either path.
- **Greedy descent** (`greedy`): the first descent only — plug-and-play proof that a new engine is one registry entry (`backend/app/solver/engine.py`); it shows exactly what the optimization phases buy.

**Head-to-head (measured, `scripts/benchmark.py`):** ours *proves the same optimum as CP-SAT at every scale, 3–8× faster* (university: optimal −40 in 31 ms vs 258 ms). The pure-Python reference reaches the same penalty but cannot prove optimality inside its 5 s budget at scale — that measured gap is exactly why the search core is native C++, and why the claim is scoped to this problem class (CP-SAT remains the better general solver; full analysis in [docs/solver_evidence.md](./docs/solver_evidence.md)). **Compare side by side** (Build step, or `POST /solve/compare`) diffs status, runtime, penalty delta, placement-agreement %, and both grids with differing sections ringed; the compare ranks engines from outputs only. Tests verify ours independently — hard constraints checked from placements alone, proven objective parity at all scales, the identical conflict core `[0,1,2]` on the Diaz overload, determinism (`backend/tests/test_native_solver.py`, `backend/tests/test_home_solver.py`).

At department scale every cohort still gets its four-course guarantee, every course has ≥2 qualified instructors, and the Chen emergency still re-homes exactly CS 301 + CS 310 with zero ripple. Locked in by `backend/tests/test_department.py`. Reproduce: `cd backend && .venv/bin/python scripts/benchmark.py`.

**Capacity showcase (university scale, one click in Build):** 5 degree programs (CS, Mathematics, Data Science, Business, Humanities) · 38 instructors · 41 sections · 20 cohorts · **530 students** on degree roadmaps · 16 rooms / 694 seats / 4 buildings with a walk-time matrix · 20 weekly slots per room — all of it solved as *one* institution sharing the same rooms and hours, not five toy departments side by side. That is the capacity a real registrar's office actually schedules.

**Coordinator-time impact:** the manual baseline this replaces is roughly a coordinator-week per term (~30–40 hours of email, spreadsheets, and rework, plus hours per mid-term disruption). ScheduleGod AI's measured loop is: one Muse parse (~8–25 s live), one CP-SAT solve (~0.15 s at department scale), and — per disruption — a probe-verified coverage decision in seconds. The honest claim is not "AI schedules for you"; it is that a week of constraint-wrangling compresses into an auditable review of solver-proven options.

## Meta AI tooling at runtime

**Every model this project calls at runtime is a Meta model**, via the Meta Model API. The deterministic core (the solver engines) is not a model — the LLM proposes, the solver proves. When no API key is present, all model roles degrade to deterministic templates (dev/tests cost zero credits).

**The role of Muse, stated plainly:**
- **Cleanse** — messy institutional files in any format (PDF, Word, Excel, CSV, text, zip) are extracted to text, and Muse Spark autocleans them into typed, solver-ready data for the entire institution.
- **Flag gaps** — the extraction feeds a deterministic completeness check over the six required inputs, so the coordinator is told exactly which requirement is missing before any solve is attempted.
- **Identify the fit** — who is qualified for what, which room fits which course (capacity, type, equipment), which cover fits an orphaned section: Muse proposes candidates, the solver's qualification/capacity model proves the fit.
- **Translate people** — free-text constraints ("can't teach Mondays", "Chen is out all week") become typed, validated operations a solver can reason about.
- **Evaluate the finals** — when both engines return optimal schedules, the platform ranks them from outputs alone (proven status → preference penalty → speed) as Rank 1 and Rank 2; Muse explains the verdict and breaks human ties among *verified* options — never inside the math.
- **Explain and repair** — when a solver proves a request impossible, Muse translates the proof into plain English and ranks the *proven* fixes by human disruption; typed tightening moves from a closed grammar, each re-solved before it can be shown.
- **Keep distribution explicit** — the objectives Muse's constraints feed are measurable per solve: balanced faculty loads and prep caps (fair distribution), every cohort's ≥4-course guarantee (degree progress), preference satisfaction, and room utilization per building.
- **Never decide** — no schedule, coverage, or repair stands because Muse said so. Every one is proven by an engine first.

| # | Runtime call | Model | Code | When it fires |
|---|---|---|---|---|
| 1 | Data ingestion → autoclean free-form institutional data into the structured scenario (structured output) | Muse Spark `muse-spark-1.3-contributor` | `backend/app/ingestion/parser.py` | you paste a catalog / degree maps / cohorts / faculty / rooms |
| 2 | Constraint parsing → typed operations (structured output) | Muse Spark `muse-spark-1.3-contributor` | `backend/app/parsing/parser.py` | every intake submission, chair request, emergency message |
| 3 | Self-healing explanation → conflict explanation + ranked resolutions (structured output) | Muse Spark `muse-spark-1.3-contributor` | `backend/app/agent/explainer.py` | whenever a solver proves a request infeasible |
| 4 | Intelligence tightening → typed repair moves (structured output) | Muse Spark `muse-spark-1.3-contributor` | `backend/app/intelligence/tightener.py` | spectral deadlock warning, C39 margin shortfall, or base infeasibility |
| 5 | Voice call-in → transcript that feeds the same emergency pipeline | Muse Voice Transcribe `muse-voice-transcribe-1.0` | `backend/app/services/voice.py` (`POST /emergency/audio`) | a coordinator phones in "Prof. Chen is out all week" instead of typing it |

**Set your key** (the repo ships `.env.example` — copy it to `.env` and fill in `MODEL_API_KEY`; `.env` is gitignored):

```bash
cp .env.example .env        # then paste your key from https://dev.meta.ai/dashboard
docker compose up --build   # live Muse Spark
```

**Sample outputs / provenance:** `backend/muse-verification.json` is a live captured run of all four structured roles against the seed (ingestion + parse + explanation + tighten), all `muse-spark-1.3-contributor`, with real structured outputs and latencies (3–42 s per call across the contributor and open-weights captures). The parse battery includes a speaker context for identity-dependent messages. `backend/muse-verification-voice.json` captures a live Muse Voice Transcribe run of the Chen call-in, Oct 29; spelled-out academic titles from speech recognition are normalized deterministically before parsing.

*All four structured roles run on the contributor model because the data is synthetic; a real institution would use standard mode (`muse-spark-1.3`) so no staff data ever trains Meta's models. Dev-time coding tools are unrestricted by the hackathon and touch nothing at runtime.*

**Open-weights path — verified live:** the client is endpoint-agnostic (`MUSE_BASE_URL` + `MUSE_MODEL`), and all four structured roles are verified running on **Muse Spark Open** (`meta-models/muse-spark-open-1026`) served by Baseten: `backend/muse-verification-open.json` captures 18/18 live calls (12 parse, 3 explanation, 2 tighten, 1 ingestion) with real structured outputs and latencies. To run the whole app on open weights, set `MUSE_BASE_URL=https://inference.baseten.co/v1`, `MUSE_MODEL=meta-models/muse-spark-open-1026`, and the Baseten key as `MODEL_API_KEY` — no code changes.

## Intelligence layer (scipy sparse + spectral + AI)

| Endpoint | What it returns |
|---|---|
| `GET /intelligence/matrices` | 8 labeled sparse matrices (scipy CSR): classroom (rooms×courses, seat headroom), fulfilment (cohorts×courses, depth-before-completion), demand, cohort_sections, faculty_availability (instructors×20 slots), faculty_blackouts, faculty_preferences, qualification. Departmental capacity heatmap + dead zones from stacking the faculty tensor. |
| `GET /intelligence/spectral` | Conflict-graph spectrum: Laplacian eigenvalues, algebraic connectivity μ₂, Hoffman chromatic lower bound, exact max clique (Bron-Kerbosch), Fiedler vector + 2-way partition, spectral ordering → **slot hints injected into CP-SAT as AddHint warm-start**. Deadlock warnings (structural infeasibility, clique > band capacity). |
| `GET /intelligence/margins` | C39 four-course guarantee audit against the placed timetable: per-cohort max non-overlapping course count, example track, offered pool, risk flag. |
| `POST /intelligence/tighten` | Muse proposes typed moves from closed grammar; CP-SAT re-solves each mutated scenario. Only *verified* moves returned, with their penalty deltas and new margins. |
| `GET /history` | The provenance ledger: every intake submission and change event (`parse` / `apply` / `drop` / `emergency` / `tighten`), surfaced in the **Audit Trail** tab. |

### Screens

**Audit trail** — every submission and change event, newest first, with the live `muse-spark` badge.

![Audit trail](docs/screenshot-audit.png)

## Stack

- **Backend:** Python / FastAPI, OR-Tools CP-SAT (assumption literals for minimal-conflict explanation, feasibility probes for coverage proposals, `AddHint` for spectral warm-start) **plus an AI-authored native C++ rival solver** (`backend/native/schedulergod_solver.cpp`, Python reference in `backend/app/solver/home_solver.py`), selectable per solve and comparable side by side
- **Multi-user:** SQLAlchemy accounts with PBKDF2 password hashes + hashed bearer sessions; coordinator / instructor / student roles; published schedules and instructor change requests in the same Postgres/SQLite store
- **Frontend:** Next.js
- **Intelligence:** `scipy.sparse` CSR matrices, `numpy`/`scipy` spectral graph (Laplacian, Fiedler, Hoffman bound, exact max clique)
- **Inference:** Meta Model API (OpenAI-compatible, `beta.chat.completions.parse` structured output) — deterministic mock parser included so dev/tests burn zero credits
- **Persistence:** SQLAlchemy over **Postgres 18** (Docker) or **SQLite** (no-Docker fallback) — constraint provenance + the self-healing audit trail (`/history`)
- **Deploy:** `docker compose up` (db + backend + frontend) or `./start.sh` for a no-Docker local run; public demo live on Modal (UI + backend, both scale-to-zero)

## Run it

**Judges — try it in 2 minutes, no account, no API key:**

```bash
git clone https://github.com/prohle/schedulegod-ai && cd schedulegod-ai
docker compose up --build
# open http://localhost:3000 — Import → Intake → Build → Review → Emergency
```

Without a key the model roles degrade to a deterministic mock parser, so every beat (parse → solve → self-heal → emergency coverage → department scale) is clickable offline at zero cost. Add `MODEL_API_KEY` (see below) and the same clicks run live Muse Spark with on-screen model + latency badges. Submission details, track, and bonus-prize flags: [docs/submission.md](./docs/submission.md).

**Multi-user, role-based:** the app opens on a login. One-click demo accounts (password `demo1234`, seeded from the scenario itself — no signup needed): `coordinator@schedulegod.demo` runs the term (wizard, publish, approves changes); `chen@schedulegod.demo` (any `<instructor-id>@…`) sees **only their own sections** in **My Schedule** and submits plain-language change requests; `cs2025@schedulegod.demo` (any `<cohort-id>@…`) sees **only their cohort's courses**. The coordinator publishes the solved timetable (`Publish current schedule`); instructors' grids update only when an approved change is re-proven by the solver and re-published — an infeasible request comes back rejected with the solver-backed explanation. You can also register your own account and link it to any instructor/cohort.

**Hosted demo (live now):** UI at **https://prohle--schedulegod-ai-ui-web.us-east.modal.run** and backend at https://prohle--schedulegod-ai-api.us-east.modal.run (`/status`, `/docs`, `/engines`; both scale-to-zero on Modal, warm them with one request). Deploy your own from [docs/deploy_modal.md](./docs/deploy_modal.md). The local one-command path is below.

**Full stack (one command):**

```bash
docker compose up --build
# frontend http://localhost:3000 · backend http://localhost:8000/docs · db postgres:5432
# taken ports?  BACKEND_PORT=8011 FRONTEND_PORT=3011 docker compose up --build
# live Muse?    MODEL_API_KEY=... docker compose up --build
```

**No Docker (local dev):**

```bash
./start.sh        # bootstraps venv + node_modules, auto-picks free ports, Ctrl-C stops both
```

**Backend only:**

```bash
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python demo.py            # full pipeline, mock parser, zero credits
.venv/bin/uvicorn app.main:app      # API at http://localhost:8000/docs
```

Set `MODEL_API_KEY` (from the [Meta Model API dashboard](https://dev.meta.ai)) to switch parsing from mock to live Muse Spark.

**Tests:**

```bash
cd backend
.venv/bin/pip install -r requirements.txt -r requirements-dev.txt
.venv/bin/python -m pytest -q
```

The suite covers solve determinism, hard-constraint satisfaction, the
minimal-conflict core, durable applied state (`/apply` then `/solve`), emergency
coverage, the spectral graph, and the API contract. GitHub Actions runs the
backend suite and a production frontend build on every push.

## What was built during the hackathon

Everything in this repository is new work from the Oct 27 – Nov 4 build window;
the commit history is the build log. The main pieces:

| Area | What | Where |
|---|---|---|
| Solver | CP-SAT timetable model, assumption-literal conflict cores, feasibility probes, durable pins | `backend/app/solver/` |
| Agent | Muse Spark parse → validate → solve → explain → **CP-SAT-verified** resolutions → apply | `backend/app/parsing/`, `backend/app/agent/`, `backend/app/services/` |
| Intelligence | Sparse matrices, Laplacian/Fiedler/Hoffman/max-clique radar, C39 audit, AI tightener | `backend/app/intelligence/` |
| Ingestion | Free-form institutional data → Muse extraction → deterministic normalizer → Scenario | `backend/app/ingestion/` |
| Scale | Department-cluster scenario (26 instructors / 25 sections / 12 cohorts) generated deterministically from the seed, one-click load, measured benchmark | `backend/app/data/department.py`, `backend/scripts/benchmark.py` |
| Agent trace | Every co-pilot/emergency response carries the step-by-step loop (actor per step); wizard renders it live | `agent_trace` in `backend/app/services/copilot.py`, `emergency.py` |
| UI | Guided wizard, visual timetable grid + before/after diff, Intelligence view, audit trail | `frontend/src/` |
| Ops | Docker Compose (Postgres + API + UI), one-command local runner, provenance ledger | `docker-compose.yml`, `start.sh`, `backend/app/db.py` |

## Status

Built during the hackathon (Oct 27 – Nov 4, 2026) — commit history is the build log. Internal working notes live in local files; the constraint catalog is the source of truth for the model, the parsing vocabulary, and the roadmap.

## Team

Solo entrant — **Huong Le**.

## License

MIT — see [LICENSE](./LICENSE).