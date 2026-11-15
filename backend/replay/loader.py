"""Fixture loader for canonical synthetic crew scenarios.

Loads `fixtures/crew/sleep-vigilance.json` following contract D2/D3. Every field is
validated before the API persists a row, so a malformed fixture fails at load time with
the file and field name instead of surfacing later as a half-seeded run.

A missing file returns `None`, which is an explicit caller decision to serve the contract
fixture preview. A file that exists but violates D2 always raises `CrewFixtureError`:
invalid input is never downgraded to a passing preview.
"""

from __future__ import annotations

import json
import math
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CREW_FIXTURE = ROOT / "fixtures" / "crew" / "sleep-vigilance.json"

SCHEMA_VERSION = 1
SCENARIO_ID = "sleep_vigilance"
SUBJECT_ID = "crew-demo-1"

WHOLE_SECOND_UTC = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$")

# (source_id, metric, unit) -> inclusive (minimum, maximum); None means unbounded.
# A crew seed only carries the scheduled sleep and reaction rows; self-reports arrive
# through submissions, so they are not fixture data.
ALLOWED_PAIRS: dict[tuple[str, str, str], tuple[float, float | None]] = {
    ("crew_sleep_log", "sleep_duration", "min"): (0, 1440),
    ("reaction_task", "reaction_time", "ms"): (0, None),
}

REACTION_METADATA: dict[str, type] = {
    "task_version": str,
    "input_profile": str,
    "trial_count": int,
    "false_starts": int,
    "completed": bool,
}


class CrewFixtureError(ValueError):
    """A present crew fixture violates contract D2/D3."""


def _utc(value: Any, field: str) -> str:
    if not isinstance(value, str) or not WHOLE_SECOND_UTC.fullmatch(value):
        raise CrewFixtureError(
            f"{field} must be a whole-second UTC timestamp ending in Z, got {value!r}"
        )
    try:
        datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError as error:
        raise CrewFixtureError(f"{field} is not a real UTC time: {value!r}") from error
    return value


def _number(value: Any, field: str) -> int | float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise CrewFixtureError(f"{field} must be a number, got {value!r}")
    try:
        finite = math.isfinite(value)
    except OverflowError:
        finite = False
    if not finite:
        raise CrewFixtureError(f"{field} must be a finite number, got {value!r}")
    # SQLite only binds signed 64-bit integers. Keep larger finite values as REAL
    # instead of converting integral floats to an unbindable Python integer.
    if -(2**63) <= value < 2**63 and (
        isinstance(value, int) or value.is_integer()
    ):
        return int(value)
    return float(value)


