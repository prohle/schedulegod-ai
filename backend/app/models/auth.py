"""Multi-user tables: accounts, sessions, published schedules, change requests.

Roles: coordinator (runs the term), instructor (sees and requests changes to
their own schedule), student (sees their cohort's timetable). Passwords are
PBKDF2-HMAC hashes (stdlib); session tokens are stored hashed, never raw.
Demo-grade auth for the hackathon: seeded demo accounts + open registration,
documented in the README. The solver core never depends on these tables.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(200), unique=True, nullable=False, index=True)
    password_hash = Column(String(300), nullable=False)
    role = Column(String(20), nullable=False)  # coordinator | instructor | student
    display_name = Column(String(200))
    instructor_id = Column(String(100))        # role=instructor: who they are
    cohort_id = Column(String(100))            # role=student: their cohort
    created_at = Column(DateTime, default=_utcnow)


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id = Column(Integer, primary_key=True)
    token_hash = Column(String(64), nullable=False, index=True)
    user_id = Column(Integer, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=_utcnow)


class PublishedSchedule(Base):
    """One published timetable: the scenario + solver result everyone reads."""

    __tablename__ = "published_schedules"

    id = Column(Integer, primary_key=True)
    scenario_json = Column(Text, nullable=False)
    timetable_json = Column(Text, nullable=False)
    engine = Column(String(40))
    objective = Column(Integer)
    status = Column(String(20))
    created_by = Column(String(200))
    created_at = Column(DateTime, default=_utcnow)


class ChangeRequest(Base):
    """An instructor's request to change their schedule, pending coordinator
    decision. Applying runs the verified co-pilot loop, never a raw edit.

    Two shapes share this queue: a free-text `message` (Muse parses it at
    decision time) or a structured intake — `operations` holds the exact
    typed operations the professor picked in the availability grid, verified
    as-is by the solver (no re-parse, no silent edits)."""

    __tablename__ = "change_requests"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    instructor_id = Column(String(100))
    message = Column(Text, nullable=False)
    operations = Column(Text)  # JSON list[Operation] for structured intake
    status = Column(String(20), default="pending")  # pending | applied | rejected
    result_summary = Column(Text)
    created_at = Column(DateTime, default=_utcnow)
    decided_at = Column(DateTime)
