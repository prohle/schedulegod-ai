# Submission packet — Meta Global AI Developer Hackathon

Copy-paste source for the CV platform form. Deadline: **Wed Nov 4, 9:00 PM ET**
(claim Meta credits by the same time). One submission per team.

## Form fields

| Field | Value |
|---|---|
| Project name | ScheduleGod AI |
| Track | **Indie Developer** (solo entrant) |
| Problem statement | **Build for Your World** — the course-timetabling week every department coordinator loses, every term |
| Team | Solo — Huong Le |
| Repo (public) | https://github.com/prohle/schedulegod-ai |
| Demo video (≤3:00) | https://github.com/prohle/schedulegod-ai/releases/download/demo-video/final.mp4 (2:51 live Puppeteer screencast, re-recorded Oct 30 on the current Express/Full interface) — _upload the same file to YouTube and add that link here too_ |
| Live demo | **https://prohle--schedulegod-ai-ui-web.us-east.modal.run** (full UI, no account/key; backend API: https://prohle--schedulegod-ai-api.us-east.modal.run/docs) — or judges run `docker compose up` (no key, no account — see README "Judges — try it in 2 minutes") |
| X post (Most Viral) | _paste link after posting; engagement counts until Nov 8 EOD. Ready copy below — attach `final.mp4`_ |

**X post (ready to publish, attach the video):**
> Every term, one coordinator loses a week to the course timetable. ScheduleGod AI takes the messy files as they are — PDF, Word, Excel, plain text — and returns a *proven* timetable for the whole university. The AI proposes. The solver proves. Our own C++ solver then out-proves CP-SAT 8× faster on the same answer. Live demo + full build log in the replies. #BuildForYourWorld
>
> Reply 1: Live demo (one tap, no account): https://prohle--schedulegod-ai-ui-web.us-east.modal.run
> Reply 2: Code + evidence: https://github.com/prohle/schedulegod-ai

**One-liner:** An agentic co-pilot that turns natural-language scheduling
constraints into a provably feasible university timetable — Muse Spark
proposes typed constraints, OR-Tools CP-SAT proves every schedule, coverage
swap, and repair before it can stand.

