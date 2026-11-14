"""Historical acceptance gate; missing or mismatched bytes are explicitly Blocked.

Run with --api after the seeded API is integrated. This is not browser/offline X01.
"""

from __future__ import annotations

import argparse
import inspect
import json
from pathlib import Path
import sqlite3
import sys
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.engine import evaluate
from backend.replay.importer import import_radlab_csv, verify_radlab_archive

CHECKPOINTS = ("23:12:25", "23:17:25", "23:17:26", "23:20:00", "23:30:00")


def database_snapshot(path):
    """Read committed logical contents, including transactions still in SQLite WAL."""
    connection = sqlite3.connect(path)
    try:
        return tuple(connection.iterdump())
    finally:
        connection.close()


def check_states(states, rows):
    """Assert real replay behavior. Caller is responsible for verifying provenance."""
    def source(time, name):
        return next(item for item in states[time]["sources"] if item["source_id"] == name)

    assert all(source("23:12:25", name)["state"] == "current" for name in ("DosTel1", "DosTel2")), "A02 initial sources"
    assert (source("23:17:25", "DosTel1")["state"], source("23:17:25", "DosTel1")["age_seconds"]) == ("current", 300), "A02 current boundary"
    assert (source("23:17:26", "DosTel1")["state"], source("23:17:26", "DosTel1")["age_seconds"]) == ("stale", 301), "A02 stale boundary"
    assert source("23:17:26", "DosTel2")["state"] == "current", "A02 corroborating source"
    early, late = states["23:20:00"], states["23:30:00"]
    assert (source("23:20:00", "DosTel1")["state"], source("23:20:00", "DosTel2")["state"]) == ("stale", "current"), "A03 source states"
    assert (source("23:20:00", "DosTel1")["age_seconds"], source("23:20:00", "DosTel2")["age_seconds"]) == (455, 0), "A03 ages"
    by_id = {row["id"]: row for row in early["observations"]}
    for name, expected in (("DosTel1", 1.65945), ("DosTel2", 2.211496)):
        assert by_id[source("23:20:00", name)["last_observation_id"]]["value"] == expected, "A03 original value"
    assert len(early["incidents"]) == 1, "A03 exactly one incident"
    incident = early["incidents"][0]
    assert (incident["source_id"], incident["state"], incident["opened_at"], incident["closed_at"]) == (
        "DosTel1", "open", "2022-04-01T23:17:26Z", None), "A03 open incident"
    assert all(item["state"] == "current" for item in late["sources"]), "A04 current sources"
    assert len(late["incidents"]) == 1, "A04 one retained incident"
    closed = late["incidents"][0]
    assert closed["id"] == incident["id"] and closed["state"] == "resolved", "A04 stable resolved ID"
    preceding = by_id[incident["last_observation_id"]]
    next_reading = min(row["observed_at"] for row in rows if row["source_id"] == "DosTel1"
                       and row["observed_at"] > preceding["observed_at"])
    assert closed["closed_at"] == next_reading, "A04 closure from actual first recovery reading"
    for state in states.values():
        visible = {row["id"] for row in state["observations"]}
        assert len(visible) == len(state["observations"]), "Duplicate returned observation"
        assert all(row["observed_at"] <= state["as_of"] for row in state["observations"]), "Future reading leaked"
        for assessment in state["assessments"]:
            for item in assessment["supporting_evidence"] + assessment["conflicting_evidence"]:
                assert set(item["observation_ids"]) <= visible, "Missing evidence reference"


def run_checks(csv_path=None, api=False):
    archive = verify_radlab_archive(csv_path)
    result = {"archive": archive, "checks": {"A01": archive["status"]},
              "api": "Not run", "X01": "Not run — requires offline browser rehearsal"}
    if archive["status"] != "Pass":
        result["checks"].update({name: "Blocked" for name in ("A02", "A03", "A04")})
        result["reason"] = archive["reason"]
        return result
    try:
        rows = import_radlab_csv(archive["path"])
        policy = json.loads((ROOT / "rules/demo-v1.json").read_text(encoding="utf-8"))
        states = {time: evaluate("radlab_stale", "historical-engine-check",
                  f"2022-04-01T{time}Z", rows, policy["resources"], policy)
                  for time in CHECKPOINTS}
        check_states(states, rows)
        # Re-evaluate after recovery, rather than reusing a cached earlier envelope.
        rewind = evaluate("radlab_stale", "historical-engine-check", "2022-04-01T23:20:00Z",
                          rows, policy["resources"], policy)
        assert rewind == states["23:20:00"], "A04 rewind/determinism"
        result["checks"].update({name: "Pass" for name in ("A02", "A03", "A04")})
        result["snapshots"] = states
    except (AssertionError, ValueError, KeyError, StopIteration) as exc:
        result["checks"].update({name: "Fail" for name in ("A02", "A03", "A04")})
        result["reason"] = str(exc)
        return result
    if not api:
        return result
    from backend.api.main import create_app
    if "radlab_csv_path" not in inspect.signature(create_app).parameters:
        result["api"] = "Blocked — seeded API integration is not installed"
        return result
    from fastapi.testclient import TestClient
    try:
        with TemporaryDirectory() as temporary:
            db = Path(temporary) / "historical-check.db"
            with TestClient(create_app(db_path=db, radlab_csv_path=archive["path"])) as client:
                created = client.post("/api/v1/runs", json={"scenario_id": "radlab_stale"})
                assert created.status_code == 201, created.text
                run_id = created.json()["run_id"]
                def snapshot(time):
                    response = client.get(f"/api/v1/runs/{run_id}/state",
                                          params={"as_of": f"2022-04-01T{time}Z"})
                    assert response.status_code == 200, response.text
                    assert response.headers.get("x-data-mode") == "integrated", "API returned preview"
                    assert response.json()["as_of"] == f"2022-04-01T{time}Z", "API changed requested clock"
                    return response.json()
                observed = {time: snapshot(time) for time in CHECKPOINTS}
                check_states(observed, rows)
                before_reads = database_snapshot(db)
                assert snapshot("23:20:00") == observed["23:20:00"], "API rewind changed earlier view"
                assert snapshot("23:20:00") == observed["23:20:00"], "API repeated-read instability"
                assert database_snapshot(db) == before_reads, "GET mutated persisted database"
                result["api"] = "Pass"
                result["api_run_id"] = run_id
    except (AssertionError, ValueError, KeyError, StopIteration) as exc:
        result["api"] = "Fail"
        result["api_reason"] = str(exc)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", help="Original pinned CSV path; environment/default path also supported")
    parser.add_argument("--api", action="store_true", help="Also verify the integrated seeded API")
    parser.add_argument("--output", type=Path, help="Save full JSON evidence to this path")
    args = parser.parse_args()
    result = run_checks(args.csv, args.api)
    text = json.dumps(result, indent=2, ensure_ascii=False)
    if args.output:
        args.output.write_text(text + "\n", encoding="utf-8")
    print(text)
    statuses = list(result["checks"].values())
    if "Fail" in statuses or result["api"] == "Fail":
        return 1
    if "Blocked" in statuses or (args.api and result["api"] != "Pass"):
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
