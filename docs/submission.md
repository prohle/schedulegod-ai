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
| Demo video (≤3:00) | https://github.com/prohle/schedulegod-ai/releases/download/demo-video/final.mp4 (2:55 live Puppeteer screencast, Oct 29) — _upload the same file to YouTube and add that link here too_ |
| Live demo | **https://prohle--schedulegod-ai-ui-web.us-east.modal.run** (full UI, no account/key; backend API: https://prohle--schedulegod-ai-api.us-east.modal.run/docs) — or judges run `docker compose up` (no key, no account — see README "Judges — try it in 2 minutes") |
| X post (Most Viral) | _paste link after posting; engagement counts until Nov 8 EOD_ |

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
one typed message ("Prof. Chen is out all week") triggers CP-SAT probes of every
qualified instructor and only zero-ripple-verified coverage is shown. When a
request is infeasible, CP-SAT names the minimal conflicting subset, Muse
translates the proof into ranked resolutions, and CP-SAT re-solves every one
before the least disruptive is auto-applied. At department scale (26
instructors, 25 sections, 12 cohorts, 3 programs) the same engine solves
optimally in ~150 ms with the four-course guarantee holding for all 12
cohorts. The LLM never touches the schedule — it proposes; the solver proves;
every step is in the audit trail.

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
  auto-apply → re-solve → audit (up to 5 healing rounds), plus emergency
  probe-and-choose across every qualified instructor. Every response carries
  the `agent_trace`; the wizard renders it live. That is the claim evidence.
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
| Impact (30%) | Coordinator-week → minutes, quantified in README "Proof at department scale" + benchmark script; real domain (degree roadmaps, walk matrix, prep caps), 3 programs / 12 cohorts |
| Use of Meta AI tooling (25%) | 4 runtime Muse Spark roles (ingest, parse, explain, tighten) + Muse Voice Transcribe endpoint, live badges (model + latency) on screen, `muse-verification.json` + `muse-verification-open.json`, agent trace names Muse at every proposing step |
| Technical depth & execution (20%) | AI-authored **native C++ rival solver proving CP-SAT's optimum 3–8× faster** at every scale (docs/solver_evidence.md, benchmark + parity tests), CP-SAT assumption-literal minimal conflict cores, feasibility probes, spectral (Laplacian/Fiedler/Hoffman/max-clique) warm-start + deadlock radar, C39 guarantee audit, **multi-user roles** (coordinator/instructor/student logins, published schedules, verified change requests), 42 passing tests, CI |
| Demo (25%) | Working live stack (`docker compose up`, Postgres 18), before/after zero-ripple emergency, solver-verified resolutions, department-scale solve in the Build step |

## What was built during the hackathon (Oct 27 – Nov 4)

Everything in the repo — solver, agent loop, intelligence layer, ingestion,
UI, ops (Docker/Postgres 18), tests. Commit history is the build log.

## Pre-submit checklist

- [ ] All work committed and pushed; repo public and cloneable
- [ ] `docker compose up --build` from a clean clone boots cleanly (db Postgres 18 → backend → frontend)
- [ ] Backend tests pass (`cd backend && .venv/bin/python -m pytest -q` — 42 tests from repo root)
- [ ] Frontend production build passes (`cd frontend && npm run build`)
- [ ] Video ≤ 3:00, recorded with `MODEL_API_KEY` set — every badge says `muse-spark`, never `MOCK` (see `docs/demo_shotlist.md`)
- [ ] Video shows, in order: any-format import autoclean (PDF/DOCX/CSV/XLSX/TXT/MD) → Patel intake applied to the term → Build solve → **university-scale solve + dual-engine compare** → emergency with before/after → Diaz self-heal with verified resolutions + agent trace → audit trail
- [ ] Live demo deployed (Modal + Vercel per `docs/deploy_modal.md`) OR README quickstart verified from a clean clone
- [ ] Meta credits claimed (deadline Nov 4, 9:00 PM ET); spend limit set
- [ ] X post published with video + repo + gallery links; post link submitted (Most Viral cutoff Nov 8 EOD)
- [ ] Submitted on the CV platform before **Nov 4, 9:00 PM ET** — not at 8:59
