#!/usr/bin/env python3
"""Day 1 — Muse runtime verification battery.

Confirms the three Muse Spark runtime roles (parse / explanation / tighten)
work live against the seed scenario, and captures traces. Run from
`backend/` so `app.*` resolves:  .venv/bin/python scripts/verify_muse.py

Each role is exercised through its real code path:
- parse:      structured-output call (same prompt + schema as parser.py)
- explanation:  run_copilot on infeasible messages (fires Muse after CP-SAT
              proves the conflict core)
- tighten:    run_tightener (Muse proposes typed moves, CP-SAT verifies)

Output: muse-verification.json + a line per call to stdout.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

# Running `python scripts/verify_muse.py` puts scripts/ (not backend/) on
# sys.path; add the backend root so `app.*` imports resolve.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from openai import OpenAI

from app import config
from app.ingestion.parser import IngestionParser
from app.main import load_seed_scenario
from app.models.scenario import ParsedRequest
from app.parsing.prompts import build_system_prompt
from app.services.copilot import run_copilot
from app.intelligence import run_tightener

# (message, speaker_id): identity-dependent messages get the intake speaker
# context, exactly like the UI's speaker picker.
PARSE_MSGS = [
    ("I can't teach Mondays — committee duty. Prefer mornings.", "patel"),
    ("Dr. Chen is out all next week.", None),
    ("Diaz is taking over CS 101, MATH 201 and CS 201 personally.", None),
    ("CS 350 enrollment jumped to 45 after registration ended.", None),
    ("Prof. Patel would rather not teach before 10.", None),
    ("East lab is closed for renovation all October.", None),
    ("Move the intro lecture to the big hall, the small one is packed.", None),
    ("Dr. Lee is covering for Dr. Okafor in CS 220.", None),
    ("Keep me under 3 preps, and no Fridays.", "nguyen"),
    ("I'd love CS 310 — committee Wed 2-4.", "nguyen"),
    ("The CS 2025 cohort tested out of MATH 201.", None),
    ("CS 210 needs another section.", None),
]

DIAG_MSGS = [
    "Diaz is taking over CS 101, MATH 201 and CS 201 personally.",
    "Dr. Chen is taking CS 301, CS 310 and CS 350 personally.",
    "CS 350 enrollment jumped to 200 after registration ended.",
]

SAMPLE_DUMP = """Course catalog:
CS 101 Intro to Programming — MWF, lecture, 50 seats, projector
MATH 201 Calculus I — MWF, lecture, 45 seats, projector
CS 201 Data Structures — MWF, lecture, 45 seats, projector
CS 210 Systems Lab — block, lab, 26 seats, computers
CS 301 Algorithms — MWF, lecture, 26 seats, whiteboard
CS 310 Operating Systems — TTh, lecture, 25 seats, lecture-capture
CS 350 Machine Learning — MWF, lecture, 26 seats
CS 401 Capstone — MWF, seminar, 25 seats, video-conf

Faculty:
Dr. Chen teaches CS 301, CS 310
Prof. Patel teaches CS 101, MATH 201
Dr. Diaz teaches CS 101, MATH 201, CS 201 — unavailable Fridays; prefers mornings
Dr. Okafor teaches CS 201, CS 301, CS 350 (max 3 sections)
Prof. Lee teaches CS 210, CS 401
Dr. Nguyen teaches CS 310, CS 401, CS 301, CS 350

Degree map (BSc Computer Science):
term 1: CS 101 (required)
term 3: CS 201 (required), MATH 201 (required)
term 5: CS 210 (required), CS 301 (required), CS 350 (elective)
term 7: CS 310 (required), CS 401 (required)

Cohorts:
CS 2026 (BSc Computer Science, class of 2030), term 1, 50 students
CS 2025 (BSc Computer Science, class of 2029), term 3, 45 students
CS 2024 (BSc Computer Science, class of 2028), term 5, 26 students
CS 2023 (BSc Computer Science, class of 2027), term 7, 25 students

Rooms:
Science Hall 120 — 120 seats, lecture, projector, lecture-capture
Science 101 — 36 seats, lecture, whiteboard
Science Lab 1 — 30 seats, lab, computers
Engineering 201 — 45 seats, lecture, projector
Engineering Lab 2 — 28 seats, lab, computers
Library Seminar — 30 seats, seminar, video-conf

