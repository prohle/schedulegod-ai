# ScheduleGod AI — 3-minute demo script

> Target: **top prize**. Every beat is backed by a live, deterministic CP-SAT
> solve and a live Muse Spark call (parse / explanation / tighten). Long solver
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

**Visual:** the Guided wizard, **Import** step: drop the six messy files — PDF catalog, Word degree map, CSV cohorts,
faculty email text, Excel room sheet, Markdown campus map. Click **Auto-clean & Prepare**.

**Narration:** "Point the tool at your data — catalog, degree maps, cohorts,
faculty, rooms — in whatever messy shape it arrives. Every format is extracted to text first;
Muse Spark autocleans it into the structured model of the whole institution. No spreadsheet babysitting."

**On-screen:** the structured counts (courses, instructors, cohorts, rooms —
whatever Muse extracted). Then the **Build** step → **Solve** → `OPTIMAL` + the **visual
timetable grid** (days × periods, colored sections, 3h block badge). Then the
**Sparse Matrices** and **Spectral Radar** tabs.

## Beat 3 — Emergency (1:10–2:10)

**Visual:** Emergency step. The message *"Dr. Chen is out all week — who could
cover her sections?"* is pre-filled; click **Handle Emergency**. The agent
trace (impact → probe → choose → re-solve) and ranked proposals appear.

**Narration:** "Reality breaks the term mid-flight. One typed message is
enough: the co-pilot doesn't guess who can cover — it probes every qualified
instructor with the solver and ranks the zero-ripple swaps."

**On-screen:** ranked proposals with `feasible` / `objective_delta` /
`load_after`; the chosen candidate; the **Before / After grids** with changed
sections ringed in amber; the "Emergency applied" toast. Then the **Audit
Trail** tab showing the `emergency` and `apply` events land in the ledger.

## Beat 4 — Self-heal (2:10–2:40)

**Visual:** Intake step. Type: *"Diaz is taking over CS 101, MATH 201 and CS
201 personally."*

**Narration:** "Infeasible. CP-SAT proves it and names the minimal conflict
core — Diaz's load cap. Muse Spark translates the proof into ranked
resolutions; every one is re-solved before it's shown; the least disruptive
one applies."

**On-screen:** the explanation + the **solver-verified resolution options**
(each with `status` + penalty), then the **AI Tightening** tab: Muse proposes
typed moves, CP-SAT verifies each (accepted and rejected moves shown). Point
at the live `muse-spark` / model / latency badge so the 25% Meta criterion is
visible on screen.

## Beat 5 — Architecture (2:40–3:00)

**Visual:** the diagram.

**Narration:** "Muse Spark parses, explains, and tightens — but it never
decides the schedule. OR-Tools CP-SAT proves every answer, scipy spectral
graph theory predicts deadlocks before they happen, and Postgres keeps the
audit trail. One command brings it all up: `docker compose up`."

**On-screen:** the three containers (`db` / `backend` / `frontend`) and the
`docker compose up --build` command.

---

## Recording checklist

- [ ] `docker compose up --build` boots cleanly (db healthy → backend → frontend)
- [ ] **Record with `MODEL_API_KEY` set** — every Muse beat shows `muse-spark`,
      the model id, and latency. Do not ship a `MOCK` video for the 25% criterion.
- [ ] Each beat's output matches the script (re-record any drift)
- [ ] Fast-forward long solves; keep the typed-ops and verification visible
- [ ] 3:00 max — trim Beat 1 first if over