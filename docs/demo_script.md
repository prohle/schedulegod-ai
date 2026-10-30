# ScheduleGod AI — demo video script (live Puppeteer screencast)

> The shipped video is a **real-time Puppeteer screencast** of the running
> application (`local-demo/record_live.js`, CDP `Page.startScreencast`),
> not a screenshot slideshow. Each beat is time-compressed to its narration
> length by `local-demo/assemble_live.py`, so live Muse latency appears as
> a fast-forward. Narration is synthesized locally with the 05-media
> Chatterbox pipeline (`dee_us` reference, diction-weighted) and gated by
> faster-whisper transcription checks. Recorded with `MODEL_API_KEY` set —
> every Muse beat shows the live `muse-spark` badge, never `MOCK`.

## Beats (7 + end card, ≈2:55 total)

1. **Ingestion** — coordinator demo login → Import: six files (PDF/DOCX/CSV/
   TXT/XLSX/MD) → Muse Spark autoclean → typed institutional model,
   completeness-checked.
2. **Intake** — "Prof. Patel can't teach Mondays — committee duty" →
   schema-validated operations, applied to the term.
3. **Dual-engine ranking** — Build → Solve → **Compare side by side**:
   CP-SAT vs the AI-developed native engine on identical inputs; verdict
   banner ranks Rank 1 / Rank 2 from outputs alone (status → penalty →
   speed). University numbers cited in narration: 31 ms vs 258 ms to the
   same proven objective (`docs/solver_evidence.md`).
4. **University scale + publish** — Load university scale (38 instructors,
   41 sections, 20 cohorts, 5 programs) → coordinator publishes the
   verified timetable.
5. **Role-based change** — sign in as Prof. Chen: only her sections visible →
   "I can't teach Fridays" change request → coordinator approves →
   co-pilot re-solves, schedule re-publishes, her grid updates.
6. **Mid-term emergency** — "Prof. Chen is out all week" → feasibility probes
   over every qualified instructor → ranked zero-ripple coverage →
   before/after grids, agent trace visible.
7. **Capacity planning** — Intelligence → Planning → "20% growth" what-if
   re-solved with utilization/guarantee deltas; closing frame.

Narration text: `local-demo/narration.txt` (one paragraph per beat).

## Recording checklist

- [ ] Stack up with live key (`./start.sh --prod`), scenario reset, fresh DB
- [ ] `cd local-demo && BASE_URL=http://localhost:3021 node record_live.js`
- [ ] `python3 narrate.py --voice dee_us --cfg 2.8 --expr 0.15` + whisper gate
- [ ] `python3 assemble_live.py live-final.mp4` (≤3:00), spot-check frames:
      beat 3 verdict banner, beat 6 emergency result, beat 5 applied request
- [ ] Upload as the `demo-video` release asset; YouTube upload uses the same file
