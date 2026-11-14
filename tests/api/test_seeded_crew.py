"""Tests for seeded crew behavioral run, submission idempotency, and isolation (B01-B05)."""

import json
from fastapi.testclient import TestClient
import pytest

from backend.api.main import create_app


def canonical_14_observations():
    """Canonical 14 rows defined by contract D2 and D3."""
    sleep_baseline_values = [450, 440, 450, 460, 445]
    reaction_baseline_values = [245, 250, 255, 248, 252]

    observations = []
    # 5 sleep baseline rows
    for i, val in enumerate(sleep_baseline_values, 1):
        observations.append({
            "id": f"base-sleep-{i}",
            "subject_id": "crew-demo-1",
            "metric": "sleep_duration",
            "value": val,
            "unit": "min",
            "observed_at": f"2026-01-0{i}T07:00:00Z",
            "source_id": "crew_sleep_log",
            "provenance": "SYNTHETIC",
        })

    # 3 recent sleep rows
    for day, val in [("08", 380), ("09", 370), ("10", 420)]:
        observations.append({
            "id": f"sleep-{day}",
            "subject_id": "crew-demo-1",
            "metric": "sleep_duration",
            "value": val,
            "unit": "min",
            "observed_at": f"2026-01-{day}T07:00:00Z",
            "source_id": "crew_sleep_log",
            "provenance": "SYNTHETIC",
        })

    # 5 reaction baseline rows
    for i, val in enumerate(reaction_baseline_values, 1):
        observations.append({
            "id": f"base-reaction-{i}",
            "subject_id": "crew-demo-1",
            "metric": "reaction_time",
            "value": val,
            "unit": "ms",
            "observed_at": f"2026-01-0{i}T09:00:00Z",
            "source_id": "reaction_task",
            "provenance": "SYNTHETIC",
            "metadata": {
                "task_version": "demo-rt-v1",
                "input_profile": "seeded-demo",
                "trial_count": 5,
                "false_starts": 0,
                "completed": True,
            },
        })

    # 1 seeded current reaction sample at 09:01:00Z (+24%)
    observations.append({
        "id": "reaction-10",
        "subject_id": "crew-demo-1",
        "metric": "reaction_time",
        "value": 310,
        "unit": "ms",
        "observed_at": "2026-01-10T09:01:00Z",
        "source_id": "reaction_task",
        "provenance": "SYNTHETIC",
        "metadata": {
            "task_version": "demo-rt-v1",
            "input_profile": "seeded-demo",
            "trial_count": 5,
            "false_starts": 0,
            "completed": True,
        },
    })
    return observations


@pytest.fixture
def crew_fixture_file(tmp_path):
    fixture_path = tmp_path / "sleep-vigilance.json"
    content = {
        "schema_version": 1,
        "fixture_id": "crew-demo-sleep-vigilance-v1",
        "scenario_id": "sleep_vigilance",
        "subject_id": "crew-demo-1",
        "observations": canonical_14_observations(),
    }
    fixture_path.write_text(json.dumps(content), encoding="utf-8")
    return fixture_path


def test_seeded_crew_run_evaluates_integrated_state_at_0900_and_0901(tmp_path, crew_fixture_file):
    app = create_app(
        db_path=tmp_path / "seeded.db",
        crew_fixture_path=crew_fixture_file,
    )
    with TestClient(app) as client:
        # Create run
        res = client.post("/api/v1/runs", json={"scenario_id": "sleep_vigilance"})
        assert res.status_code == 201
        run_id = res.json()["run_id"]
        assert res.headers["x-data-mode"] == "integrated"

        # B01 Checkpoint: 09:00:00Z (reaction-10 not yet visible)
        state_0900_res = client.get(f"/api/v1/runs/{run_id}/state", params={"as_of": "2026-01-10T09:00:00Z"})
        assert state_0900_res.status_code == 200
        assert state_0900_res.headers["x-data-mode"] == "integrated"
        state_0900 = state_0900_res.json()
        assert state_0900["scenario_id"] == "sleep_vigilance"
        assert state_0900["as_of"] == "2026-01-10T09:00:00Z"
        assert len(state_0900["assessments"]) == 1
        assessment_0900 = state_0900["assessments"][0]
        assert assessment_0900["state"] == "insufficient_data"
        assert assessment_0900["title"] == "Vigilance data missing"
        assert assessment_0900["missing_inputs"] == ["reaction_time"]
        assert "start_reaction_check" in assessment_0900["action_ids"]
        # Ensure reaction-10 is not in returned observations
        obs_ids_0900 = {o["id"] for o in state_0900["observations"]}
        assert "reaction-10" not in obs_ids_0900
        assert "sleep-10" in obs_ids_0900

        # B02 Checkpoint: 09:01:00Z (reaction-10 is visible -> watch)
        state_0901_res = client.get(f"/api/v1/runs/{run_id}/state", params={"as_of": "2026-01-10T09:01:00Z"})
        assert state_0901_res.status_code == 200
        assert state_0901_res.headers["x-data-mode"] == "integrated"
        state_0901 = state_0901_res.json()
        assert len(state_0901["assessments"]) == 1
        assessment_0901 = state_0901["assessments"][0]
        assert assessment_0901["state"] == "watch"
        assert assessment_0901["title"] == "Sleep and vigilance change"
        assert len(assessment_0901["supporting_evidence"]) == 2
        obs_ids_0901 = {o["id"] for o in state_0901["observations"]}
        assert "reaction-10" in obs_ids_0901


