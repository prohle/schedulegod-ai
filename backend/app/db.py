"""Persistence: SQLAlchemy over Postgres (Docker) or SQLite (local dev).

The database holds constraint provenance — every intake submission and every
change event (parse / apply / drop / emergency / tighten) — the audit trail
that tells a coordinator "who said what, when". The deterministic solver core
never depends on it: every record call is best-effort, so the timetable keeps
solving even if the database is down.

`DATABASE_URL` selects the backend; unset it for a local SQLite file, or set
`postgresql://user:pass@db:5432/name` in Docker.
"""

from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./schedulegod.db")
if DATABASE_URL.startswith("postgres://"):  # SQLAlchemy wants postgresql://
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://"):]

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def init_db() -> None:
    """Create tables. Best-effort: importing `audit` registers the models, and
    a down database must never take the solver with it."""
    from app.models import audit  # noqa: F401  (register models)
    from app.models import auth  # noqa: F401  (users / schedules / requests)

    try:
        Base.metadata.create_all(bind=engine)
    except Exception:  # noqa: BLE001
        pass