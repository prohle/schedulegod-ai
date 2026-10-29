"""Constraint parser: natural-language request -> typed operations.

Real path: Muse Spark via Meta Model API with structured output
(JSON-schema-constrained decoding via `beta.chat.completions.parse`),
defaulting to `muse-spark-1.3-contributor` (frugal; content trains future
Meta models — fine for synthetic data, flip to `muse-spark-1.3` for real
institutional data).

Mock path: deterministic rule-based parser — full pipeline with zero credits.

Either way, every operation passes `validate_operations` before it may
touch the solver — the LLM never gets the benefit of the doubt.
"""

from __future__ import annotations

import logging
from typing import Optional

from app import config
from app.models.scenario import Operation, ParsedRequest, Scenario
from app.parsing.mock import mock_parse
from app.parsing.prompts import build_system_prompt

logger = logging.getLogger(__name__)


class ConstraintParser:
    def __init__(self) -> None:
        self.mode: str = "mock" if not config.MUSE_API_KEY else "muse-spark"
        self._client = None
        if config.MUSE_API_KEY:
            from openai import OpenAI  # imported lazily so mock mode needs no SDK
            self._client = OpenAI(
                base_url=config.MUSE_BASE_URL, api_key=config.MUSE_API_KEY,
                timeout=config.MUSE_TIMEOUT_S)

    def parse(self, message: str, scenario: Scenario) -> ParsedRequest:
        if self._client is None:
            return mock_parse(message, scenario)

        try:
            kwargs = dict(
                model=config.MUSE_MODEL,
                messages=[
                    {"role": "system", "content": build_system_prompt(scenario)},
                    {"role": "user", "content": message},
                ],
                response_format=ParsedRequest,
            )
            if config.MUSE_REASONING_EFFORT:
                kwargs["reasoning_effort"] = config.MUSE_REASONING_EFFORT
            response = self._client.beta.chat.completions.parse(**kwargs)
            parsed: Optional[ParsedRequest] = response.choices[0].message.parsed
            if parsed is None:
                raise ValueError("model returned no parsed content")
            logger.info("muse-spark parse ok (model=%s)", config.MUSE_MODEL)
            return parsed
        except Exception:
            logger.exception("Muse Spark parse failed; falling back to mock parser")
            return mock_parse(message, scenario)


def validate_operations(ops: list[Operation], scenario: Scenario) -> tuple[list[Operation], list[str]]:
    """Drop operations that reference unknown people/rooms/sections or miss
    required fields. The hallucination firewall before the solver."""
    instructor_ids = {i.id for i in scenario.instructors}
    room_ids = {r.id for r in scenario.rooms}
    section_ids = {s.id for s in scenario.sections}
    valid: list[Operation] = []
    notes: list[str] = []
    for i, op in enumerate(ops):
        if op.op in ("add_instructor_unavailability", "add_instructor_preference", "remove_instructor",
                     "set_section_instructor"):
            if not op.instructor_id or op.instructor_id not in instructor_ids:
                notes.append(f"Dropped operation {i}: unknown instructor '{op.instructor_id}'.")
                continue
        if op.op == "add_room_unavailability":
            if not op.room_id or op.room_id not in room_ids:
                notes.append(f"Dropped operation {i}: unknown room '{op.room_id}'.")
                continue
        if op.op == "set_section_instructor":
            if not op.section_id or op.section_id not in section_ids:
                notes.append(f"Dropped operation {i}: unknown section '{op.section_id}'.")
                continue
        if op.op == "update_enrollment":
            if not op.section_id or op.section_id not in section_ids or not op.value:
                notes.append(f"Dropped operation {i}: enrollment update needs section_id + value.")
                continue
        if op.op == "add_instructor_preference" and op.day is None and op.period is None:
            notes.append(f"Dropped operation {i}: preference needs a day or a period.")
            continue
        if op.op == "add_instructor_unavailability" and op.day is None and op.period is None:
            notes.append(f"Dropped operation {i}: unavailability needs a day or period.")
            continue
        valid.append(op)
    return valid, notes
