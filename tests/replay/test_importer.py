"""Tests for RadLab importer and replay data loaders (A01, HZ-05, HZ-06, HZ-11)."""

import hashlib
import json
import pytest
from pathlib import Path

from backend.replay import (
    RADLAB_RANGE_END,
    RADLAB_RANGE_START,
    RADLAB_SHA256,
    import_radlab_csv,
    load_crew_fixture,
    load_radlab_archive,
    parse_radlab_csv,
    verify_radlab_archive,
)


def test_missing_radlab_archive_reports_blocked(tmp_path):
    missing_path = tmp_path / "nonexistent.csv"
    report = verify_radlab_archive(missing_path)
    assert report["status"] == "Blocked"
    assert report["check"] == "A01"
    assert report["expected_sha256"] == RADLAB_SHA256
    assert report["observed_sha256"] is None
    assert "not found" in report["reason"]


def test_radlab_archive_hash_mismatch_reports_blocked_with_observed_hash(tmp_path):
    bad_file = tmp_path / "bad.csv"
    bad_file.write_text("instrument_id,timestamp,value\nDosTel1,2022-04-01 23:12:25,1.5\n", encoding="utf-8")
    expected_hash = hashlib.sha256(bad_file.read_bytes()).hexdigest()

    report = verify_radlab_archive(bad_file)
    assert report["status"] == "Blocked"
    assert report["check"] == "A01"
    assert report["expected_sha256"] == RADLAB_SHA256
    assert report["observed_sha256"] == expected_hash
    assert "hash mismatch" in report["reason"]

    with pytest.raises(ValueError, match="hash mismatch"):
        import_radlab_csv(bad_file)

    assert load_radlab_archive(bad_file) is None


def test_parse_radlab_csv_format_and_contract_d1_ids(tmp_path):
    csv_content = (
        "instrument_id,timestamp,absorbed_dose_rate,module,spacecraft\n"
        "DosTel1,2022-04-01 22:50:00,1.2,Columbus,ISS\n"  # Before replay range
        "DosTel1,2022-04-01 23:12:25,1.65945,Columbus,ISS\n"
        "DosTel2,2022-04-01 23:20:00,2.211496,Columbus,ISS\n"
        "DosTel1,2022-04-02 01:10:00,1.8,Columbus,ISS\n"  # After replay range
    )
    test_csv = tmp_path / "test-radlab.csv"
    test_csv.write_text(csv_content, encoding="utf-8")

    rows = parse_radlab_csv(test_csv)
    assert len(rows) == 2

    # Verify DosTel1 observation
    d1 = rows[0]
    assert d1["id"] == "DosTel1:2022-04-01T23:12:25Z"  # Contract D1 ID format
    assert d1["source_id"] == "DosTel1"
    assert d1["metric"] == "absorbed_dose_rate"
    assert d1["value"] == 1.65945
    assert d1["unit"] == "µGy/h"
    assert d1["subject_id"] is None
    assert d1["provenance"] == "REAL_HISTORICAL"
    assert d1["observed_at"] == "2022-04-01T23:12:25Z"
    assert d1["source_timestamp"] == "2022-04-01 23:12:25"
    assert d1["metadata"] == {"module": "Columbus", "spacecraft": "ISS"}

    # Verify DosTel2 observation
    d2 = rows[1]
    assert d2["id"] == "DosTel2:2022-04-01T23:20:00Z"
    assert d2["source_id"] == "DosTel2"
    assert d2["value"] == 2.211496


def test_parse_radlab_csv_rejects_duplicate_readings(tmp_path):
    dup_csv = (
        "instrument_id,timestamp,absorbed_dose_rate\n"
        "DosTel1,2022-04-01 23:12:25,1.65945\n"
        "DosTel1,2022-04-01 23:12:25,1.70000\n"
    )
    test_csv = tmp_path / "dup-radlab.csv"
    test_csv.write_text(dup_csv, encoding="utf-8")

    with pytest.raises(ValueError, match="Duplicate reading for source DosTel1"):
        parse_radlab_csv(test_csv)


def test_load_crew_fixture_missing_returns_none(tmp_path):
    missing_path = tmp_path / "missing-crew.json"
    assert load_crew_fixture(missing_path) is None


def test_load_crew_fixture_validates_schema_and_uniqueness(tmp_path):
    # Invalid schema version
    bad_schema = tmp_path / "bad-schema.json"
    bad_schema.write_text(json.dumps({"schema_version": 2, "scenario_id": "sleep_vigilance", "observations": []}), encoding="utf-8")
    with pytest.raises(ValueError, match="schema_version must be 1"):
        load_crew_fixture(bad_schema)

    # Invalid scenario_id
    bad_scenario = tmp_path / "bad-scenario.json"
    bad_scenario.write_text(json.dumps({"schema_version": 1, "scenario_id": "other", "observations": []}), encoding="utf-8")
    with pytest.raises(ValueError, match="scenario_id must be 'sleep_vigilance'"):
        load_crew_fixture(bad_scenario)

    # Duplicate IDs
    duplicate_fixture = tmp_path / "dup.json"
    duplicate_fixture.write_text(
        json.dumps({
            "schema_version": 1,
            "scenario_id": "sleep_vigilance",
            "observations": [
                {
                    "id": "obs-1", "subject_id": "crew-demo-1", "metric": "sleep_duration",
                    "value": 450, "unit": "min", "observed_at": "2026-01-01T07:00:00Z",
                    "source_id": "crew_sleep_log", "provenance": "SYNTHETIC",
                },
                {
                    "id": "obs-1", "subject_id": "crew-demo-1", "metric": "sleep_duration",
                    "value": 440, "unit": "min", "observed_at": "2026-01-02T07:00:00Z",
                    "source_id": "crew_sleep_log", "provenance": "SYNTHETIC",
                },
            ],
        }),
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="Duplicate observation id"):
        load_crew_fixture(duplicate_fixture)
