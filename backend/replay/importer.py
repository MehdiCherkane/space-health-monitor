"""RadLab historical telemetry importer and archive verification.

Validates iss-radlab-dostel-2022-04-01.csv against expected checksum and imports
observations within the replay range (2022-04-01T23:00:00Z to 2022-04-02T01:04:59Z).
"""

from __future__ import annotations

import csv
import hashlib
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_RADLAB_CSV = ROOT / "fixtures" / "radlab" / "iss-radlab-dostel-2022-04-01.csv"

RADLAB_SHA256 = "be73563615dbbd28b0b8548a0b9ba40c2059f3dc68ef8941203eb350dcc9e9fb"
RADLAB_RANGE_START = "2022-04-01T23:00:00Z"
RADLAB_RANGE_END = "2022-04-02T01:04:59Z"

WHOLE_SECOND_UTC = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


def normalize_timestamp(raw: str) -> str:
    """Normalize raw timestamp string to UTC ISO format ending in Z."""
    clean = raw.strip()
    if clean.endswith("Z") and WHOLE_SECOND_UTC.fullmatch(clean):
        return clean
    # Support space separator or T separator without Z
    clean = clean.replace(" ", "T")
    if clean.endswith("Z"):
        clean = clean[:-1]
    # Check if there is a fractional second part, if so parse with %f
    try:
        if "." in clean:
            dt = datetime.strptime(clean, "%Y-%m-%dT%H:%M:%S.%f")
            return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        dt = datetime.strptime(clean, "%Y-%m-%dT%H:%M:%S")
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    except ValueError as exc:
        raise ValueError(f"Cannot parse UTC timestamp: {raw}") from exc


