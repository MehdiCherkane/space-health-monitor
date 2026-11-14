"""Replay assertion mechanics on SYNTHETIC data, plus a pinned archive gate.

Missing archive is a skipped/Blocked historical check, not historical verification.
"""

import importlib.util
import inspect
import sqlite3
from pathlib import Path

import pytest

from backend.engine import evaluate
from backend.replay import importer
import json

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("historical_gate", ROOT / "release/verify_historical.py")
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


def synthetic_rows():
    times = {"DosTel1": ["23:12:25", "23:29:30"],
             "DosTel2": ["23:12:25", "23:15:00", "23:18:00", "23:20:00", "23:23:00", "23:26:00", "23:30:00"]}
    rows = []
    for source, values in times.items():
        for time in values:
            value = 1.65945 if source == "DosTel1" and time == "23:12:25" else 2.211496
            rows.append({"id": f"synthetic-{source}-{time}", "subject_id": None,
                         "metric": "absorbed_dose_rate", "value": value, "unit": "µGy/h",
                         "observed_at": f"2022-04-01T{time}Z", "source_id": source,
                         "provenance": "SYNTHETIC"})
    return rows


def test_synthetic_assertions_check_boundaries_recovery_and_rewind():
    policy = json.loads((ROOT / "rules/demo-v1.json").read_text(encoding="utf-8"))
    rows = synthetic_rows()
    states = {time: evaluate("radlab_stale", "synthetic-test", f"2022-04-01T{time}Z",
                            rows, policy["resources"], policy) for time in gate.CHECKPOINTS}
    gate.check_states(states, rows)
    assert states["23:30:00"]["incidents"][0]["closed_at"] == "2022-04-01T23:29:30Z"
    assert evaluate("radlab_stale", "synthetic-test", "2022-04-01T23:20:00Z", rows,
                    policy["resources"], policy) == states["23:20:00"]
    states["23:20:00"]["sources"][0]["age_seconds"] = 0
    with pytest.raises(AssertionError, match="A03 ages"):
        gate.check_states(states, rows)


def test_missing_archive_never_promotes_to_historical_pass(tmp_path):
    report = gate.run_checks(tmp_path / "missing.csv", api=True)
    assert report["checks"] == {"A01": "Blocked", "A02": "Blocked", "A03": "Blocked", "A04": "Blocked"}
    assert report["api"] == "Not run"
    assert report["X01"].startswith("Not run")


def test_read_only_snapshot_detects_committed_wal_changes(tmp_path):
    path = tmp_path / "wal-check.db"
    writer = sqlite3.connect(path)
    try:
        writer.execute("PRAGMA journal_mode=WAL")
        writer.execute("CREATE TABLE example (value INTEGER)")
        writer.commit()
        before = gate.database_snapshot(path)
        assert gate.database_snapshot(path) == before
        writer.execute("INSERT INTO example VALUES (1)")
        writer.commit()
        assert gate.database_snapshot(path) != before
    finally:
        writer.close()


def test_actual_historical_archive_when_available():
    archive = importer.verify_radlab_archive()
    if archive["status"] != "Pass":
        pytest.skip(f"Blocked A01-A04: {archive['reason']}")
    report = gate.run_checks(archive["path"])
    assert report["checks"] == {name: "Pass" for name in ("A01", "A02", "A03", "A04")}, report


def test_actual_historical_api_when_integrated():
    from backend.api.main import create_app
    if "radlab_csv_path" not in inspect.signature(create_app).parameters:
        pytest.skip("Blocked historical API: seeded API integration is not installed")
    archive = importer.verify_radlab_archive()
    if archive["status"] != "Pass":
        pytest.skip(f"Blocked A01-A04: {archive['reason']}")
    report = gate.run_checks(archive["path"], api=True)
    assert report["checks"] == {name: "Pass" for name in ("A01", "A02", "A03", "A04")}, report
    assert report["api"] == "Pass", report
