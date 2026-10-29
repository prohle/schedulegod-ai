#!/usr/bin/env python3
"""Day 1 — Muse runtime verification battery.

Confirms the three Muse Spark runtime roles (parse / diagnosis / tighten)
work live against the seed scenario, and captures traces. Run from
`backend/` so `app.*` resolves:  .venv/bin/python scripts/verify_muse.py

Each role is exercised through its real code path:
- parse:      structured-output call (same prompt + schema as parser.py)
- diagnosis:  run_copilot on infeasible messages (fires Muse after CP-SAT
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
from app.main import load_seed_scenario
from app.models.scenario import ParsedRequest
from app.parsing.prompts import build_system_prompt
from app.services.copilot import run_copilot
from app.intelligence import run_tightener

PARSE_MSGS = [
    "I can't teach Mondays — committee duty. Prefer mornings.",
    "Dr. Chen is out all next week.",
    "Diaz is taking over CS 101, MATH 201 and CS 201 personally.",
    "CS 350 enrollment jumped to 45 after registration ended.",
    "Prof. Patel would rather not teach before 10.",
    "East lab is closed for renovation all October.",
    "Move the intro lecture to the big hall, the small one is packed.",
    "Dr. Lee is covering for Dr. Okafor in CS 220.",
    "Keep me under 3 preps, and no Fridays.",
    "I'd love CS 310 — committee Wed 2-4.",
    "The CS 2025 cohort tested out of MATH 201.",
    "CS 210 needs another section.",
]

DIAG_MSGS = [
    "Diaz is taking over CS 101, MATH 201 and CS 201 personally.",
    "Dr. Chen is taking CS 301, CS 310 and CS 350 personally.",
    "CS 350 enrollment jumped to 200 after registration ended.",
]


def main() -> None:
    scenario = load_seed_scenario()
    client = OpenAI(
        base_url=config.MUSE_BASE_URL, api_key=config.MUSE_API_KEY,
        timeout=config.MUSE_TIMEOUT_S,
    )
    out: dict = {"parse": [], "diagnosis": [], "tighten": []}

    def muse_parse(msg: str) -> dict:
        t = time.time()
        try:
            r = client.beta.chat.completions.parse(
                model=config.MUSE_MODEL,
                messages=[
                    {"role": "system", "content": build_system_prompt(scenario)},
                    {"role": "user", "content": msg},
                ],
                response_format=ParsedRequest,
            )
            p = r.choices[0].message.parsed
            return {
                "ok": True, "s": round(time.time() - t, 1),
                "summary": p.summary if p else None,
                "ops": [o.op for o in (p.operations if p else [])],
            }
        except Exception as e:  # noqa: BLE001 — battery must never die mid-run
            return {"ok": False, "s": round(time.time() - t, 1), "err": str(e)[:120]}

    print("=== PARSE ===", flush=True)
    for m in PARSE_MSGS:
        r = muse_parse(m)
        out["parse"].append({"msg": m, **r})
        tag = "OK " if r["ok"] else "FAIL"
        print(f"[parse] {tag} {r['s']:>4}s  {m}", flush=True)
        if r["ok"]:
            print(f"         {r['summary']}  |  ops={r['ops']}", flush=True)
        else:
            print(f"         ERROR: {r['err']}", flush=True)

    print("\n=== DIAGNOSIS (run_copilot on infeasible requests) ===", flush=True)
    for m in DIAG_MSGS:
        t = time.time()
        try:
            resp = run_copilot(scenario, m)
            dt = time.time() - t
            ok = resp.diagnosis_mode == "muse-spark" and bool(resp.diagnosis)
            status = resp.result.status if resp.result else "?"
            out["diagnosis"].append({
                "msg": m, "ok": ok, "s": round(dt, 1),
                "mode": resp.diagnosis_mode, "status": status,
                "diagnosis": (resp.diagnosis or "")[:160],
            })
            print(f"[diag] {'OK ' if ok else 'CHECK'} {dt:.1f}s  mode={resp.diagnosis_mode} "
                  f"status={status}", flush=True)
            print(f"        {(resp.diagnosis or '')[:150]}", flush=True)
        except Exception as e:  # noqa: BLE001
            out["diagnosis"].append({"msg": m, "ok": False, "err": str(e)[:120]})
            print(f"[diag] FAIL  {m}: {e}", flush=True)

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

    with open("muse-verification.json", "w") as f:
        json.dump(out, f, indent=2, default=str)
    print("\nSaved muse-verification.json", flush=True)


if __name__ == "__main__":
    main()