def test_b04_resource_disabled_fallback_action(tmp_path, crew_fixture_file):
    app = create_app(
        db_path=tmp_path / "b04.db",
        resources={"local_reaction_task": False},
        crew_fixture_path=crew_fixture_file,
    )
    with TestClient(app) as client:
        res = client.post("/api/v1/runs", json={"scenario_id": "sleep_vigilance"})
        run_id = res.json()["run_id"]

        state_res = client.get(f"/api/v1/runs/{run_id}/state", params={"as_of": "2026-01-10T09:00:00Z"})
        state = state_res.json()
        action_map = {a["id"]: a for a in state["actions"]}
        assert "start_reaction_check" in action_map
        assert action_map["start_reaction_check"]["available"] is False
        assert action_map["start_reaction_check"]["unavailable_reason"] == "Reaction check unavailable"
        assert "review_available_inputs" in action_map
        assert action_map["review_available_inputs"]["available"] is True


def test_b05_submission_idempotency_conflict_and_isolation(tmp_path, crew_fixture_file):
    app = create_app(
        db_path=tmp_path / "b05.db",
        crew_fixture_path=crew_fixture_file,
    )
    with TestClient(app) as client:
        # Create first run
        run1 = client.post("/api/v1/runs", json={"scenario_id": "sleep_vigilance"}).json()["run_id"]

        payload = {
            "submission_id": "sub-b05-01",
            "observed_at": "2026-01-10T09:05:00Z",
            "entries": [
                {
                    "metric": "sleep_duration",
                    "value": 410,
                    "unit": "min",
                    "source_id": "crew_sleep_log",
                }
            ],
        }

        # 1. First submission -> 201 Created
        first_post = client.post(f"/api/v1/runs/{run1}/observations", json=payload)
        assert first_post.status_code == 201
        first_data = first_post.json()
        assert first_data["submission_id"] == "sub-b05-01"
        obs_ids = first_data["observation_ids"]
        assert len(obs_ids) == 1

        # 2. Identical retry with same submission_id -> 200 OK with same IDs
        retry_post = client.post(f"/api/v1/runs/{run1}/observations", json=payload)
        assert retry_post.status_code == 200
        retry_data = retry_post.json()
        assert retry_data["submission_id"] == "sub-b05-01"
        assert retry_data["observation_ids"] == obs_ids

        # 3. Changed payload with same submission_id -> 409 Conflict
        changed_payload = {
            "submission_id": "sub-b05-01",
            "observed_at": "2026-01-10T09:05:00Z",
            "entries": [
                {
                    "metric": "sleep_duration",
                    "value": 395,  # Changed value!
                    "unit": "min",
                    "source_id": "crew_sleep_log",
                }
            ],
        }
        conflict_post = client.post(f"/api/v1/runs/{run1}/observations", json=changed_payload)
        assert conflict_post.status_code == 409
        assert "different payload" in conflict_post.json()["detail"]

        # 4. Reset isolation: create a fresh run
        run2 = client.post("/api/v1/runs", json={"scenario_id": "sleep_vigilance"}).json()["run_id"]
        assert run1 != run2

        # Check history of run1 vs run2
        hist1 = client.get(f"/api/v1/runs/{run1}/observations", params={"as_of": "2026-01-10T09:10:00Z"}).json()["observations"]
        hist2 = client.get(f"/api/v1/runs/{run2}/observations", params={"as_of": "2026-01-10T09:10:00Z"}).json()["observations"]

        # run1 has 14 seed observations + 1 submitted observation = 15
        assert len(hist1) == 15
        # run2 has only its own 14 seed observations
        assert len(hist2) == 14
        assert obs_ids[0] in {o["id"] for o in hist1}
        assert obs_ids[0] not in {o["id"] for o in hist2}
