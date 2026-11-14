"""Importer mechanics on fabricated CSVs; no test here verifies the NASA archive."""

import csv
import hashlib
import io
from pathlib import Path

import pytest

from backend.replay import importer


HEADER = "instrument_id,timestamp,absorbed_dose_rate,module,spacecraft\n"


def write_csv(tmp_path, body, header=HEADER):
    path = tmp_path / "synthetic-parser-test.csv"
    path.write_text(header + body, encoding="utf-8")
    return path


@pytest.mark.parametrize("value", ["0", "0.0", "0.000", "2.5"])
def test_csv_numeric_strings_preserved(tmp_path, value):
    path = write_csv(tmp_path, f"DosTel1,2022-04-01T23:20:00,{value},Columbus,ISS\n")
    row, = importer.parse_radlab_csv(path)
    assert row["value"] == float(value)
    assert row["id"] == "DosTel1:2022-04-01T23:20:00Z"
    assert row["subject_id"] is None
    assert row["metric"] == "absorbed_dose_rate" and row["unit"] == "µGy/h"
    assert row["metadata"] == {"module": "Columbus", "spacecraft": "ISS"}


def test_range_filter_sort_and_original_timestamp_retained(tmp_path):
    path = write_csv(tmp_path,
        "DosTel2,2022-04-02T01:04:59,2,Columbus,ISS\n"
        "DosTel1,2022-04-02T01:05:00,3,Columbus,ISS\n"
        "DosTel1,2022-04-01 23:00:00,0,Columbus,ISS\n"
        "DosTel1,2022-04-01T22:59:59,1,Columbus,ISS\n")
    rows = importer.parse_radlab_csv(path)
    assert len(rows) == 2
    assert rows[0]["observed_at"] == importer.RADLAB_RANGE_START
    assert rows[0]["source_timestamp"] == "2022-04-01 23:00:00"
    assert rows[1]["observed_at"] == importer.RADLAB_RANGE_END


@pytest.mark.parametrize("value", ["NaN", "Infinity", "-Infinity", "-0.1", "oops", ""])
def test_invalid_dose_is_rejected_with_line(tmp_path, value):
    path = write_csv(tmp_path, f"DosTel1,2022-04-01T23:20:00,{value},Columbus,ISS\n")
    with pytest.raises(ValueError, match="CSV line 2"):
        importer.parse_radlab_csv(path)


@pytest.mark.parametrize("time", ["2022-04-01T23:99:00Z", "2022-02-30T23:00:00Z",
    "2022-04-01T23:20:00.1", "2022-04-01T23:20:00.000Z",
    "2022-04-01T23:20:00+01:00", "2022-04-01", ""])
def test_invalid_or_unsupported_time_never_truncated(tmp_path, time):
    path = write_csv(tmp_path, f"DosTel1,{time},1,Columbus,ISS\n")
    with pytest.raises(ValueError, match="CSV line 2"):
        importer.parse_radlab_csv(path)


@pytest.mark.parametrize("header", ["", "instrument_id,timestamp,value\n",
    "timestamp,absorbed_dose_rate\n", "instrument_id,timestamp,absorbed_dose_rate,timestamp\n"])
def test_missing_or_duplicate_header_rejected(tmp_path, header):
    path = write_csv(tmp_path, "", header)
    with pytest.raises(ValueError, match="CSV column"):
        importer.parse_radlab_csv(path)


@pytest.mark.parametrize("body", [
    "DosTel1,2022-04-01T23:20:00,1,Columbus\n",  # missing field
    "DosTel1,2022-04-01T23:20:00,1,Columbus,ISS,extra\n",
    ",2022-04-01T23:20:00,1,Columbus,ISS\n",
    "OtherDetector,2022-04-01T23:20:00,1,Columbus,ISS\n",
])
def test_incomplete_or_unknown_readings_not_silently_skipped(tmp_path, body):
    with pytest.raises(ValueError, match="CSV line 2"):
        importer.parse_radlab_csv(write_csv(tmp_path, body))


def test_duplicate_normalized_reading_rejected(tmp_path):
    path = write_csv(tmp_path,
        "DosTel1,2022-04-01 23:20:00,1,Columbus,ISS\n"
        "DosTel1,2022-04-01T23:20:00Z,2,Columbus,ISS\n")
    with pytest.raises(ValueError, match="Duplicate reading for source DosTel1"):
        importer.parse_radlab_csv(path)