Campus map:
Science, Engineering, Library
Science to Engineering: 8 min
Science to Library: 6 min
Engineering to Library: 9 min
"""


def main() -> None:
    scenario = load_seed_scenario()
    client = OpenAI(
        base_url=config.MUSE_BASE_URL, api_key=config.MUSE_API_KEY,
        timeout=config.MUSE_TIMEOUT_S,
    )
    out: dict = {"model": config.MUSE_MODEL, "base_url": config.MUSE_BASE_URL,
                 "parse": [], "explanation": [], "tighten": [], "ingestion": []}

    def muse_parse(msg: str, speaker_id: str | None = None) -> dict:
        t = time.time()
        try:
            r = client.beta.chat.completions.parse(
                model=config.MUSE_MODEL,
                messages=[
                    {"role": "system", "content": build_system_prompt(scenario, speaker_id)},
                    {"role": "user", "content": msg},
                ],
                response_format=ParsedRequest,
            )
            p = r.choices[0].message.parsed
            return {
                "ok": True, "s": round(time.time() - t, 1),
                "summary": p.summary if p else None,
                "ops": [o.op for o in (p.operations if p else [])],
                "speaker_id": speaker_id,
            }
        except Exception as e:  # noqa: BLE001 — battery must never die mid-run
            return {"ok": False, "s": round(time.time() - t, 1), "err": str(e)[:120]}

    print("=== PARSE ===", flush=True)
    for m, sid in PARSE_MSGS:
        r = muse_parse(m, sid)
        out["parse"].append({"msg": m, **r})
        tag = "OK " if r["ok"] else "FAIL"
        print(f"[parse] {tag} {r['s']:>4}s  {m}", flush=True)
        if r["ok"]:
            print(f"         {r['summary']}  |  ops={r['ops']}", flush=True)
        else:
            print(f"         ERROR: {r['err']}", flush=True)

    print("\n=== EXPLANATION (run_copilot on infeasible requests) ===", flush=True)
    for m in DIAG_MSGS:
        t = time.time()
        try:
            resp = run_copilot(scenario, m)
            dt = time.time() - t
            ok = resp.explanation_mode == "muse-spark" and bool(resp.explanation)
            status = resp.result.status if resp.result else "?"
            out["explanation"].append({
                "msg": m, "ok": ok, "s": round(dt, 1),
                "mode": resp.explanation_mode, "status": status,
                "explanation": (resp.explanation or "")[:160],
            })
            print(f"[diag] {'OK ' if ok else 'CHECK'} {dt:.1f}s  mode={resp.explanation_mode} "
                  f"status={status}", flush=True)
            print(f"        {(resp.explanation or '')[:150]}", flush=True)
        except Exception as e:  # noqa: BLE001
            out["explanation"].append({"msg": m, "ok": False, "err": str(e)[:120]})
            print(f"[diag] FAIL  {m}: {e}", flush=True)

    print("\n=== INGESTION (free-form institutional dump) ===", flush=True)
    t = time.time()
    try:
        parser = IngestionParser()
        data = parser.parse(SAMPLE_DUMP)
        dt = time.time() - t
        ok = parser.mode == "muse-spark" and bool(data.courses) and bool(data.cohorts)
        out["ingestion"].append({
            "ok": ok, "s": round(dt, 1), "mode": parser.mode,
            "model": parser.model, "latency_ms": parser.last_latency_ms,
            "courses": len(data.courses), "instructors": len(data.instructors),
            "cohorts": len(data.cohorts), "rooms": len(data.rooms),
            "degree_map": len(data.degree_map), "buildings": len(data.buildings),
        })
        print(f"[ingest] {'OK ' if ok else 'CHECK'} {dt:.1f}s mode={parser.mode} "
              f"courses={len(data.courses)} instructors={len(data.instructors)} "
              f"cohorts={len(data.cohorts)} rooms={len(data.rooms)} "
              f"degree={len(data.degree_map)}", flush=True)
    except Exception as e:  # noqa: BLE001
        out["ingestion"].append({"ok": False, "s": round(time.time() - t, 1), "err": str(e)[:120]})
        print(f"[ingest] FAIL {e}", flush=True)

    print("\n=== TIGHTEN (run_tightener, base C39 shortfall) ===", flush=True)
    for i in range(2):
        t = time.time()
        r = run_tightener(scenario, [])
        dt = time.time() - t
        ok = r.muse_mode == "muse-spark"
        out["tighten"].append({
            "i": i, "ok": ok, "s": round(dt, 1), "mode": r.muse_mode,
            "trigger": r.trigger, "moves": len(r.moves),
            "verified": sum(1 for m in r.moves if m.verified),
        })
        print(f"[tighten] {'OK ' if ok else 'CHECK'} {dt:.1f}s  mode={r.muse_mode} "
              f"trigger={r.trigger} moves={len(r.moves)} "
              f"verified={sum(1 for m in r.moves if m.verified)}", flush=True)

    import os
    out_path = os.getenv("VERIFY_OUT", "muse-verification.json")
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2, default=str)
    print(f"\nSaved {out_path}", flush=True)


if __name__ == "__main__":
    main()