**Short description (form):**
Every term, a department coordinator burns a week reconciling instructor
constraints, degree roadmaps, room capacities, and campus walk times in a
spreadsheet that is wrong the moment reality changes. ScheduleGod AI replaces
that week: paste or drop the institution's messy data and Muse Spark
autocleans it into a typed model; type one sentence ("Prof. Patel can't teach
Mondays — committee duty") and Muse parses it into validated constraints
while CP-SAT re-solves and proves the ripple; when reality breaks mid-term, a
one typed message ("Prof. Chen will no longer teach this term") triggers CP-SAT probes of every
qualified instructor and only zero-ripple-verified coverage is shown. When a
request is infeasible, CP-SAT names the minimal conflicting subset, Muse
translates the proof into ranked resolutions, and CP-SAT re-solves every one
before the least disruptive is auto-applied. At department scale (26
instructors, 25 sections, 12 cohorts, 3 programs) the same engine solves
optimally in ~150 ms with the four-course guarantee holding for all 12
cohorts. The LLM never touches the schedule — it proposes; the solver proves;
every step is in the audit trail.

## Pitch (canonical — use this text for the video narration and the form)

Think back to when you were a student. Just registering for your classes was
an exercise in survival. You're juggling your degree roadmap, trying to
graduate on time, working a weekday job, and praying prerequisites don't
collide so you don't slip a semester. Getting your schedule right was hard
enough.

But what happens when you step into the registrar's chair? Suddenly, you
aren't solving for one schedule — you're building the heartbeat for an
entire university. You need to satisfy thousands of students navigating
graduation roadmaps, keep dozens of faculty happy with load caps and
committee duties, and maximize fixed room capacities across a campus you
can't cross in ten minutes.

Right now, universities solve this NP-hard combinatorial puzzle with email
threads, guesswork, and spreadsheets that are broken the moment reality
changes. To fix this for the Meta Hackathon, we built ScheduleGod AI.

Here is how it works. You point the tool at messy institutional files in any
format — PDF catalogs, Word degree maps, Excel room sheets, or plain text.
Muse Spark autocleans and organizes them into cleaned structured data
representing the entire institution: for each degree roadmap, current
student bodies, current faculty load requirements, faculty preference and
availability, each cohort based on real map and lab facility availability,
offerings and room sizes.

Our NP-hard problem is then passed into three registered solver engines:
Google's industrial CP-SAT, an AI-authored native C++ rival solver we built
specifically for this problem class during the hackathon period which
proves the same optima up to eight times faster, and a greedy baseline that
shows what the optimization phases buy. The two proving engines race
head-to-head on identical data.

At university scale — 38 instructors, 41 sections, 20 cohorts sharing rooms
and walk-time matrices — both engines return a mathematically proven,
conflict-free institutional timetable in milliseconds. The engines are
ranked from their outputs alone, and Muse Spark presents that verdict to
users. Users can request a re-run after keeping or refining the current
schedule. What happens when reality breaks mid-flight?

When Professor Chen will no longer teach this term — a change that lasts
through the end of the semester — the system doesn't collapse into panic.
It runs solver-verified coverage probes over every qualified instructor,
ranking them by preference and load delta. It proposes a zero-ripple fix
and re-solves instantly. The same is true when the university wants to
repurpose classrooms, add classes, or build more buildings for expansion.

If a coordinator tries an impossible override, the system uses assumption
literals to isolate the minimal conflict core. Muse Spark explains the
deadlock in plain English, and every single proposed repair is re-proven by
the solver before the agent is allowed to show it. The app is multi-user
role-filtered, backed by Postgres, and cuts weeks of manual coordinating
data to an auditable, sub-second review of solver-proven options.

We took the universal pain of student scheduling, scaled it to
university grade, and married Meta's open-weights intelligence with hard
deterministic mathematics. Check out the live demo and the native C++
engine source code on GitHub. Thank you.

## Meta AI tooling used (runtime — every runtime model is a Meta model)

| Role | Model | Where |
|---|---|---|
| Ingestion autoclean → typed scenario | Muse Spark `muse-spark-1.3-contributor` | `backend/app/ingestion/parser.py` |
| Constraint parsing → typed operations | Muse Spark `muse-spark-1.3-contributor` | `backend/app/parsing/parser.py` |
| Self-heal explanation → ranked resolutions | Muse Spark `muse-spark-1.3-contributor` | `backend/app/agent/explainer.py` |
| Intelligence tightening → typed repair moves | Muse Spark `muse-spark-1.3-contributor` | `backend/app/intelligence/tightener.py` |

Live captured proof: `backend/muse-verification.json` (all structured roles,
real outputs + latencies). No-key fallback is a deterministic mock parser, so
judges can click every beat offline.

## Bonus prizes — what to flag

- **Best Agentic Use-Case ($5K) — CLAIM.** The co-pilot runs an autonomous
  multi-step loop with tool use and self-correction: parse → validate →
  solve → minimal-conflict-core → explain → verify-every-resolution →
  auto-apply → re-solve → audit (up to 5 healing rounds), plus term change
  probe-and-choose across every qualified instructor. Every response carries
  the `agent_trace`; Express renders it live. That is the claim evidence.
- **Most Viral Project ($20K) — CLAIM VIA X.** Post the 3-min demo on X,
  submit the post link on the platform; winner = total engagement
  (likes + reposts + comments) through **Nov 8 EOD**. Post at submission
  time, not after judging starts.
- **Community Vote ($10K) — automatic.** Project appears in the public
  gallery; winner announced Nov 16. Share the gallery link with the X post.
- **Best Build on Meta Open Weight Models ($10K) — CLAIM (verified Oct 29).**
  All four structured roles run on **Muse Spark Open**
  (`meta-models/muse-spark-open-1026`) served by Baseten ($100 hackathon
  credit, 2M TPM). Live captured proof: `backend/muse-verification-open.json`
  — 18/18 calls (12 parse, 3 explanation, 2 tighten, 1 ingestion) against
  `https://inference.baseten.co/v1`, real structured outputs + latencies.
  The swap is env-only (`MUSE_BASE_URL` + `MUSE_MODEL` + the Baseten key as
  `MODEL_API_KEY`); recording with it makes the on-screen badge read
  `muse-spark · meta-models/muse-spark-open-1026`.
- **Best Creative Build ($5K) — do not claim** (no Muse Image/Wonder surface;
  a false flag wastes reviewer attention).

## How this maps to the rubric (Stage 2)

| Criterion (weight) | Evidence a judge can check in <5 min |
|---|---|
| Impact (30%) | Coordinator-week → minutes, quantified in README "Proof at university scale" + benchmark script; real domain (degree roadmaps, walk matrix, prep caps), 3 programs / 12 cohorts |
| Use of Meta AI tooling (25%) | 4 runtime Muse Spark roles (ingest, parse, explain, tighten) + Muse Voice Transcribe endpoint, live badges (model + latency) on screen, `muse-verification.json` + `muse-verification-open.json`, agent trace names Muse at every proposing step |
| Technical depth & execution (20%) | AI-authored **native C++ rival solver proving CP-SAT's optimum 3–8× faster** at every scale (docs/solver_evidence.md, benchmark + parity tests), CP-SAT assumption-literal minimal conflict cores, feasibility probes, spectral (Laplacian/Fiedler/Hoffman/max-clique) warm-start + deadlock radar, C39 guarantee audit, **multi-user roles** (coordinator/instructor/student logins, published schedules, verified change requests, per-professor structured intake grid + term closures), 47 passing tests, CI |
| Demo (25%) | Working live stack (`docker compose up`, Postgres 18), before/after zero-ripple term change, solver-verified resolutions, department-scale solve in the Build step |

## What was built during the hackathon (Oct 27 – Nov 4)

Everything in the repo — solver, agent loop, intelligence layer, ingestion,
UI, ops (Docker/Postgres 18), tests. Commit history is the build log.

## Pre-submit checklist

- [x] All work committed and pushed; repo public and cloneable
- [x] `docker compose up --build` boots cleanly (db Postgres 18 → backend → frontend; verified Oct 30 with port overrides — UI 200, proxied scenario, both engines `optimal` penalty −6 inside the containers, native binary built in-image)
- [x] Backend tests pass (`cd backend && .venv/bin/python -m pytest -q` — 47 tests, verified Oct 30)
- [x] Frontend production build passes (`cd frontend && npm run build`, verified Oct 30)
- [x] Video ≤ 3:00 (2:51), recorded live Oct 30 on the current interface — frame-checked: every badge says `muse-spark`, never `MOCK`
- [x] Video shows, in order: any-format import autoclean (PDF/DOCX/CSV/TXT/XLSX/MD) → Patel intake applied to the term → **dual-engine compare at department scale, Rank 1 / Rank 2 from outputs (native solver first)** → university scale (38/41/20, asserted on screen) + publish → Chen change request approved and re-published → term change with agent trace + ranked verified reassignment → Diaz impossible override (conflict core + verified repairs) → capacity what-ifs + end card
- [x] Live demo deployed (Modal UI + API; full checklist in `docs/deploy_modal.md` verified live Oct 30: `/status`, reset, Patel copilot `muse-spark`, Chen term change probes, live voice transcription) — scenario left reset to seed
- [ ] Meta credits claimed (deadline Nov 4, 9:00 PM ET); spend limit set — **account action**
- [ ] X post published with video + repo + gallery links; post link submitted (Most Viral cutoff Nov 8 EOD) — **account action** (copy ready above)
- [ ] YouTube upload of `final.mp4`; link added to the video field above — **account action**
- [ ] Submitted on the CV platform before **Nov 4, 9:00 PM ET** — not at 8:59 — **account action**
