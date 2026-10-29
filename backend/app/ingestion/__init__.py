"""Data ingestion: free-form institutional data -> solver Scenario.

`ingest(text)` runs the Muse Spark (or mock) parser and assembles a `Scenario`
via the deterministic normalizer. This is the "point the tool at messy data"
step: catalog, degree maps, cohorts, faculty, campus, facilities -> clean
structured model -> CP-SAT schedules -> the audit trail monitors.
"""

from app.ingestion.normalize import build_scenario
from app.ingestion.parser import IngestionParser, mock_ingest
from app.models.ingestion import InstitutionData
from app.models.scenario import Scenario

__all__ = ["IngestionParser", "mock_ingest", "build_scenario", "ingest"]


def ingest(text: str) -> tuple[Scenario, InstitutionData]:
    data = IngestionParser().parse(text)
    return build_scenario(data), data