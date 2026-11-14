"""Preview API for the two demo scenarios.

Stub mode: state and history come from contracts/examples. HZ-08/HZ-09/HZ-12
replace these with the replay store, evaluator and persisted submissions.
"""

from __future__ import annotations

import copy
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query, Request
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[2]
EXAMPLES = ROOT / "contracts" / "examples"

SCENARIOS: dict[str, dict[str, str]] = {
    "radlab_stale": {
        "initial_as_of": "2022-04-01T23:00:00Z",
        "range_start": "2022-04-01T23:00:00Z",
        "range_end": "2022-04-02T01:04:59Z",
        "example": "radlab-stale.json",
    },
    "sleep_vigilance": {
        "initial_as_of": "2026-01-10T09:00:00Z",
        "range_start": "2026-01-10T09:00:00Z",
        "range_end": "2026-01-10T10:00:00Z",
        "example": "sleep-vigilance-missing.json",
    },
}

WHOLE_SECOND_UTC = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
SUBMISSION_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")

# HZ-04 stub mode. HZ-08 replaces the example source and must drop this label.
PREVIEW_MODE = "fixture-preview"
PREVIEW_SOURCE = "contracts/examples"

app = FastAPI(title="Astro Vital preview API")


@app.middleware("http")
async def label_fixture_preview(request: Request, call_next):
    """Mark every response as stub data so preview cannot be read as integrated."""
    response = await call_next(request)
    response.headers["X-Data-Mode"] = PREVIEW_MODE
    response.headers["X-Data-Source"] = PREVIEW_SOURCE
    return response

_runs: dict[str, dict[str, str]] = {}
_examples = {
    scenario: json.loads((EXAMPLES / config["example"]).read_text(encoding="utf-8"))
    for scenario, config in SCENARIOS.items()
}


def _utc(value: str, field: str) -> datetime:
    if not WHOLE_SECOND_UTC.fullmatch(value):
        raise HTTPException(422, f"{field} must be a whole-second UTC timestamp ending in Z")
    return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def _run_or_404(run_id: str) -> dict[str, str]:
    run = _runs.get(run_id)
    if run is None:
        raise HTTPException(404, "Unknown run")
    return run


def _clock_in_range(run: dict[str, str], value: str, field: str) -> None:
    clock = _utc(value, field)
    if not (
        _utc(run["range_start"], "range_start")
        <= clock
        <= _utc(run["range_end"], "range_end")
    ):
        raise HTTPException(422, f"{field} is outside the run range")


class RunRequest(BaseModel):
    scenario_id: Literal["radlab_stale", "sleep_vigilance"]


class Entry(BaseModel):
    metric: str
    value: float
    unit: str
    source_id: str
    metadata: dict[str, Any] | None = None


class Submission(BaseModel):
    submission_id: str = Field(min_length=1, max_length=128, pattern=SUBMISSION_ID.pattern)
    observed_at: str
    entries: list[Entry] = Field(min_length=1)


def _validate_entry(entry: Entry) -> None:
    if (entry.source_id, entry.metric, entry.unit) == (
        "crew_sleep_log",
        "sleep_duration",
        "min",
    ):
        if not 0 <= entry.value <= 1440:
            raise ValueError("sleep_duration must be between 0 and 1440 minutes")
        return
    if (
        entry.source_id == "crew_self_report"
        and entry.metric in {"fatigue", "mood", "stress"}
        and entry.unit == "score_0_10"
    ):
        if not entry.value.is_integer() or not 0 <= entry.value <= 10:
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


@app.post("/api/v1/runs", status_code=201)
def create_run(request: RunRequest) -> dict[str, str]:
    config = SCENARIOS[request.scenario_id]
    run_id = uuid4().hex
    run = {
        "run_id": run_id,
        "scenario_id": request.scenario_id,
        "initial_as_of": config["initial_as_of"],
        "range_start": config["range_start"],
        "range_end": config["range_end"],
    }
    _runs[run_id] = run
    return run


@app.get("/api/v1/runs/{run_id}/state")
def get_state(run_id: str, as_of: str = Query(...)) -> dict[str, Any]:
    run = _run_or_404(run_id)
    _clock_in_range(run, as_of, "as_of")
    state = copy.deepcopy(_examples[run["scenario_id"]])
    state["run_id"] = run_id
    state["as_of"] = as_of
    return state


@app.get("/api/v1/runs/{run_id}/observations")
def get_observations(
    run_id: str,
    as_of: str = Query(...),
    source_id: str | None = None,
    metric: str | None = None,
    limit: int = Query(180, ge=1, le=180),
) -> dict[str, list[dict[str, Any]]]:
    run = _run_or_404(run_id)
    _clock_in_range(run, as_of, "as_of")
    rows = [
        row
        for row in _examples[run["scenario_id"]]["observations"]
        if row["observed_at"] <= as_of
        and (source_id is None or row["source_id"] == source_id)
        and (metric is None or row["metric"] == metric)
    ]
    rows.sort(key=lambda row: (row["observed_at"], row["id"]))
    return {"observations": rows[-limit:]}


@app.post("/api/v1/runs/{run_id}/observations", status_code=201)
def submit_observations(run_id: str, submission: Submission) -> dict[str, Any]:
    run = _run_or_404(run_id)
    if run["scenario_id"] != "sleep_vigilance":
        raise HTTPException(422, "Observations can only be submitted to a behavioral run")
    _clock_in_range(run, submission.observed_at, "observed_at")
    for entry in submission.entries:
        try:
            _validate_entry(entry)
        except ValueError as error:
            raise HTTPException(422, str(error)) from error
    return {
        "submission_id": submission.submission_id,
        "observation_ids": [uuid4().hex for _ in submission.entries],
    }
