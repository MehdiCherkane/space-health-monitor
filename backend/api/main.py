"""Runtime API for the two demo scenarios.

Runs and crew submissions live in SQLite (`backend/storage`). The state route passes
only observations visible at `as_of` to the merged evaluator and returns its envelope.
A run with no observations yet returns its contract example labeled **Fixture preview**;
that label disappears as soon as the run holds real observations.

Seeds are resolved once per run creation, before anything is persisted: the canonical
crew fixture or the verified RadLab archive when it is present on disk. A missing seed
file selects the explicit fixture preview; a present but invalid seed fails the request
instead of being silently replaced by preview data. The `X-Data-Mode` response header
reports what the run actually holds.
"""

from __future__ import annotations

import copy
import hashlib
import json
import math
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

from backend.engine import evaluate
from backend.replay import (
    DEFAULT_RADLAB_CSV,
    CrewFixtureError,
    load_crew_fixture,
    load_radlab_archive,
)
from backend.storage import Storage, DuplicateSeedError, SubmissionConflict

ROOT = Path(__file__).resolve().parents[2]
EXAMPLES = ROOT / "contracts" / "examples"
POLICY_PATH = ROOT / "rules" / "demo-v1.json"
DEFAULT_DB = Path(
    os.environ.get("ASTRO_VITAL_DB") or ROOT / "backend" / "storage" / "astro-vital.db"
)

POLICY: dict[str, Any] = json.loads(POLICY_PATH.read_text(encoding="utf-8"))

EXAMPLE_FILES = {
    "radlab_stale": "radlab-stale.json",
    "sleep_vigilance": "sleep-vigilance-missing.json",
}
SCENARIOS = {
    scenario_id: {
        "initial_as_of": config["range_start"],
        "range_start": config["range_start"],
        "range_end": config["range_end"],
        "example": EXAMPLE_FILES[scenario_id],
    }
    for scenario_id, config in POLICY["scenarios"].items()
}

WHOLE_SECOND_UTC = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$")
SUBMISSION_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
SQLITE_MAX_INTEGER = 2**63 - 1

SUBJECT_ID = "crew-demo-1"
PREVIEW_MODE = "fixture-preview"
INTEGRATED_MODE = "integrated"
PREVIEW_SOURCE = "contracts/examples"


class RunRequest(BaseModel):
    scenario_id: Literal["radlab_stale", "sleep_vigilance"]


class Entry(BaseModel):
    metric: str
    value: float
    unit: str
    source_id: str
    metadata: dict[str, Any] | None = None

    @field_validator('value', mode='before')
    @classmethod
    def reject_boolean_measurement(cls, value: Any) -> Any:
        if isinstance(value, bool):
            raise ValueError('measurement value must be a number, not a boolean')
        return value


class Submission(BaseModel):
    submission_id: str = Field(min_length=1, max_length=128, pattern=SUBMISSION_ID.pattern)
    observed_at: str
    entries: list[Entry] = Field(min_length=1)


def _utc(value: str, field: str) -> datetime:
    """Parse canonical whole-second UTC; the regex alone accepts impossible times like 09:99."""
    if WHOLE_SECOND_UTC.fullmatch(value):
        try:
            return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            pass
    raise HTTPException(
        422, f"{field} must be a valid whole-second UTC timestamp ending in Z"
    )


def _clock_in_range(run: dict[str, str], value: str, field: str) -> None:
    clock = _utc(value, field)
    if not _utc(run["range_start"], "range_start") <= clock <= _utc(run["range_end"], "range_end"):
        raise HTTPException(422, f"{field} is outside the run range")


