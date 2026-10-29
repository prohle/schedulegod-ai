"""Completeness check: which scheduling inputs are present vs missing.

Six inputs are required to build a schedule: degree catalog, degree maps,
student bodies, faculty availability, facilities, and a campus map. Each maps
to a field on the extracted `InstitutionData`; a missing one blocks schedule
building and is reported back to the coordinator.
"""

from __future__ import annotations

from app.models.ingestion import CompletenessReport, DataCheck, InstitutionData

# (key, human label, InstitutionData field it maps to)
REQUIRED_DATA: list[tuple[str, str, str]] = [
    ("degree_catalog", "Degree catalog", "courses"),
    ("degree_maps", "Degree maps", "degree_map"),
    ("student_bodies", "Student bodies", "cohorts"),
    ("faculty", "Faculty availability", "instructors"),
    ("facilities", "Facilities", "rooms"),
    ("campus_map", "Campus map", "buildings"),
]


def check_completeness(data: InstitutionData) -> CompletenessReport:
    checks: list[DataCheck] = []
    for key, label, field in REQUIRED_DATA:
        items = getattr(data, field) or []
        checks.append(DataCheck(key=key, label=label, provided=bool(items), count=len(items)))
    return CompletenessReport(
        checks=checks,
        missing=[c.label for c in checks if not c.provided],
        complete=all(c.provided for c in checks),
    )