"""Constraint parser: natural-language request -> typed operations.

Real path: Muse Spark via Meta Model API with structured output
(JSON-schema-constrained decoding), so the model can only emit operations
that validate against the Pydantic contract.

Mock path: deterministic rule-based parser (no API key / credits needed) so
the full pipeline is testable offline from day one.

Either way, every operation passes `validate_operations` before it may touch
the solver — the LLM never gets the benefit of the doubt.
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
            self._client = OpenAI(base_url=config.MUSE_BASE_URL, api_key=config.MUSE_API_KEY)

    def parse(self, message: str, scenario: Scenario) -> ParsedRequest:
        if self._client is None:
            return mock_parse(message, scenario)

        system = build_system_prompt(scenario)
        try:
            kwargs = dict(
                model=config.MUSE_MODEL,
                messages=[
                    {"role": "system", "content": system},
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
            # Real model call failed (params, credits, schema, transient) —
            # degrade gracefully to the deterministic mock so the pipeline
            # keeps working; surface the failure in logs.
            logger.exception("Muse Spark parse failed; falling back to mock parser")
            return mock_parse(message, scenario)


def validate_operations(ops: list[Operation], scenario: Scenario) -> tuple[list[Operation], list[str]]:
    """Drop operations that don't reference real roster members or required fields.

    Returns (valid_ops, notes). This is the hallucination firewall: a
    nonexistent worker id or malformed op never reaches the solver.
    """
    roster = scenario.worker_ids()
    valid: list[Operation] = []
    notes: list[str] = []
    for i, op in enumerate(ops):
        needs_worker = op.op in ("add_unavailability", "force_assignment", "add_preference")
        if needs_worker:
            if not op.worker_id or op.worker_id not in roster:
                notes.append(f"Dropped operation {i}: unknown worker '{op.worker_id}'.")
                continue
        if op.op == "add_unavailability" and op.day is None:
            notes.append(f"Dropped operation {i}: unavailability needs a day.")
            continue
        if op.op == "force_assignment" and (op.day is None or op.shift_type is None):
            notes.append(f"Dropped operation {i}: assignment needs day + shift_type.")
            continue
        if op.op == "add_hard_rule" and (not op.rule_type or op.value is None):
            notes.append(f"Dropped operation {i}: hard rule needs rule_type + value.")
            continue
        if op.op == "add_preference" and not op.kind:
            notes.append(f"Dropped operation {i}: preference needs kind (prefer|avoid).")
            continue
        valid.append(op)
    return valid, notes