def _require_json_safe(value: Any, field: str) -> None:
    """Reject metadata that cannot round-trip through the UTF-8 JSON API."""
    if isinstance(value, str):
        try:
            value.encode("utf-8")
        except UnicodeEncodeError as error:
            raise CrewFixtureError(f"{field} must contain valid Unicode text") from error
    if isinstance(value, float) and not math.isfinite(value):
        raise CrewFixtureError(f"{field} must be a finite number, got {value!r}")
    if isinstance(value, dict):
        for key, item in value.items():
            _require_json_safe(key, f"{field} key")
            _require_json_safe(item, f"{field}.{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            _require_json_safe(item, f"{field}[{index}]")


def _validate_reaction_metadata(observation_id: str, metadata: Any) -> dict[str, Any]:
    if not isinstance(metadata, dict):
        raise CrewFixtureError(
            f"Observation {observation_id} is a reaction row; metadata must be an object"
        )
    for field, expected in REACTION_METADATA.items():
        if field not in metadata:
            raise CrewFixtureError(
                f"Observation {observation_id} reaction metadata missing '{field}'"
            )
        value = metadata[field]
        if expected is bool:
            valid = isinstance(value, bool)
        elif expected is int:
            valid = isinstance(value, int) and not isinstance(value, bool)
        else:
            valid = isinstance(value, str) and bool(value.strip())
        if not valid:
            raise CrewFixtureError(
                f"Observation {observation_id} reaction metadata '{field}' must be "
                f"{expected.__name__}, got {value!r}"
            )
    if metadata["trial_count"] < 1:
        raise CrewFixtureError(
            f"Observation {observation_id} trial_count must be at least 1"
        )
    if not 0 <= metadata["false_starts"] <= metadata["trial_count"]:
        raise CrewFixtureError(
            f"Observation {observation_id} false_starts must be between 0 and trial_count"
        )
    return metadata


def _validate_observation(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise CrewFixtureError(f"Every observation must be a JSON object, got {raw!r}")

    observation_id = raw.get("id")
    if not isinstance(observation_id, str) or not observation_id:
        raise CrewFixtureError(f"Observation missing valid 'id': {raw!r}")
    _require_json_safe(observation_id, "Observation id")

    # The subject is part of the contract, not a default: seeds must say it explicitly.
    if raw.get("subject_id") != SUBJECT_ID:
        raise CrewFixtureError(
            f"Observation {observation_id} subject_id must be '{SUBJECT_ID}', "
            f"got {raw.get('subject_id')!r}"
        )
    # Seeds are declared synthetic scenario data; never present them as measurements.
    if raw.get("provenance") != "SYNTHETIC":
        raise CrewFixtureError(
            f"Observation {observation_id} provenance must be 'SYNTHETIC', "
            f"got {raw.get('provenance')!r}"
        )

    for field in ("metric", "unit", "source_id"):
        if not isinstance(raw.get(field), str) or not raw.get(field):
            raise CrewFixtureError(f"Observation {observation_id} missing valid '{field}'")
        _require_json_safe(raw[field], f"Observation {observation_id} {field}")

    pair = (raw["source_id"], raw["metric"], raw["unit"])
    if pair not in ALLOWED_PAIRS:
        raise CrewFixtureError(
            f"Observation {observation_id} has unsupported source/metric/unit: "
            f"{raw['source_id']}/{raw['metric']}/{raw['unit']}"
        )
    minimum, maximum = ALLOWED_PAIRS[pair]
    value = _number(raw.get("value"), f"Observation {observation_id} value")
    if minimum is not None and value < minimum:
        raise CrewFixtureError(
            f"Observation {observation_id} value {value} is below {minimum}"
        )
    if maximum is not None and value > maximum:
        raise CrewFixtureError(
            f"Observation {observation_id} value {value} is above {maximum}"
        )
    if pair[1] == "reaction_time" and value <= 0:
        raise CrewFixtureError(
            f"Observation {observation_id} reaction_time must be positive, got {value}"
        )

    row: dict[str, Any] = {
        "id": observation_id,
        "subject_id": SUBJECT_ID,
        "metric": raw["metric"],
        "value": value,
        "unit": raw["unit"],
        "observed_at": _utc(raw.get("observed_at"), f"Observation {observation_id} observed_at"),
        "source_id": raw["source_id"],
        "provenance": "SYNTHETIC",
    }

    if "source_timestamp" in raw and raw["source_timestamp"] is not None:
        source_timestamp = raw["source_timestamp"]
        if not isinstance(source_timestamp, str) or not source_timestamp.strip():
            raise CrewFixtureError(
                f"Observation {observation_id} source_timestamp must be non-empty text"
            )
        _require_json_safe(source_timestamp, f"Observation {observation_id} source_timestamp")
        row["source_timestamp"] = source_timestamp

    metadata = raw.get("metadata")
    if metadata is not None and not isinstance(metadata, dict):
        raise CrewFixtureError(f"Observation {observation_id} metadata must be an object")
    _require_json_safe(metadata, f"Observation {observation_id} metadata")
    if pair[1] == "reaction_time":
        row["metadata"] = _validate_reaction_metadata(observation_id, metadata)
    elif metadata is not None:
        row["metadata"] = metadata

    return row


def _require_text(data: dict[str, Any], field: str) -> None:
    value = data.get(field)
    if not isinstance(value, str) or not value.strip():
        raise CrewFixtureError(f"Crew fixture '{field}' must be a non-empty string")


def _validate_fixture(data: Any) -> list[dict[str, Any]]:
    """Validate the D2 envelope and every row; raise `CrewFixtureError` on the first defect."""
    if not isinstance(data, dict):
        raise CrewFixtureError("Crew fixture must be a JSON object")

    if data.get("schema_version") != SCHEMA_VERSION:
        raise CrewFixtureError(
            f"Crew fixture schema_version must be 1, got {data.get('schema_version')}"
        )
    if data.get("scenario_id") != SCENARIO_ID:
        raise CrewFixtureError(
            f"Crew fixture scenario_id must be '{SCENARIO_ID}', "
            f"got {data.get('scenario_id')!r}"
        )

    observations = data.get("observations")
    if not isinstance(observations, list):
        raise CrewFixtureError("Crew fixture 'observations' must be a list")

    seen_ids: set[str] = set()
    validated: list[dict[str, Any]] = []
    for raw in observations:
        row = _validate_observation(raw)
        if row["id"] in seen_ids:
            raise CrewFixtureError(f"Duplicate observation id in fixture: {row['id']}")
        seen_ids.add(row["id"])
        validated.append(row)

    # Envelope identity is checked after the rows so a duplicate or malformed row is
    # reported first; both orders keep the error specific to the offending input.
    _require_text(data, "fixture_id")
    if data.get("subject_id") != SUBJECT_ID:
        raise CrewFixtureError(
            f"Crew fixture subject_id must be '{SUBJECT_ID}', got {data.get('subject_id')!r}"
        )
    if not validated:
        raise CrewFixtureError("Crew fixture 'observations' must contain at least one row")

    return validated


def load_crew_fixture(path: str | Path | None = None) -> list[dict[str, Any]] | None:
    """Load and validate the synthetic crew fixture if present on disk.

    Returns the validated Observation dicts, or `None` when the file is absent (the
    caller then serves the explicit fixture preview). A present but invalid file raises
    `CrewFixtureError` naming the file path and the failing field.
    """
    target = Path(path or os.environ.get("ASTRO_VITAL_CREW_FIXTURE") or DEFAULT_CREW_FIXTURE)
    if not target.is_file():
        return None

    try:
        data = json.loads(target.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise CrewFixtureError(f"Crew fixture at {target} is not valid JSON: {error}") from error

    try:
        return _validate_fixture(data)
    except CrewFixtureError as error:
        raise CrewFixtureError(f"Crew fixture at {target}: {error}") from error
