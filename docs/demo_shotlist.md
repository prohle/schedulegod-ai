# 3:00 demo shot list — top-3 cut

Record against the **live** stack with `MODEL_API_KEY` set. Every model beat must
show `muse-spark` / `muse-voice-transcribe-1.0` and a latency badge. Do not ship
a `MOCK` cut.

Resolution 1440×900 (or 1920×1080). Cursor visible. No dead air longer than
1.5 s; fast-forward only solver waits, never the model badges.

| Time | Beat | On screen | Say / highlight |
|---|---|---|---|
| 0:00–0:15 | **The pain** | Start on the Import screen. Cut to a title card: “Every term, one coordinator. Thirty instructors. Four cohorts. One spreadsheet.” | “Every term, a department coordinator burns a week reconciling instructor constraints, degree roadmaps, rooms, and campus walk times — in a spreadsheet that is wrong the moment reality changes.” |
| 0:15–0:45 | **Import** | Drop the six files (`1-catalog` … `6-campus-map`). Show the `MUSE-SPARK · muse-spark-1.3-contributor · Xs` badge and the completeness panel. | “Point it at the data — catalog, degree maps, cohorts, faculty availability, rooms, campus distances. Muse Spark autocleans it into the typed model. No spreadsheet babysitting.” |
| 0:45–1:10 | **Intake** | Intake step. Set **Speaker = Prof. Patel**. Type *“I can’t teach Mondays — committee duty. Prefer mornings.”* Click **Parse & Re-solve**. Show the typed ops and the **“Applied to the term”** toast. | “The LLM never touches the schedule. It proposes typed constraints; CP-SAT re-solves and proves the ripple. One sentence, and the change is committed to the term.” |
| 1:10–1:30 | **Build + scale proof** | Next → Build → **Solve**. Show `OPTIMAL`, the visual grid. Then click **Load department scale** → Solve again: 26 instructors, 25 sections, 12 cohorts, still `OPTIMAL` (~150 ms). Click **Back to story seed** → Solve, then Review (spectral μ₂, C39). | “One solve: loads, prep caps, rooms, equipment, cohort conflicts, campus walk. And this is not a toy — full department cluster, twenty-six instructors, twelve cohorts, same engine, still optimal in a blink.” |
| 1:30–2:05 | **Emergency — voice** | Emergency step. Click **Record voice note** (or upload the WAV) and say *“Dr. Chen is out all week — who could cover her sections?”* Show the transcript, the ranked proposals, and the **Before / After** grids: only CS 301 and CS 310 change. | “A voice note is enough. Muse Voice Transcribe turns it into a request; the co-pilot probes every qualified instructor with CP-SAT. Only verified zero-ripple swaps are shown — Okafor on CS 301, Nguyen on CS 310, the rest of the board untouched.” |
| 2:05–2:25 | **Self-heal + agent trace** | Back to Intake. Type *“Diaz is taking over CS 101, MATH 201 and CS 201 personally.”* Show `INFEASIBLE`, the minimal conflict core, the Muse diagnosis, the **solver-verified resolutions**, and scroll the **Agent trace** panel (parse → validate → solve → conflict-core → diagnose → verify → apply → audit, actors badged). | “CP-SAT proves the conflict and names the minimal core. Muse translates the proof; every resolution is re-solved before it is shown. The least disruptive one applies — and the agent trace shows every step: who proposed, who proved.” |
| 2:25–2:40 | **Intelligence + audit** | Intelligence → Spectral Radar (μ₂, max clique, deadlock warnings). Then Audit Trail: `APPLY`, `EMERGENCY`, `INGEST` events, live `muse-spark` badges. | “Spectral graph theory predicts deadlocks before the solver runs. Every accepted change lands in the audit trail — who said what, when.” |
| 2:40–3:00 | **Close** | Architecture overlay: **Muse proposes → CP-SAT proves → audit trail**. Show `docker compose up` and the repo URL. | “Muse Spark, Muse Voice Transcribe, CP-SAT, and scipy. The model proposes; the solver proves; the coordinator stays in control. ScheduleGod AI.” |

## Recording checklist

- [ ] `MODEL_API_KEY` is set in the recording environment.
- [ ] `docker compose up --build` is healthy before recording.
- [ ] `POST /scenario/reset` before the first take.
- [ ] Every model badge says `muse-spark` / `muse-voice-transcribe-1.0`, never `MOCK`.
- [ ] The Build beat shows the department-scale solve (26 instructors / 25 sections) and returns to the story seed before Emergency.
- [ ] The self-heal beat shows the Agent trace panel with Muse Spark and CP-SAT actor badges.
- [ ] The emergency before/after shows only the affected sections ringed in amber.
- [ ] The self-heal shows the minimal core + at least one verified resolution.
- [ ] The Audit Trail shows `apply` and `emergency` events.
- [ ] Video is ≤ 3:00, audio is clear, cursor does not cover the proof.
- [ ] Upload the video, set the repo public, and submit before **Nov 4, 9:00 PM ET**.
