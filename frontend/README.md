# ScheduleGod AI — Frontend

Next.js 16 UI for ScheduleGod AI: a **Guided Wizard** (simple, step-by-step)
and **Expert views** (master timetable, faculty, DAG, cohort demand, student
audits, intelligence).

## The two interfaces

- **Guided** (default) — step-by-step wizard: Intake → Build → Review → Emergency.
- **Expert** — the full view set in the left sidebar, including **Intelligence**
  (spectral radar, C39 four-course guarantee, real CP-SAT solve, and
  Muse-proposed / CP-SAT-verified tightening moves).

Switch modes with the **Guided / Expert** toggle at the bottom of the sidebar.

## Run it

The UI talks to the Python backend through its `/api/*` route handlers, which
proxy to the FastAPI service. Start both:

```bash
# 1. backend (FastAPI + OR-Tools CP-SAT)
cd backend && .venv/bin/uvicorn app.main:app --port 8000

# 2. frontend (Next.js)
cd frontend && npm install && npm run dev
```

Open http://localhost:3000. The backend URL defaults to
`http://localhost:8000`; override it with `BACKEND_URL=http://host:port`.

If the backend isn't reachable, the **Intelligence** view shows a clear
"Backend not reachable" state with a retry button; the Guided wizard and the
other views still work standalone against the in-browser demo data.

## Scripts

```bash
npm run dev     # dev server
npm run build   # production build (typechecks + bundles)
npm run start   # serve the production build
npm run lint    # eslint
```