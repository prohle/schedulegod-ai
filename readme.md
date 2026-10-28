# ScheduleGod AI

**Every term, every department rediscovers that the course timetable is an NP-hard constraint problem managed with email and spreadsheets.**

Thirty instructors with hard constraints ("never Tuesdays, committee duty"), soft preferences ("mornings, please"), teaching-load and prep caps. Four cohorts at different points of the same degree roadmap — the CS 2025 cohort needs CS 201 *this term* or forty-five students slip a semester. A fixed inventory of rooms across a campus you can't cross in ten minutes between classes. And one coordinator whose calendar bleeds a week, every term, translating all of it into a spreadsheet that is wrong the moment reality changes.

**ScheduleGod AI is the agentic co-pilot for that week.** Natural language goes in — Muse Spark parses it into typed constraints — and a deterministic CP-SAT engine guarantees the output: a provably feasible timetable, minimal-conflict diagnosis when a request can't hold, and when reality breaks the term mid-flight (an instructor drops out, a hall closes), the co-pilot doesn't guess who can cover. **It proves it.**

> The LLM never touches the schedule. It only proposes constraints, and every
> constraint — and every coverage proposal — is verified by a solver.

Built for the **Meta Global AI Developer Hackathon** — *Build for Your World* track. This is the problem we know firsthand.

## How it works

```
INTAKE     each instructor gets a window with a deadline:
           free-text constraints -> Muse Spark (structured output)
           -> typed hard/soft constraints -> validated -> provenance stored
BUILD      CP-SAT assigns every section an instructor, timeslot set, and room:
           qualification, loads, prep caps, room capacity/type, meeting
           patterns, cohort conflicts, campus walk distances, preferences
OPERATE    an emergency arrives (text or voice):
           impact analysis -> propose_candidates: every qualified instructor
           CP-SAT-probed for zero-ripple feasibility + preference delta,
           ranked with plain-English reasons -> pick -> timetable morphs
```

When a request set is infeasible, the solver doesn't just fail — every
incoming constraint is guarded by a CP-SAT *assumption literal*, so the model
returns the **minimal conflicting subset** of the request, the self-healing
agent drops the most recently stated conflict, explains the drop, and
re-solves.

Full constraint catalog (offerings & degree roadmaps, cohort progression,
instructor hard/soft schedules, rooms, campus walk matrix): [docs/constraint_catalog.md](./docs/constraint_catalog.md)

## What a demo sounds like

| Who says | What happens |
|---|---|
| "Prof. Patel can't teach Mondays — committee duty." | Both her sections legally re-home to other instructors; a third section moves to keep the CS 2025 cohort conflict-free. One sentence, three-section ripple, all solver-verified. |
| "Dr. Chen is out all week — who could cover her sections?" | Two affected sections. Ranked, CP-SAT-verified coverage proposals — *Okafor (qualified, load 1/2, no preference cost)* over *Nguyen (qualified, +8 preference penalty)* — chosen, re-solved. |
| "Diaz is taking over CS 101, MATH 201 and CS 201 personally." | INFEASIBLE — Diaz's load cap is two sections. The conflict core names all three pins; the agent drops the latest, explains, re-solves to optimal. |

## Meta models in the core

| Model | Where | Role |
|---|---|---|
| **Muse Spark** (`muse-spark-1.3-contributor`) | Meta Model API | Constraint parsing via structured output — intake-window submissions, chair requests, emergency transcripts |
| **Muse Voice Transcribe** (`muse-voice-transcribe-1.0`) *(planned)* | Meta Model API | Emergency calls: a chair calls it in; the transcript becomes constraints |
| **Muse Spark Open** (`muse-spark-open-1026`) *(optional)* | any OpenAI-compatible endpoint | Self-hosted open-weights parsing at scale — the client is endpoint-agnostic (Baseten / Modal / vLLM) |
| **Muse Code** | dev-time | Co-authoring the solver + diagnosis layer |

*Parsing runs on the contributor model because all demo data is synthetic; a
real institution would use standard mode so no staff data ever trains Meta's
models.*

## Stack

- **Backend:** Python / FastAPI, OR-Tools CP-SAT (assumption literals for minimal-conflict diagnosis, feasibility probes for coverage proposals)
- **Frontend:** Next.js
- **Inference:** Meta Model API (OpenAI-compatible, `beta.chat.completions.parse` structured output) — mock parser included so dev/tests burn zero credits
- **Persistence (planned):** SQLite — constraint provenance + change log
- **Deploy:** local-first demo; free-tier hosting (HF Spaces / Render for the API, Vercel for the UI) — Modal if partner credits arrive

## Run the offline demo

```bash
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python demo.py            # full pipeline, mock parser, zero credits
.venv/bin/uvicorn app.main:app      # API at http://localhost:8000/docs
```

Set `MODEL_API_KEY` (from the [Meta Model API dashboard](https://dev.meta.ai)) to switch
parsing from mock to live Muse Spark.

## Status

Built during the hackathon (Oct 27 – Nov 4, 2026) — commit history is the build log. Internal working notes live in local files; the constraint catalog is the source of truth for the model, the parsing vocabulary, and the roadmap.
