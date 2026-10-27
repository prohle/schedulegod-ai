# ScheduleGod AI

**An agentic scheduling co-pilot that turns messy natural-language shift rules into deterministic OR-Tools constraints — with a self-healing agent that auto-debug infeasibilities for hospitals and field dispatch.**

Built for the **Meta Global AI Developer Hackathon** — *Build for Your World* track.

## The Problem

Scheduling in dynamic environments — such as hospital nursing shifts or field dispatch — is an NP-hard constraint satisfaction problem. Traditional solvers are mathematically rigid, forcing managers to spend hours manually translating messy human requirements into code or spreadsheets. Meanwhile, LLM chatbots that "help with scheduling" produce plausible-but-wrong output — unacceptable when a missed union rule means overtime penalties or an unsafe shift.

## Our Approach

We bridge unstructured human communication with deterministic optimization. **The LLM never touches the schedule — it only proposes constraints, and every constraint is verified against a deterministic solver.**

1. **Constraint Parsing** — Muse Spark (via Meta Model API) converts raw text (last-minute shift swaps, union rules, worker preferences) into structured JSON mathematical constraints.
2. **Hybrid Optimization Pipeline** — Parsed constraints feed into Google OR-Tools (MILP/CP-SAT) to guarantee mathematically valid, optimal schedule generation.
3. **Self-Healing Agent** — When the solver reports infeasibility, a Muse Code-powered agent inspects the conflicting constraints, diagnoses the failure in plain English, proposes minimal relaxations, and re-solves. Solver scripts run in isolated Modal Sandboxes.

## Meta Model Usage

| Model | Platform | Role |
|---|---|---|
| **Muse Spark** | Meta Model API | Natural-language → structured JSON constraint parsing |
| **Muse Spark Open** (`meta-models/muse-spark-open-1026`) | Baseten | Self-hosted open-weights inference for high-volume parsing |
| **Muse Code** | Agent layer | Inspect infeasible constraints, debug/refine solver logic in real time |
| **Muse Voice Transcribe** *(planned)* | Meta Model API | Nurses call in swap requests by voice |
| **Muse Glimmer / Muse Spark Open** *(planned)* | Modal Endpoints | Open-weights serving |

## Architecture

```
text / voice request
  → constraint parser (Muse Spark, structured JSON output)
  → JSON schema validation
  → OR-Tools MILP solver (Modal serverless functions)
  → optimal schedule ─ or ─ infeasibility report
  → self-healing agent loop (Muse Code + Modal Sandboxes)
  → Next.js UI
```

## Stack

- **Backend:** Python / FastAPI, OR-Tools (MILP / CP-SAT)
- **Solver compute & agent sandboxes:** Modal — serverless jobs, async queues, sandboxes
- **Inference:** Meta Model API + Baseten (Muse Spark Open `-1026`)
- **Frontend:** Next.js

## Status

Built during the hackathon (Oct 27 – Nov 4, 2026). See commit history for the full build log. Internal build plan and submission notes: [PLANNING.md](./PLANNING.md).
