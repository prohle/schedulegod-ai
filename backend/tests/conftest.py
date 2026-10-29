import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import app


@pytest.fixture(autouse=True)
def offline_muse(monkeypatch):
    """Tests must be deterministic and burn zero credits."""
    monkeypatch.setattr(config, "MUSE_API_KEY", None)


@pytest.fixture()
def client():
    c = TestClient(app)
    c.post("/scenario/reset")
    yield c
    c.post("/scenario/reset")
