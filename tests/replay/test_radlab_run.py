"""Tests for RadLab replay flow (A02, A03, A04) with imported historical archive format."""

from fastapi.testclient import TestClient

from backend.api.main import create_app
from backend.replay import RADLAB_SHA256


def make_sample_radlab_csv(path):
    """Generate sample RadLab records matching the exact historical times and values for A02-A04."""
    rows = [
        "instrument_id,timestamp,absorbed_dose_rate,module,spacecraft",
        # Readings at 23:12:25 (both report)
        "DosTel1,2022-04-01 23:12:25,1.65945,Columbus,ISS",
        "DosTel2,2022-04-01 23:12:25,2.10000,Columbus,ISS",
        # DosTel2 keeps reporting regularly every ~2-3 minutes
        "DosTel2,2022-04-01 23:15:00,2.12000,Columbus,ISS",
        "DosTel2,2022-04-01 23:18:00,2.15000,Columbus,ISS",
        # Reading at 23:20:00 (DosTel2 reports, DosTel1 is still quiet)
        "DosTel2,2022-04-01 23:20:00,2.211496,Columbus,ISS",
        # DosTel2 continues reporting regularly
        "DosTel2,2022-04-01 23:23:00,2.22000,Columbus,ISS",
        "DosTel2,2022-04-01 23:26:00,2.23000,Columbus,ISS",
        "DosTel2,2022-04-01 23:28:00,2.24000,Columbus,ISS",
        # Recovery at 23:30:00 (DosTel1 recovers and both report)
        "DosTel1,2022-04-01 23:30:00,1.75000,Columbus,ISS",
        "DosTel2,2022-04-01 23:30:00,2.25000,Columbus,ISS",
    ]
    path.write_text("\n".join(rows) + "\n", encoding="utf-8")


def test_radlab_imported_run_stale_recovery_and_rewind(tmp_path, monkeypatch):
    csv_path = tmp_path / "mock-radlab.csv"
    make_sample_radlab_csv(csv_path)

    # Mock archive verification to accept our mock CSV for test purposes
    import backend.replay.importer as importer_mod
    monkeypatch.setattr(importer_mod, "verify_radlab_archive", lambda path=None: {
        "status": "Pass",
        "check": "A01",
        "path": str(csv_path),
        "expected_sha256": RADLAB_SHA256,
        "observed_sha256": RADLAB_SHA256,
        "dostel1_count": 2,
        "dostel2_count": 8,
        "total_observations": 10,
    })

    app = create_app(
        db_path=tmp_path / "radlab.db",
        radlab_csv_path=csv_path,
    )
    with TestClient(app) as client:
        res = client.post("/api/v1/runs", json={"scenario_id": "radlab_stale"})
        assert res.status_code == 201
        run_id = res.json()["run_id"]
        assert res.headers["x-data-mode"] == "integrated"

        # A02 Checkpoint 1: 23:12:25 -> both current (0s)
        s_231225 = client.get(f"/api/v1/runs/{run_id}/state", params={"as_of": "2022-04-01T23:12:25Z"}).json()
        assert [s["state"] for s in s_231225["sources"]] == ["current", "current"]
        assert s_231225["incidents"] == []

        # A02 Checkpoint 2: 23:17:25 -> DosTel1 current at exactly 300 s, DosTel2 current
        s_231725 = client.get(f"/api/v1/runs/{run_id}/state", params={"as_of": "2022-04-01T23:17:25Z"}).json()
        d1_status = next(s for s in s_231725["sources"] if s["source_id"] == "DosTel1")
        assert d1_status["state"] == "current"
        assert d1_status["age_seconds"] == 300
        assert s_231725["incidents"] == []

        # A02 Checkpoint 3: 23:17:26 -> DosTel1 stale at 301 s, incident opens
        s_231726 = client.get(f"/api/v1/runs/{run_id}/state", params={"as_of": "2022-04-01T23:17:26Z"}).json()
        d1_stale = next(s for s in s_231726["sources"] if s["source_id"] == "DosTel1")
        d2_cur = next(s for s in s_231726["sources"] if s["source_id"] == "DosTel2")
        assert d1_stale["state"] == "stale"
        assert d1_stale["age_seconds"] == 301
        assert d2_cur["state"] == "current"
        assert len(s_231726["incidents"]) == 1
        inc = s_231726["incidents"][0]
        assert inc["source_id"] == "DosTel1"
        assert inc["state"] == "open"
        assert inc["opened_at"] == "2022-04-01T23:17:26Z"
        assert inc["closed_at"] is None

        # A03 Checkpoint: 23:20:00 -> DosTel1 stale 455 s, DosTel2 current 0 s
        s_232000 = client.get(f"/api/v1/runs/{run_id}/state", params={"as_of": "2022-04-01T23:20:00Z"}).json()
        d1_2320 = next(s for s in s_232000["sources"] if s["source_id"] == "DosTel1")
        d2_2320 = next(s for s in s_232000["sources"] if s["source_id"] == "DosTel2")
        assert d1_2320["state"] == "stale"
        assert d1_2320["age_seconds"] == 455  # 23:20:00 - 23:12:25 = 455s
        assert d2_2320["state"] == "current"
        assert d2_2320["age_seconds"] == 0
        assert len(s_232000["incidents"]) == 1
        assert s_232000["incidents"][0]["state"] == "open"

        # A04 Checkpoint: 23:30:00 -> both current, incident resolved
        s_233000 = client.get(f"/api/v1/runs/{run_id}/state", params={"as_of": "2022-04-01T23:30:00Z"}).json()
        assert [s["state"] for s in s_233000["sources"]] == ["current", "current"]
        assert len(s_233000["incidents"]) == 1
        assert s_233000["incidents"][0]["state"] == "resolved"
        assert s_233000["incidents"][0]["closed_at"] == "2022-04-01T23:30:00Z"

        # A04 Rewind: rewind to 23:20:00 -> incident is open again, no future reading visible
        s_rewind = client.get(f"/api/v1/runs/{run_id}/state", params={"as_of": "2022-04-01T23:20:00Z"}).json()
        assert len(s_rewind["incidents"]) == 1
        assert s_rewind["incidents"][0]["state"] == "open"
        assert s_rewind["incidents"][0]["closed_at"] is None
        # No 23:30 reading in returned observations
        for obs in s_rewind["observations"]:
            assert obs["observed_at"] <= "2022-04-01T23:20:00Z"