def parse_radlab_csv(path: str | Path) -> list[dict[str, Any]]:
    """Parse RadLab CSV file and return normalized Observation dicts within replay range."""
    target = Path(path)
    if not target.is_file():
        raise FileNotFoundError(f"RadLab CSV not found at {target}")

    start_dt = datetime.strptime(RADLAB_RANGE_START, "%Y-%m-%dT%H:%M:%SZ")
    end_dt = datetime.strptime(RADLAB_RANGE_END, "%Y-%m-%dT%H:%M:%SZ")

    observations: list[dict[str, Any]] = []
    seen_keys: set[tuple[str, str, str]] = set()

    with open(target, mode="r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Map column names
            instrument = (
                row.get("instrument_id")
                or row.get("source_id")
                or row.get("instrument")
                or row.get("detector")
            )
            if not instrument:
                continue
            instrument = instrument.strip()

            raw_time = (
                row.get("source_timestamp")
                or row.get("timestamp")
                or row.get("time")
                or row.get("datetime")
            )
            if not raw_time:
                continue
            raw_time = raw_time.strip()

            observed_at = normalize_timestamp(raw_time)
            obs_dt = datetime.strptime(observed_at, "%Y-%m-%dT%H:%M:%SZ")

            # Filter to pinned replay range
            if not (start_dt <= obs_dt <= end_dt):
                continue

            raw_val = (
                row.get("absorbed_dose_rate")
                or row.get("value")
                or row.get("dose_rate")
            )
            if raw_val is None:
                continue
            value = float(raw_val)

            metric = "absorbed_dose_rate"
            unit = "µGy/h"

            # Reject exact duplicate source/metric/time observations
            key = (instrument, metric, observed_at)
            if key in seen_keys:
                raise ValueError(
                    f"Duplicate reading for source {instrument} at {observed_at}"
                )
            seen_keys.add(key)

            # Contract D1: Importer ID: {source_id}:{normalized_UTC_timestamp}
            obs_id = f"{instrument}:{observed_at}"

            metadata: dict[str, Any] = {}
            if "module" in row and row["module"]:
                metadata["module"] = row["module"].strip()
            if "spacecraft" in row and row["spacecraft"]:
                metadata["spacecraft"] = row["spacecraft"].strip()

            obs: dict[str, Any] = {
                "id": obs_id,
                "subject_id": None,
                "metric": metric,
                "value": value,
                "unit": unit,
                "observed_at": observed_at,
                "source_id": instrument,
                "provenance": "REAL_HISTORICAL",
                "source_timestamp": raw_time,
            }
            if metadata:
                obs["metadata"] = metadata

            observations.append(obs)

    # Sort observations chronologically, then by id lexicographically
    observations.sort(key=lambda r: (r["observed_at"], r["id"]))
    return observations


def verify_radlab_archive(csv_path: str | Path | None = None) -> dict[str, Any]:
    """Verify whether the RadLab archive exists and matches its expected checksum and record count.

    Returns a dict with 'status' ('Pass' or 'Blocked') and detailed audit information.
    """
    target = Path(csv_path or os.environ.get("ASTRO_VITAL_RADLAB_CSV") or DEFAULT_RADLAB_CSV)
    if not target.is_file():
        return {
            "status": "Blocked",
            "check": "A01",
            "path": str(target),
            "reason": f"RadLab CSV archive not found at {target}",
            "expected_sha256": RADLAB_SHA256,
            "observed_sha256": None,
        }

    hasher = hashlib.sha256()
    with open(target, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    observed_hash = hasher.hexdigest()

    if observed_hash != RADLAB_SHA256:
        return {
            "status": "Blocked",
            "check": "A01",
            "path": str(target),
            "reason": f"RadLab CSV hash mismatch",
            "expected_sha256": RADLAB_SHA256,
            "observed_sha256": observed_hash,
        }

    try:
        observations = parse_radlab_csv(target)
    except Exception as exc:
        return {
            "status": "Blocked",
            "check": "A01",
            "path": str(target),
            "reason": f"Error parsing RadLab CSV: {exc}",
            "expected_sha256": RADLAB_SHA256,
            "observed_sha256": observed_hash,
        }

    d1_count = sum(1 for o in observations if o["source_id"] == "DosTel1")
    d2_count = sum(1 for o in observations if o["source_id"] == "DosTel2")

    if d1_count != 84 or d2_count != 96:
        return {
            "status": "Blocked",
            "check": "A01",
            "path": str(target),
            "reason": (
                f"Expected 84 DosTel1 and 96 DosTel2 records, "
                f"observed {d1_count} DosTel1 and {d2_count} DosTel2"
            ),
            "expected_sha256": RADLAB_SHA256,
            "observed_sha256": observed_hash,
            "dostel1_count": d1_count,
            "dostel2_count": d2_count,
        }

    return {
        "status": "Pass",
        "check": "A01",
        "path": str(target),
        "expected_sha256": RADLAB_SHA256,
        "observed_sha256": observed_hash,
        "dostel1_count": d1_count,
        "dostel2_count": d2_count,
        "total_observations": len(observations),
    }


def import_radlab_csv(csv_path: str | Path | None = None) -> list[dict[str, Any]]:
    """Verify archive integrity and return imported observations, raising on error."""
    result = verify_radlab_archive(csv_path)
    if result["status"] != "Pass":
        raise ValueError(f"RadLab archive verification failed: {result['reason']}")
    target = Path(csv_path or os.environ.get("ASTRO_VITAL_RADLAB_CSV") or DEFAULT_RADLAB_CSV)
    return parse_radlab_csv(target)


def load_radlab_archive(csv_path: str | Path | None = None) -> list[dict[str, Any]] | None:
    """Safe loader for runtime initialization: returns observations if valid, None if blocked."""
    result = verify_radlab_archive(csv_path)
    if result["status"] != "Pass":
        return None
    target = Path(csv_path or os.environ.get("ASTRO_VITAL_RADLAB_CSV") or DEFAULT_RADLAB_CSV)
    return parse_radlab_csv(target)


if __name__ == "__main__":
    report = verify_radlab_archive()
    print(json.dumps(report, indent=2))
    sys.exit(0 if report["status"] == "Pass" else 2)
