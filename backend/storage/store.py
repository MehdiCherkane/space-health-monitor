"""SQLite persistence for runs, observations and crew submissions.

Seed fixtures stay read-only; a run owns the observations written into it. Reset is a
new run. One transaction covers a whole submission batch and `(run_id, submission_id)`
is unique.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
    run_id       TEXT PRIMARY KEY,
    scenario_id  TEXT NOT NULL,
    initial_as_of TEXT NOT NULL,
    range_start  TEXT NOT NULL,
    range_end    TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS observations (
    seq              INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id           TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
    id               TEXT NOT NULL,
    subject_id       TEXT,
    metric           TEXT NOT NULL,
    value            REAL NOT NULL,
    unit             TEXT NOT NULL,
    observed_at      TEXT NOT NULL,
    source_id        TEXT NOT NULL,
    provenance       TEXT NOT NULL,
    source_timestamp TEXT,
    metadata         TEXT,
    UNIQUE (run_id, id)
);

CREATE INDEX IF NOT EXISTS observations_by_run_time
    ON observations (run_id, observed_at, id);

CREATE TABLE IF NOT EXISTS submissions (
    run_id        TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
    submission_id TEXT NOT NULL,
    payload_hash  TEXT NOT NULL,
    observed_at   TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (run_id, submission_id)
);

CREATE TABLE IF NOT EXISTS submission_observations (
    run_id         TEXT NOT NULL,
    submission_id  TEXT NOT NULL,
    ordinal        INTEGER NOT NULL,
    observation_id TEXT NOT NULL,
    PRIMARY KEY (run_id, submission_id, ordinal),
    FOREIGN KEY (run_id, submission_id)
        REFERENCES submissions(run_id, submission_id) ON DELETE CASCADE
);
"""


class SubmissionConflict(Exception):
    """A submission ID was replayed with a different validated payload."""


def _observation(row: sqlite3.Row) -> dict[str, Any]:
    value = row["value"]
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    result: dict[str, Any] = {
        "id": row["id"],
        "subject_id": row["subject_id"],
        "metric": row["metric"],
        "value": value,
        "unit": row["unit"],
        "observed_at": row["observed_at"],
        "source_id": row["source_id"],
        "provenance": row["provenance"],
    }
    if row["source_timestamp"] is not None:
        result["source_timestamp"] = row["source_timestamp"]
    if row["metadata"] is not None:
        result["metadata"] = json.loads(row["metadata"])
    return result