def _require_finite(value: Any, path: str) -> None:
    """Reject JSON data that cannot be returned as finite UTF-8 JSON."""
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError(f"{path} must be a finite number")
    if isinstance(value, str) and any(0xD800 <= ord(char) <= 0xDFFF for char in value):
        raise ValueError(f"{path} must contain valid Unicode text")
    if isinstance(value, dict):
        for key, item in value.items():
            _require_finite(key, f"{path} key")
            _require_finite(item, f"{path}.{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            _require_finite(item, f"{path}[{index}]")


def _validate_entry(entry: Entry) -> None:
    for field in ('metric', 'unit', 'source_id'):
        _require_finite(getattr(entry, field), field)
    if entry.metadata is not None:
        _require_finite(entry.metadata, "metadata")
    if (entry.source_id, entry.metric, entry.unit) == (
        "crew_sleep_log",
        "sleep_duration",
        "min",
    ):
        if not math.isfinite(entry.value) or not 0 <= entry.value <= 1440:
            raise ValueError("sleep_duration must be between 0 and 1440 minutes")
        return
    if (
        entry.source_id == "crew_self_report"
        and entry.metric in {"fatigue", "mood", "stress"}
        and entry.unit == "score_0_10"
    ):
        if not math.isfinite(entry.value) or not entry.value.is_integer() or not 0 <= entry.value <= 10:
            raise ValueError(f"{entry.metric} must be an integer from 0 to 10")
        return
    if (entry.source_id, entry.metric, entry.unit) == (
        "reaction_task",
        "reaction_time",
        "ms",
    ):
        if not math.isfinite(entry.value) or entry.value <= 0:
            raise ValueError("reaction_time must be finite and positive")
        return
    raise ValueError(
        f"unsupported source/metric/unit: {entry.source_id}/{entry.metric}/{entry.unit}"
    )


def _stored_value(entry: Entry) -> int | float:
    # SQLite REAL can represent every finite accepted float. Its INTEGER binding
    # cannot represent an arbitrary Python int, even when derived from that float.
    if entry.value.is_integer() and -(2**63) <= entry.value < 2**63:
        return int(entry.value)
    return entry.value


def _validation_json(value: Any) -> Any:
    """Keep invalid NaN/Infinity inputs printable in a valid JSON error response."""
    if isinstance(value, float) and not math.isfinite(value):
        return str(value)
    if isinstance(value, str):
        return value.encode('utf-8', errors='backslashreplace').decode('utf-8')
    if isinstance(value, dict):
        return {_validation_json(key): _validation_json(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_validation_json(item) for item in value]
    return value


def _observation(submission: Submission, entry: Entry, index: int) -> dict[str, Any]:
    """Add IDs, subject and provenance on the server; clients never send them."""
    row: dict[str, Any] = {
        "id": f"{submission.submission_id}:{index}",
        "subject_id": SUBJECT_ID,
        "metric": entry.metric,
        "value": _stored_value(entry),
        "unit": entry.unit,
        "observed_at": submission.observed_at,
        "source_id": entry.source_id,
        "provenance": "LIVE_MEASURED" if entry.source_id == "reaction_task" else "SYNTHETIC",
    }
    if entry.metadata is not None:
        row["metadata"] = entry.metadata
    return row


def _payload_hash(submission: Submission, rows: list[dict[str, Any]]) -> str:
    payload = json.dumps(
        {
            "observed_at": submission.observed_at,
            "entries": [
                {
                    "metric": row["metric"],
                    "value": row["value"],
                    "unit": row["unit"],
                    "source_id": row["source_id"],
                    "metadata": row.get("metadata"),
                }
                for row in rows
            ],
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _preview_state(example: dict[str, Any], run_id: str) -> dict[str, Any]:
    """A fixed snapshot: keep the example's own as_of so it never poses as another clock."""
    state = copy.deepcopy(example)
    state["run_id"] = run_id
    return state


def _resources(override: dict[str, bool] | None) -> dict[str, bool]:
    """Policy resources, optionally overridden (tests, or ASTRO_VITAL_RESOURCES JSON for B04)."""
    if override is None and os.environ.get("ASTRO_VITAL_RESOURCES"):
        override = json.loads(os.environ["ASTRO_VITAL_RESOURCES"])
    resources = dict(POLICY["resources"])
    for key, value in (override or {}).items():
        if key not in resources or not isinstance(value, bool):
            raise ValueError(f"unknown resource or non-boolean value: {key}")
        resources[key] = value
    return resources


def _seed_for(
    scenario_id: str,
    crew_fixture_path: str | Path | None,
    radlab_csv_path: str | Path | None,
) -> list[dict[str, Any]] | None:
    """Validate the scenario seed before any run row exists.

    `None` means the seed file is absent, so the caller may serve the explicit preview.
    A present but invalid seed raises `HTTPException(500)` with the failing file and
    reason; it is never downgraded to preview data.
    """
    if scenario_id == "sleep_vigilance":
        try:
            return load_crew_fixture(crew_fixture_path)
        except CrewFixtureError as error:
            raise HTTPException(500, f"Crew fixture is invalid: {error}") from error

    seed = load_radlab_archive(radlab_csv_path)
    if seed is not None:
        return seed
    target = Path(
        radlab_csv_path or os.environ.get("ASTRO_VITAL_RADLAB_CSV") or DEFAULT_RADLAB_CSV
    )
    if target.is_file():
        raise HTTPException(
            500,
            f"RadLab archive at {target} exists but failed verification; "
            "refusing to serve the fixture preview as historical replay",
        )
    return None


def create_app(
    db_path: str | Path | None = None,
    resources: dict[str, bool] | None = None,
    crew_fixture_path: str | Path | None = None,
    radlab_csv_path: str | Path | None = None,
) -> FastAPI:
    """Build the app around one SQLite file (tests use their own temporary database)."""
    resources = _resources(resources)
    store = Storage(db_path or os.environ.get("ASTRO_VITAL_DB") or DEFAULT_DB)
    store.initialize()
    examples = {
        scenario: json.loads((EXAMPLES / config["example"]).read_text(encoding="utf-8"))
        for scenario, config in SCENARIOS.items()
    }

    app = FastAPI(title="Astro Vital API")

    @app.exception_handler(RequestValidationError)
    async def validation_error_response(_request, error: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={'detail': _validation_json(jsonable_encoder(error.errors()))},
        )

    def run_or_404(run_id: str) -> dict[str, str]:
        run = store.get_run(run_id)
        if run is None:
            raise HTTPException(404, "Unknown run")
        return run

    @app.post("/api/v1/runs", status_code=201)
    def create_run(request: RunRequest, response: Response) -> dict[str, str]:
        config = SCENARIOS[request.scenario_id]
        # Load and validate first: an invalid seed must not leave an orphan run behind.
        seed = _seed_for(request.scenario_id, crew_fixture_path, radlab_csv_path)
        run = {
            "run_id": uuid4().hex,
            "scenario_id": request.scenario_id,
            "initial_as_of": config["initial_as_of"],
            "range_start": config["range_start"],
            "range_end": config["range_end"],
        }
        try:
            store.create_run(run, seed)
        except DuplicateSeedError as error:
            raise HTTPException(500, f"Seed data for this run is invalid: {error}") from error

        # Truthful at creation time: claim integrated only when seeds were written.
        response.headers["X-Data-Mode"] = INTEGRATED_MODE if seed else PREVIEW_MODE
        return run

    @app.get("/api/v1/runs/{run_id}/state")
    def get_state(run_id: str, response: Response, as_of: str = Query(...)) -> dict[str, Any]:
        run = run_or_404(run_id)
        _clock_in_range(run, as_of, "as_of")
        observations = store.list_observations(run_id, as_of=as_of)
        if store.count_observations(run_id) == 0:
            response.headers["X-Data-Mode"] = PREVIEW_MODE
            response.headers["X-Data-Source"] = PREVIEW_SOURCE
            return _preview_state(examples[run["scenario_id"]], run_id)
        # Only visible observations; the engine owns every status, action and incident.
        state = evaluate(
            run["scenario_id"],
            run_id,
            as_of,
            observations,
            dict(resources),
            POLICY,
        )
        response.headers["X-Data-Mode"] = INTEGRATED_MODE
        return state

    @app.get("/api/v1/runs/{run_id}/observations")
    def get_observations(
        run_id: str,
        response: Response,
        as_of: str = Query(...),
        source_id: str | None = None,
        metric: str | None = None,
        limit: int = Query(180, ge=1, le=SQLITE_MAX_INTEGER),
    ) -> dict[str, list[dict[str, Any]]]:
        run = run_or_404(run_id)
        _clock_in_range(run, as_of, "as_of")
        response.headers["X-Data-Mode"] = INTEGRATED_MODE
        return {
            "observations": store.list_observations(
                run_id,
                as_of=as_of,
                source_id=source_id,
                metric=metric,
                limit=limit,
            )
        }

    @app.post("/api/v1/runs/{run_id}/observations", status_code=201)
    def submit_observations(
        run_id: str, submission: Submission, response: Response
    ) -> dict[str, Any]:
        run = run_or_404(run_id)
        if run["scenario_id"] != "sleep_vigilance":
            raise HTTPException(422, "Observations can only be submitted to a behavioral run")
        _clock_in_range(run, submission.observed_at, "observed_at")
        for entry in submission.entries:
            try:
                _validate_entry(entry)
            except ValueError as error:
                raise HTTPException(422, str(error)) from error
        rows = [
            _observation(submission, entry, index)
            for index, entry in enumerate(submission.entries)
        ]
        try:
            created, observation_ids = store.add_submission(
                run_id,
                submission.submission_id,
                submission.observed_at,
                _payload_hash(submission, rows),
                rows,
            )
        except SubmissionConflict as error:
            raise HTTPException(
                409, "submission_id was already used with a different payload"
            ) from error
        response.status_code = 201 if created else 200
        response.headers["X-Data-Mode"] = INTEGRATED_MODE
        return {
            "submission_id": submission.submission_id,
            "observation_ids": observation_ids,
        }

    # Offline launch: serve the built shell from the same loopback origin as the API.
    frontend_dist = ROOT / "frontend" / "dist"
    if frontend_dist.is_dir():
        app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")

    return app
