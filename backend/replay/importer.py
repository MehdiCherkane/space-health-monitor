"""Parse the documented RadLab CSV fields and verify the pinned demo archive.

The low-level parser is also used by synthetic tests; only the verified loaders
establish that bytes match the historical snapshot required by the demo contract.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import sys
from datetime import datetime
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_RADLAB_CSV = ROOT / "fixtures" / "radlab" / "iss-radlab-dostel-2022-04-01.csv"
RADLAB_SHA256 = "be73563615dbbd28b0b8548a0b9ba40c2059f3dc68ef8941203eb350dcc9e9fb"
RADLAB_RANGE_START = "2022-04-01T23:00:00Z"
RADLAB_RANGE_END = "2022-04-02T01:04:59Z"
SOURCES = {"DosTel1": 84, "DosTel2": 96}
REQUIRED_COLUMNS = {"instrument_id", "timestamp", "absorbed_dose_rate"}
WHOLE_SECOND_UTC = re.compile(r"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}Z?$")


def normalize_timestamp(raw: str) -> str:
    """Interpret offset-free source timestamps as UTC, with no precision loss."""
    clean = raw.strip()
    if not WHOLE_SECOND_UTC.fullmatch(clean):
        raise ValueError(f"Expected whole-second UTC timestamp, got {raw!r}")
    try:
        parsed = datetime.strptime(clean.removesuffix("Z").replace(" ", "T"), "%Y-%m-%dT%H:%M:%S")
    except ValueError as exc:
        raise ValueError(f"Invalid UTC timestamp: {raw!r}") from exc
    return parsed.strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_bytes(data: bytes) -> list[dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(data.decode("utf-8-sig"), newline=""), strict=True)
    headers = reader.fieldnames or []
    if not REQUIRED_COLUMNS <= set(headers):
        missing = ", ".join(sorted(REQUIRED_COLUMNS - set(headers)))
        raise ValueError(f"Missing required CSV columns: {missing}")
    if len(headers) != len(set(headers)):
        raise ValueError("Duplicate CSV column names")

    observations = []
    seen = set()
    for row in reader:
        line = reader.line_num
        try:
            if None in row or any(value is None for value in row.values()):
                raise ValueError("CSV row does not match the header width")
            for field in REQUIRED_COLUMNS:
                if not row[field].strip():
                    raise ValueError(f"Missing required value: {field}")
            source = row["instrument_id"].strip()
            if source not in SOURCES:
                raise ValueError(f"Unexpected detector: {source!r}")
            source_timestamp = row["timestamp"]
            observed_at = normalize_timestamp(source_timestamp)
            # CSV values are strings: both '0' and '0.0' are valid, truthy inputs.
            value = float(row["absorbed_dose_rate"])
            if not math.isfinite(value) or value < 0:
                raise ValueError("absorbed_dose_rate must be finite and nonnegative")
            key = (source, observed_at)
            if key in seen:
                raise ValueError(f"Duplicate reading for source {source} at {observed_at}")
            seen.add(key)
            # Validate every input row, then select the contract's replay window.
            if not RADLAB_RANGE_START <= observed_at <= RADLAB_RANGE_END:
                continue
            observation = {
                "id": f"{source}:{observed_at}", "subject_id": None,
                "metric": "absorbed_dose_rate", "value": value, "unit": "µGy/h",
                "observed_at": observed_at, "source_id": source,
                "provenance": "REAL_HISTORICAL", "source_timestamp": source_timestamp,
            }
            metadata = {name: row[name] for name in ("module", "spacecraft")
                        if name in row and row[name].strip()}
            if metadata:
                observation["metadata"] = metadata
            observations.append(observation)
        except (ValueError, TypeError) as exc:
            raise ValueError(f"CSV line {line}: {exc}") from exc
    return sorted(observations, key=lambda item: (item["observed_at"], item["id"]))


def parse_radlab_csv(path: str | Path) -> list[dict[str, Any]]:
    """Parse without a checksum gate; use import_radlab_csv for historical loading."""
    return _parse_bytes(Path(path).read_bytes())


def _audit_archive(csv_path=None):
    target = Path(csv_path or os.environ.get("ASTRO_VITAL_RADLAB_CSV") or DEFAULT_RADLAB_CSV)
    report = {
        "status": "Blocked", "check": "A01", "path": str(target),
        "expected_sha256": RADLAB_SHA256, "observed_sha256": None,
    }
    try:
        # Hash and parse the same immutable bytes, including when a path is replaced.
        data = target.read_bytes()
    except FileNotFoundError:
        report["reason"] = f"RadLab CSV archive not found at {target}"
        return report, None
    except OSError as exc:
        report["reason"] = f"Cannot read RadLab CSV: {exc}"
        return report, None
    report["observed_sha256"] = hashlib.sha256(data).hexdigest()
    if report["observed_sha256"] != RADLAB_SHA256:
        report["reason"] = "RadLab CSV hash mismatch"
        return report, None
    try:
        rows = _parse_bytes(data)
    except (ValueError, UnicodeError, csv.Error) as exc:
        report["reason"] = f"Error parsing RadLab CSV: {exc}"
        return report, None
    counts = {source: sum(row["source_id"] == source for row in rows) for source in SOURCES}
    report.update(dostel1_count=counts["DosTel1"], dostel2_count=counts["DosTel2"],
                  total_observations=len(rows))
    if counts != SOURCES:
        report["reason"] = ("Expected 84 DosTel1 and 96 DosTel2 records within the replay range; "
                            f"observed {counts['DosTel1']} DosTel1 and {counts['DosTel2']} DosTel2")
        return report, None
    report["status"] = "Pass"
    return report, rows


def verify_radlab_archive(csv_path: str | Path | None = None) -> dict[str, Any]:
    return _audit_archive(csv_path)[0]


def import_radlab_csv(csv_path: str | Path | None = None) -> list[dict[str, Any]]:
    report, rows = _audit_archive(csv_path)
    if report["status"] != "Pass":
        raise ValueError(f"RadLab archive verification failed: {report['reason']}")
    return rows


def load_radlab_archive(csv_path: str | Path | None = None) -> list[dict[str, Any]] | None:
    """Explicit preview fallback: unavailable/unverified archive returns None."""
    return _audit_archive(csv_path)[1]


if __name__ == "__main__":
    result = verify_radlab_archive()
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["status"] == "Pass" else 2)