class Storage:
    """File-backed SQLite store shared by the API process."""

    def __init__(self, path: str | Path) -> None:
        self.path = str(path)

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=15, isolation_level=None)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 15000")
        return connection

    def initialize(self) -> None:
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        connection = self._connect()
        try:
            connection.execute("PRAGMA journal_mode = WAL")
            connection.executescript(SCHEMA)
        finally:
            connection.close()

    def create_run(self, run: dict[str, str]) -> None:
        connection = self._connect()
        try:
            connection.execute(
                "INSERT INTO runs (run_id, scenario_id, initial_as_of, range_start, range_end)"
                " VALUES (?, ?, ?, ?, ?)",
                (
                    run["run_id"],
                    run["scenario_id"],
                    run["initial_as_of"],
                    run["range_start"],
                    run["range_end"],
                ),
            )
        finally:
            connection.close()

    def get_run(self, run_id: str) -> dict[str, str] | None:
        connection = self._connect()
        try:
            row = connection.execute(
                "SELECT run_id, scenario_id, initial_as_of, range_start, range_end"
                " FROM runs WHERE run_id = ?",
                (run_id,),
            ).fetchone()
        finally:
            connection.close()
        return dict(row) if row else None

    def count_observations(self, run_id: str) -> int:
        connection = self._connect()
        try:
            row = connection.execute(
                "SELECT COUNT(*) AS total FROM observations WHERE run_id = ?", (run_id,)
            ).fetchone()
        finally:
            connection.close()
        return int(row["total"])

    def list_observations(
        self,
        run_id: str,
        *,
        as_of: str | None = None,
        source_id: str | None = None,
        metric: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        """Return matching observations chronologically, keeping the newest `limit`."""
        clauses = ["run_id = ?"]
        params: list[Any] = [run_id]
        if as_of is not None:
            clauses.append("observed_at <= ?")
            params.append(as_of)
        if source_id is not None:
            clauses.append("source_id = ?")
            params.append(source_id)
        if metric is not None:
            clauses.append("metric = ?")
            params.append(metric)
        query = (
            "SELECT * FROM observations WHERE "
            + " AND ".join(clauses)
            + " ORDER BY observed_at DESC, id DESC"
        )
        if limit is not None:
            query += " LIMIT ?"
            params.append(limit)
        connection = self._connect()
        try:
            rows = [_observation(row) for row in connection.execute(query, params)]
        finally:
            connection.close()
        rows.reverse()
        return rows

    def seed_observations(self, run_id: str, observations: list[dict[str, Any]]) -> None:
        """Insert seed observations for a run atomically."""
        if not observations:
            return
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            connection.executemany(
                "INSERT OR IGNORE INTO observations (run_id, id, subject_id, metric, value, unit,"
                " observed_at, source_id, provenance, source_timestamp, metadata)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    (
                        run_id,
                        row["id"],
                        row.get("subject_id"),
                        row["metric"],
                        row["value"],
                        row["unit"],
                        row["observed_at"],
                        row["source_id"],
                        row["provenance"],
                        row.get("source_timestamp"),
                        json.dumps(row["metadata"]) if row.get("metadata") is not None else None,
                    )
                    for row in observations
                ],
            )
            connection.execute("COMMIT")
        except BaseException:
            try:
                connection.execute("ROLLBACK")
            except sqlite3.Error:
                pass
            raise
        finally:
            connection.close()

    def add_submission(
        self,
        run_id: str,
        submission_id: str,
        observed_at: str,
        payload_hash: str,
        observations: list[dict[str, Any]],
    ) -> tuple[bool, list[str]]:
        """Store a batch atomically.

        Returns `(created, observation_ids)`. A replay with the same payload returns the
        original IDs without writing; a different payload raises `SubmissionConflict`.
        """
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            existing = connection.execute(
                "SELECT payload_hash FROM submissions WHERE run_id = ? AND submission_id = ?",
                (run_id, submission_id),
            ).fetchone()
            if existing is not None:
                stored = [
                    row["observation_id"]
                    for row in connection.execute(
                        "SELECT observation_id FROM submission_observations"
                        " WHERE run_id = ? AND submission_id = ? ORDER BY ordinal",
                        (run_id, submission_id),
                    )
                ]
                connection.execute("ROLLBACK")
                if existing["payload_hash"] != payload_hash:
                    raise SubmissionConflict(submission_id)
                return False, stored
            connection.execute(
                "INSERT INTO submissions (run_id, submission_id, payload_hash, observed_at)"
                " VALUES (?, ?, ?, ?)",
                (run_id, submission_id, payload_hash, observed_at),
            )
            connection.executemany(
                "INSERT INTO observations (run_id, id, subject_id, metric, value, unit,"
                " observed_at, source_id, provenance, source_timestamp, metadata)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    (
                        run_id,
                        row["id"],
                        row["subject_id"],
                        row["metric"],
                        row["value"],
                        row["unit"],
                        row["observed_at"],
                        row["source_id"],
                        row["provenance"],
                        row.get("source_timestamp"),
                        json.dumps(row["metadata"]) if row.get("metadata") is not None else None,
                    )
                    for row in observations
                ],
            )
            connection.executemany(
                "INSERT INTO submission_observations"
                " (run_id, submission_id, ordinal, observation_id) VALUES (?, ?, ?, ?)",
                [
                    (run_id, submission_id, index, row["id"])
                    for index, row in enumerate(observations)
                ],
            )
            connection.execute("COMMIT")
            return True, [row["id"] for row in observations]
        except BaseException:
            try:
                connection.execute("ROLLBACK")
            except sqlite3.Error:
                pass
            raise
        finally:
            connection.close()
