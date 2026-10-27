"""Deterministic offline parser — the mock fallback when no MODEL_API_KEY is set.

Not a model: a rule-based stand-in so the full pipeline (parse -> validate ->
solve -> self-heal) can be developed and demoed without API credits. The real
Muse Spark path lives in parser.py. Keep this file honest and clearly labeled.
"""

from __future__ import annotations

import re

from app.models.scenario import DAY_NAMES, Operation, ParsedRequest, Scenario

_DAY = {
    "monday": 0, "mon": 0, "tuesday": 1, "tue": 1, "tues": 1, "wednesday": 2, "wed": 2,
    "thursday": 3, "thu": 3, "thur": 3, "thurs": 3, "friday": 4, "fri": 4,
    "saturday": 5, "sat": 5, "sunday": 6, "sun": 6,
}
_SHIFT = {
    "day": "day", "days": "day", "daytime": "day",
    "evening": "evening", "eve": "evening", "evenings": "evening",
    "night": "night", "nights": "night", "tonight": "night", "nighttime": "night",
}

_DAY_RE = r"(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)"
_PAIR_RE = re.compile(rf"\b({_DAY_RE})\s+(day|days|evening|evenings|eve|night|nights|tonight)?\b")


def _mentioned_workers(message: str, scenario: Scenario):
    lower = message.lower()
    return [w for w in scenario.workers
            if re.search(rf"\b{re.escape(w.id)}\b", lower)
            or re.search(rf"\b{re.escape(w.name.lower())}\b", lower)]


def _find_day_shift_pairs(message: str):
    pairs = []
    for m in _PAIR_RE.finditer(message.lower()):
        day = _DAY[m.group(1)]
        shift = _SHIFT.get(m.group(2) or "")
        pairs.append((day, shift))
    return pairs


def mock_parse(message: str, scenario: Scenario) -> ParsedRequest:
    lower = message.lower()
    workers = _mentioned_workers(message, scenario)
    pairs = _find_day_shift_pairs(message)
    ops: list[Operation] = []
    summary_parts: list[str] = []

    # --- global rules -------------------------------------------------------
    rest = re.search(r"at least (\d+) hours?(?:\s+(?:of\s+)?rest|\s+between)", lower)
    if rest:
        v = int(rest.group(1))
        ops.append(Operation(op="add_hard_rule", rule_type="min_rest_hours", value=v,
                             explanation=f"Unit-wide minimum rest between shifts raised to {v} hours."))
        summary_parts.append(f"raise minimum rest to {v}h")

    consec = re.search(r"no more than (\d+) consecutive", lower)
    if consec:
        v = int(consec.group(1))
        ops.append(Operation(op="add_hard_rule", rule_type="max_consecutive_days", value=v,
                             explanation=f"Unit-wide cap of {v} consecutive working days."))
        summary_parts.append(f"cap consecutive days at {v}")

    # --- worker-specific requests -------------------------------------------
    if workers:
        w = workers[0]

        if re.search(r"\bswap\b", lower) and len(workers) >= 2 and pairs:
            day, shift = pairs[0]
            other = workers[1]
            ops.append(Operation(op="add_unavailability", worker_id=w.id, day=day, shift_type=shift,
                                 explanation=f"{w.name} is off {DAY_NAMES[day]}{' ' + shift if shift else ''} (swap)."))
            if shift is not None:
                ops.append(Operation(op="force_assignment", worker_id=other.id, day=day, shift_type=shift,
                                     explanation=f"{other.name} takes the {DAY_NAMES[day]} {shift} shift (swap)."))
            summary_parts.append(f"swap {w.name} with {other.name} on {DAY_NAMES[day]}")

        elif re.search(r"\b(?:can'?t|cannot|unavailable|out for)\b", lower):
            for day, shift in pairs:
                ops.append(Operation(op="add_unavailability", worker_id=w.id, day=day, shift_type=shift,
                                     explanation=f"{w.name} can't work {DAY_NAMES[day]}"
                                                 + (f" {shift}" if shift else " (whole day)") + "."))
            summary_parts.append(f"unavailability for {w.name}")

        elif re.search(r"\b(?:wants?|must|force|make)\b", lower):
            for day, shift in pairs:
                if shift is None:
                    continue
                ops.append(Operation(op="force_assignment", worker_id=w.id, day=day, shift_type=shift,
                                     explanation=f"{w.name} requested {DAY_NAMES[day]} {shift}."))
            summary_parts.append(f"assignment requests for {w.name}")

        else:
            pref = re.search(r"\b(\w+)\s+(?:hates|avoids?|prefers?|likes?)\s+(day|days|evening|evenings|eve|night|nights)\b", lower)
            if pref:
                shift = _SHIFT[pref.group(2)]
                kind = "avoid" if re.search(r"\b(?:hates|avoids?)\b", lower) else "prefer"
                ops.append(Operation(op="add_preference", worker_id=w.id, kind=kind, shift_type=shift,
                                     weight=6 if kind == "avoid" else 4,
                                     explanation=f"{w.name} {kind}s {shift} shifts."))
                summary_parts.append(f"preference for {w.name}")

    if not ops:
        return ParsedRequest(summary="(mock parser) No recognizable scheduling changes in this message.",
                             operations=[])

    return ParsedRequest(
        summary="Mock parse: " + "; ".join(summary_parts) + ".",
        operations=ops,
    )
