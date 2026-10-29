"""API contract tests: the commit step must survive a subsequent solve."""

from __future__ import annotations


def test_health(client):
    assert client.get("/health").json()["status"] == "ok"


def test_apply_then_solve_keeps_patel_off_monday(client):
    copilot = client.post("/copilot", json={
        "message": "Prof. Patel can't teach Mondays — committee duty. "
                   "She'd rather not teach at 8:00."}).json()
    assert copilot["applied_operations"]

    applied = client.post("/apply", json={"operations": copilot["applied_operations"]})
    assert applied.status_code == 200
    assert applied.json()["instructors"][1]["hard_unavailable"]

    solved = client.post("/solve", json={"scenario": client.get("/scenario").json(),
                                         "operations": []}).json()
    patel = [p for p in solved["timetable"]["placements"]
             if p["instructor_id"] == "patel" and 0 in p["days"]]
    assert not patel


def test_emergency_apply_removes_instructor_for_good(client):
    emergency = client.post("/emergency", json={
        "message": "Dr. Chen is out all week — who could cover her sections?"}).json()
    assert emergency["chosen"]

    applied = client.post("/apply", json={
        "pins": emergency["chosen"],
        "remove_instructor_id": emergency["removed_instructor_id"],
    }).json()
    assert not [i for i in applied["instructors"] if i["id"] == "chen"]

    solved = client.post("/solve", json={"scenario": applied,
                                         "operations": []}).json()
    assert not [p for p in solved["timetable"]["placements"]
                if p["instructor_id"] == "chen"]


def test_speaker_context_attributes_identity_dependent_requests(client):
    response = client.post("/copilot", json={
        "message": "I can't teach Mondays. Keep me under 3 preps.",
        "speaker_id": "patel",
    }).json()
    ops = [o["op"] for o in response["applied_operations"]]
    assert "add_instructor_unavailability" in ops
    assert "set_prep_cap" in ops


def test_voice_endpoint_requires_a_meta_key(client):
    response = client.post(
        "/emergency/audio",
        files={"file": ("note.wav", b"RIFF0000WAVE", "audio/wav")},
    )
    assert response.status_code == 503


def test_reset_returns_to_the_seed(client):
    client.post("/apply", json={"operations": [{
        "op": "remove_instructor", "instructor_id": "chen", "explanation": "out"}]})
    assert not [i for i in client.get("/scenario").json()["instructors"] if i["id"] == "chen"]
    client.post("/scenario/reset")
    assert [i for i in client.get("/scenario").json()["instructors"] if i["id"] == "chen"]
