"""Record provenance + the change/audit trail.

Best-effort by design: persistence is a ledger, not a dependency. If the
database is unavailable every call here is a no-op and the solver proceeds.
"""

from __future__ import annotations

import json
from typing import Any, Optional

from app.db import SessionLocal
from app.models.audit import Event, Submission


def record_submission(message: str, summary: Optional[str], parser_mode: str) -> None:
    try:
        with SessionLocal() as session:
            session.add(Submission(message=message, summary=summary, parser_mode=parser_mode))
            session.commit()
    except Exception:  # noqa: BLE001
        pass


def record_event(kind: str, description: str, payload: Optional[dict[str, Any]] = None) -> None:
    try:
        with SessionLocal() as session:
            session.add(Event(
                kind=kind, description=description,
                payload=json.dumps(payload) if payload is not None else None,
            ))
            session.commit()
    except Exception:  # noqa: BLE001
        pass


def history(limit: int = 200) -> dict[str, list[dict[str, Any]]]:
    try:
        with SessionLocal() as session:
            subs = session.query(Submission).order_by(Submission.id.desc()).limit(limit).all()
            evts = session.query(Event).order_by(Event.id.desc()).limit(limit).all()
            return {
                "submissions": [
                    {"id": s.id, "message": s.message, "summary": s.summary,
                     "parser_mode": s.parser_mode, "created_at": s.created_at.isoformat()}
                    for s in subs
                ],
                "events": [
                    {"id": e.id, "kind": e.kind, "description": e.description,
                     "payload": e.payload, "created_at": e.created_at.isoformat()}
                    for e in evts
                ],
            }
    except Exception:  # noqa: BLE001
        return {"submissions": [], "events": []}