def test_invalid_out_of_range_row_is_not_hidden_by_filter(tmp_path):
    path = write_csv(tmp_path, "DosTel1,2022-04-01T22:59:59,NaN,Columbus,ISS\n")
    with pytest.raises(ValueError, match="finite and nonnegative"):
        importer.parse_radlab_csv(path)


def test_raw_timestamp_and_metadata_are_preserved_exactly(tmp_path):
    raw_time = " 2022-04-01T23:20:00 "
    path = write_csv(tmp_path, f"DosTel1,{raw_time},0, Columbus , ISS \n")
    row, = importer.parse_radlab_csv(path)
    assert row["source_timestamp"] == raw_time
    assert row["metadata"] == {"module": " Columbus ", "spacecraft": " ISS "}


def test_utf8_bom_supported(tmp_path):
    path = write_csv(tmp_path, "DosTel1,2022-04-01T23:20:00,1,Columbus,ISS\n")
    path.write_bytes(b"\xef\xbb\xbf" + path.read_bytes())
    assert len(importer.parse_radlab_csv(path)) == 1


def test_missing_and_mismatched_archive_remain_blocked(tmp_path):
    path = tmp_path / "missing.csv"
    report = importer.verify_radlab_archive(path)
    assert report["status"] == "Blocked" and report["observed_sha256"] is None
    assert importer.load_radlab_archive(path) is None
    with pytest.raises(ValueError, match="not found"):
        importer.import_radlab_csv(path)
    path.write_text("unverified bytes")
    report = importer.verify_radlab_archive(path)
    assert report["status"] == "Blocked"
    assert report["observed_sha256"] == hashlib.sha256(path.read_bytes()).hexdigest()
    assert importer.load_radlab_archive(path) is None
    with pytest.raises(ValueError, match="hash mismatch"):
        importer.import_radlab_csv(path)


def synthetic_archive(tmp_path):
    """Test-only counts, times and values; not NASA data."""
    from datetime import datetime, timedelta
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(["instrument_id", "timestamp", "absorbed_dose_rate", "module", "spacecraft"])
    for source, count in [("DosTel1", 84), ("DosTel2", 96)]:
        for i in range(count):
            time = datetime(2022, 4, 1, 23) + timedelta(seconds=i)
            writer.writerow([source, time.isoformat(), 0, "Columbus", "ISS"])
    path = tmp_path / "synthetic-archive.csv"
    path.write_text(output.getvalue())
    return path


def test_verified_path_checks_counts_and_imports_same_byte_snapshot(tmp_path, monkeypatch):
    path = synthetic_archive(tmp_path)
    original = path.read_bytes()
    # Test seam only; production constant is never changed in a fixture/artifact.
    monkeypatch.setattr(importer, "RADLAB_SHA256", hashlib.sha256(original).hexdigest())
    report = importer.verify_radlab_archive(path)
    assert report["status"] == "Pass"
    assert (report["dostel1_count"], report["dostel2_count"], report["total_observations"]) == (84, 96, 180)
    assert len(importer.load_radlab_archive(path)) == 180
    original_read = Path.read_bytes
    calls = []
    def replace_after_read(target):
        data = original_read(target)
        if target == path:
            calls.append(target)
            target.write_text("replacement must not be parsed")
        return data
    monkeypatch.setattr(Path, "read_bytes", replace_after_read)
    assert len(importer.import_radlab_csv(path)) == 180
    assert len(calls) == 1


def test_matching_test_hash_does_not_bypass_count_or_schema_checks(tmp_path, monkeypatch):
    for body, expected in [(HEADER + "DosTel1,2022-04-01T23:20:00,0,Columbus,ISS\n", "Expected 84"),
                            ("wrong,header\n", "Missing required CSV columns")]:
        path = tmp_path / "invalid-synthetic.csv"
        path.write_text(body)
        monkeypatch.setattr(importer, "RADLAB_SHA256", hashlib.sha256(path.read_bytes()).hexdigest())
        report = importer.verify_radlab_archive(path)
        assert report["status"] == "Blocked" and expected in report["reason"]
        assert importer.load_radlab_archive(path) is None


def test_environment_path_is_supported(tmp_path, monkeypatch):
    path = synthetic_archive(tmp_path)
    monkeypatch.setenv("ASTRO_VITAL_RADLAB_CSV", str(path))
    report = importer.verify_radlab_archive()
    assert report["path"] == str(path) and report["status"] == "Blocked"
