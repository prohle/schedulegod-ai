# Internal Planning & Submission Notes

> Working notes — not part of the judge-facing README. Kept in the repo for build transparency.

## Application Answers

### What will you build?

Scheduling in dynamic environments—such as hospital nursing shifts or field dispatch—is an NP-hard constraint satisfaction problem. Traditional solvers are mathematically rigid, forcing managers to spend hours manually translating messy human requirements into code or spreadsheets.

**Technical Architecture & Implementation:**

I will build an agentic scheduling co-pilot that bridges unstructured human communication with deterministic optimization:

- **Constraint Parsing:** Leverages Meta Model API to convert raw text (e.g., last-minute shift swaps, union rules, worker preferences) into structured JSON mathematical constraints.
- **Hybrid Optimization Pipeline:** Feeds parsed constraints into Google OR-Tools / PuLP to guarantee mathematically valid, optimal schedule generation.
- **Self-Healing Agent:** Integrates Muse Code agent to inspect infeasible constraints, debug LP/MILP solver errors in real time, and dynamically refine script logic when schedule conflicts arise.

**Theme Fit:** Build for Your World — Reclaiming operational bandwidth by replacing manual, high-friction administrative work with a natural-language optimization agent.

**One-liner:** An agentic scheduling co-pilot that turns messy natural-language shift rules into deterministic OR-Tools constraints — with a self-healing agent that auto-debug infeasibilities for hospitals and field dispatch.

### What are you building and how will you use Baseten?

I'm building an agentic scheduling co-pilot that converts messy, natural-language shift requirements — last-minute swaps, union rules, worker preferences — into structured JSON constraints, then feeds them into OR-Tools for mathematically valid, optimal schedules. A self-healing agent layer inspects infeasible constraints and debugs solver errors in real time. I'll use Baseten's serverless inference to serve **Muse Spark Open** (`meta-models/muse-spark-open-1026`) as our self-hosted open-weights inference layer for high-volume constraint parsing, giving us the low latency and autoscaling needed for real-time schedule generation without managing GPU infrastructure myself.

### What are you building and how will you use Modal?

I'm building an agentic scheduling co-pilot that converts natural-language shift requirements (swaps, union rules, preferences) into structured constraints and solves them with OR-Tools for optimal schedules, with a self-healing agent that auto-debug infeasibilities. I'll use Modal to host the optimization backend: containerized OR-Tools solver functions that burst CPU/RAM for hard MILP workloads, FastAPI endpoints for the co-pilot UI, and async job queues orchestrating the parse → solve → self-heal loop so long-running solves never block the user. Modal's fast cold starts and per-second billing make it ideal for bursty, demo-driven scheduling requests.

### Modal onboarding selections

- ✅ **Sandboxes** — the self-healing agent needs to safely execute and debug the solver scripts it writes/refines; Modal Sandboxes are isolated ephemeral environments built exactly for running LLM-generated code
- ✅ **Other:** "Serverless compute for OR-Tools MILP optimization jobs, async job queues, and FastAPI web endpoints for an agentic scheduling co-pilot"
- ⚠️ Inference on open-weight models via Endpoints — only if we end up serving Muse models on Modal instead of Baseten

## Strategy Notes

### Model naming (Stage 1 pass/fail gate)

The hackathon guide never mentions Llama — everything is Muse-branded. Stage 1 judging is pass/fail on "reasonably used Meta Model API and/or Meta's open-weight models." If the stack says "Llama," the project risks failing the gate before anyone sees it. Architecture uses only Muse models:

| Role | Earlier plan | Corrected plan |
|---|---|---|
| Constraint parsing (runtime) | Llama on Baseten | Muse Spark via Meta Model API ($150 credits) |
| Self-hosted inference (fallback/scale) | Llama | Muse Spark Open on Baseten — use `meta-models/muse-spark-open-1026`, not the plain model in their docs |
| Open-weights serving on Modal | generic endpoints | Muse Glimmer / Muse Spark Open via Modal Endpoints (that's what the $100 credits are for) |
| Self-healing agent | "Muse Code agent" | Muse Code — **verify how it can be invoked (runtime API vs dev-time tool) before betting the demo on it** |

### Positioning

- **Track:** "Build for Your World" — hospital/field-dispatch scheduling is exactly the "problem you know firsthand" story. Don't drift into "Push the Frontier" territory.
- Not on the anti-project list — the moat is exactly what the banned "Basic RAG Applications" lack: a deterministic solver the LLM can't hallucinate past. Lean into this: "The LLM never touches the schedule — it only writes constraints, and every constraint is verified against OR-Tools." That's the answer to the #1 judge skepticism (hallucination in high-stakes ops).
- Attend the Oct 28 session — "Best Practices for Verifiable Agents" is the project's exact thesis. Borrow the terminology for the README and video.
- ⚠️ Stay operational. Scheduling is fine; anything edging toward clinical advice (staffing → patient outcomes) brushes the banned medical-advice category. Keep it about shifts and constraints.

### Credits & accounts (claim ASAP)

1. **$150 Meta Model API credits** — individual, requires a card on file (temp pre-auth charge), batched distribution. Set the spend-limit notification at $150.
2. **Baseten $100** — reviewed by use case, capped at 2,000. Strong one-liner in the form: running Muse Spark Open -1026 for an agentic scheduling co-pilot.
3. **Modal $100** — first 1,000 participants. Act now.
4. Join Discord, intro in #intros, decide solo vs team (max 4).
5. Commit constantly — commit history is the proof-of-new-work.

### 8-day build plan (Oct 27 – Nov 4)

- **Oct 26–27:** Credits claimed, hello-world Meta API call, repo, end-to-end skeleton: text → Muse Spark → JSON constraints → OR-Tools → schedule
- **Oct 28–29:** Self-healing loop — solver returns infeasibility → agent diagnoses the conflicting rules in plain English → proposes the fix → re-solves. This is the demo centerpiece.
- **Oct 30–Nov 1:** Multimodal differentiators, in priority order: Muse Voice Transcribe (nurse calls in a swap request) → Muse Image (photograph a whiteboard schedule → parsed constraints).
- **Nov 2–3:** UI polish, README with model-usage table, record the video.
- **Nov 4:** Final office hours, submit hours before the 9 PM ET cutoff.

### 3-minute video structure

1. **0:00–0:20** The pain: a charge nurse spends hours wrestling swaps, union rules, and preferences in spreadsheets
2. **0:20–1:30** Live core loop: messy text request → constraints → optimal schedule regenerated in seconds
3. **1:30–2:15** Infeasible request → agent explains the conflict in plain English → proposes fix → re-solves
4. **2:15–3:00** Voice/whiteboard input + architecture overlay naming Muse Spark, Muse Voice Transcribe, and the open-weights deployment explicitly (Stage 1 insurance)

### Open question

The actual Stage 2 rubric tables are redacted in the participant guide. Check the CV platform for the real criteria — if "technical difficulty" is weighted heavily, the MILP + verification story is strong; if "impact" dominates, spend more video time on the nurse's before/after.
