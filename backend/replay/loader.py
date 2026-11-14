"""Fixture loader for canonical synthetic crew scenarios.

Loads fixtures/crew/sleep-vigilance.json following contract D2.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CREW_FIXTURE = ROOT / "fixtures" / "crew" / "sleep-vigilance.json"


def load_crew_fixture(path: str | Path | None = None) -> list[dict[str, Any]] | None:
    """Load and validate the synthetic crew fixture if present on disk.

    Returns list of validated Observation dicts, or None if the fixture file is absent.
    """
    target = Path(path or os.environ.get("ASTRO_VITAL_CREW_FIXTURE") or DEFAULT_CREW_FIXTURE)
    if not target.is_file():
        return None

    data = json.loads(target.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"Crew fixture at {target} must be a JSON object")

    if data.get("schema_version") != 1:
        raise ValueError(f"Crew fixture schema_version must be 1, got {data.get('schema_version')}")

    if data.get("scenario_id") != "sleep_vigilance":
        raise ValueError(
            f"Crew fixture scenario_id must be 'sleep_vigilance', got {data.get('scenario_id')}"
        )

    observations = data.get("observations")
    if not isinstance(observations, list):
        raise ValueError("Crew fixture 'observations' must be a list")

    seen_ids: set[str] = set()
    validated: list[dict[str, Any]] = []
    for obs in observations:
        obs_id = obs.get("id")
        if not obs_id or not isinstance(obs_id, str):
            raise ValueError(f"Observation missing valid 'id': {obs}")
        if obs_id in seen_ids:
            raise ValueError(f"Duplicate observation id in fixture: {obs_id}")
        seen_ids.add(obs_id)

        for field in ("metric", "value", "unit", "observed_at", "source_id", "provenance"):
            if field not in obs:
                raise ValueError(f"Observation {obs_id} missing required field '{field}'")

        if obs["provenance"] not in ("REAL_HISTORICAL", "SYNTHETIC", "LIVE_MEASURED"):
            raise ValueError(f"Observation {obs_id} has invalid provenance: {obs['provenance']}")

        val = obs["value"]
        if isinstance(val, float) and val.is_integer():
            val = int(val)

        row: dict[str, Any] = {
            "id": obs_id,
            "subject_id": obs.get("subject_id", "crew-demo-1"),
            "metric": obs["metric"],
            "value": val,
            "unit": obs["unit"],
            "observed_at": obs["observed_at"],
            "source_id": obs["source_id"],
            "provenance": obs["provenance"],
        }
        if "source_timestamp" in obs and obs["source_timestamp"] is not None:
            row["source_timestamp"] = obs["source_timestamp"]
        if "metadata" in obs and obs["metadata"] is not None:
            row["metadata"] = obs["metadata"]
        validated.append(row)

    return validated
