# ScheduleGod AI — 3-minute demo script

> Target: **top prize**. Every beat is backed by a live, deterministic CP-SAT
> solve and a live Muse Spark call (parse / diagnosis / tighten). Long solver
> or model steps are fast-forwarded in the video; the on-screen text is real
> output (see `backend/demo.py`, `backend/scripts/verify_muse.py`, and
> `backend/muse-verification.json`).

## Beat 1 — The pain (0:00–0:20)

**Visual:** spreadsheet with 30 instructor emails, sticky notes, a crossed-out
room list.

**Narration:** "Every term, a department coordinator burns a week reconciling
thirty instructors' constraints, four cohorts' degree roadmaps, room
capacities, and campus walk times — in a spreadsheet that's wrong the moment
reality changes. Scheduling is NP-hard. This is ScheduleGod AI."

## Beat 2 — Import → Build (0:20–1:20)

**Visual:** the Guided wizard, **Import** step: paste the free-form dump (course
catalog, degree maps, cohorts, faculty, rooms). Click **Auto-clean & Prepare**.

**Narration:** "Point the tool at your data — catalog, degree maps, cohorts,
faculty, rooms — in whatever messy shape it arrives. Muse Spark autocleans it
into the structured model. No spreadsheet babysitting."

**On-screen:** the structured counts (8 courses, 6 instructors, 4 cohorts, 7
rooms). Then the **Build** step → **Solve** → `OPTIMAL` + the placements grid.
Then the **Sparse Matrices** and **Spectral Radar** tabs.

## Beat 3 — Emergency (1:10–2:10)

**Visual:** Emergency step. Type: *"Dr. Chen is out all week — who could cover
her sections?"*

**Narration:** "Reality breaks the term mid-flight. The co-pilot doesn't guess
who can cover — it probes every qualified instructor with CP-SAT and ranks the
zero-ripple swaps."

**On-screen:** ranked proposals with `feasible` / `objective_delta` /
`load_after`; the chosen candidate; the timetable morphing. Show the audit
trail (`/history`) lighting up with the `emergency` event.

## Beat 4 — Self-heal (2:10–2:40)

**Visual:** Intake step. Type: *"Diaz is taking over CS 101, MATH 201 and CS
201 personally."*

**Narration:** "Infeasible. CP-SAT proves it and names the minimal conflict
core — Diaz's load cap. Muse Spark translates the proof into ranked
resolutions; every one is re-solved before it's shown; the least disruptive
one applies."

**On-screen:** the diagnosis + the solver-verified resolution options, then
the **AI Tightening** tab: Muse proposes typed moves, CP-SAT verifies each
(accepted and rejected moves shown).

## Beat 5 — Architecture (2:40–3:00)

**Visual:** the diagram.

**Narration:** "Muse Spark parses, diagnoses, and tightens — but it never
decides the schedule. OR-Tools CP-SAT proves every answer, scipy spectral
graph theory predicts deadlocks before they happen, and Postgres keeps the
audit trail. One command brings it all up: `docker compose up`."

**On-screen:** the three containers (`db` / `backend` / `frontend`) and the
`docker compose up --build` command.

---

## Recording checklist

- [ ] `docker compose up --build` boots cleanly (db healthy → backend → frontend)
- [ ] Muse calls show live `muse-spark` mode (or `mock` if no key — say so)
- [ ] Each beat's output matches the script (re-record any drift)
- [ ] Fast-forward long solves; keep the typed-ops and verification visible
- [ ] 3:00 max — trim Beat 1 first if over