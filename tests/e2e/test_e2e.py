"""End-to-end backend gate for the combined runtime (HZ-18).

Scope: the seeded API, SQLite persistence, the merged engine and the RadLab archive
gate, driven from committed or independently verified inputs.

Gate vocabulary

| ID       | Meaning |
|----------|---------|
| A01      | RadLab archive verification: pinned SHA-256 and 84/96 record counts |
| A02-A04  | Real RadLab replay checkpoints, asserted only when A01 passes |
| B01      | Crew 09:00 checkpoint: `insufficient_data`, no seeded 09:01 reaction |
| B02      | Crew 09:01 checkpoint: `watch` from the seeded 310 ms sample |
| B04      | Disabled reaction resource keeps the action visible with a fallback |
| B05      | Submission 201/200/same IDs/409, changed payload, reset isolation |
| AF01     | Asset **preflight**: local bundle exists and references local assets |
| X01      | Offline **browser rehearsal**: never asserted here |

AF01 is a static preflight, not X01. X01 stays `Not run` until a person launches the
built bundle with the network disabled and records the observed result following
`acceptance/manual-checklist.md`; no scan or API assertion can promote it to Pass.

Exit status is 0 only when every required checkpoint passes. A missing canonical crew
fixture or a failed assertion is a failure. A missing RadLab archive is reported as
`Blocked`, separately from passing checks, and is never replaced with synthetic data
that looks historical.
"""

from __future__ import annotations

import re
import sys
from datetime import datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from backend.api.main import create_app  # noqa: E402
from backend.replay import verify_radlab_archive  # noqa: E402

CREW_FIXTURE = ROOT / "fixtures" / "crew" / "sleep-vigilance.json"
FRONTEND_DIST = ROOT / "frontend" / "dist"
X01_NOT_RUN = (
    "Not run - needs a real browser rehearsal with the network disabled; follow "
    "acceptance/manual-checklist.md and record the observed result"
)
REQUIRED_CHECKS = ("B01", "B02", "B04", "B05")
ARCHIVE_CHECKS = ("A01", "A02-A04")

SLEEP = {"metric": "sleep_duration", "value": 400, "unit": "min", "source_id": "crew_sleep_log"}
WHOLE_SECOND_UTC = "%Y-%m-%dT%H:%M:%SZ"


def utc(value: str) -> datetime:
    return datetime.strptime(value, WHOLE_SECOND_UTC)


def offset(value: str, seconds: int) -> str:
    return (utc(value) + timedelta(seconds=seconds)).strftime(WHOLE_SECOND_UTC)


def asset_preflight() -> str:
    """AF01: the built bundle exists and only references local assets.

    Static inspection only. This does not exercise a browser, a network or the API.
    """
    index = FRONTEND_DIST / "index.html"
    if not index.is_file():
        return (
            "Blocked - frontend/dist/index.html is not built; "
            "run 'npm --prefix frontend run build'"
        )
    html = index.read_text(encoding="utf-8")
    refs = re.findall(r'(?:src|href)="([^"]+)"', html)
    remote = [
        ref
        for ref in refs
        if re.match(r"(?:https?:)?//", ref)
        and not re.match(r"(?:https?:)?//(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:/|$)", ref)
    ]
    if remote:
        return f"Fail - remote asset references found: {remote}"
    missing = [
        ref
        for ref in refs
        if ref.startswith("/") and not (FRONTEND_DIST / ref.lstrip("/")).is_file()
    ]
    if missing:
        return f"Fail - referenced local assets are missing: {missing}"
    return f"Pass - {len(refs)} local asset reference(s), no remote references"


def seeded_client(tmp_path: Path, name: str, **kwargs) -> TestClient:
    app = create_app(
        tmp_path / f"{name}.db",
        crew_fixture_path=CREW_FIXTURE,
        radlab_csv_path=tmp_path / "absent-radlab.csv",
        **kwargs,
    )
    return TestClient(app)


def create_run(client: TestClient, scenario_id: str = "sleep_vigilance"):
    response = client.post("/api/v1/runs", json={"scenario_id": scenario_id})
    assert response.status_code == 201, f"run creation failed: {response.status_code} {response.text}"
    return response


def state(client: TestClient, run_id: str, as_of: str):
    response = client.get(f"/api/v1/runs/{run_id}/state", params={"as_of": as_of})
    assert response.status_code == 200, f"state {as_of} failed: {response.status_code} {response.text}"
    return response


def history(client: TestClient, run_id: str, as_of: str, **params):
    response = client.get(
        f"/api/v1/runs/{run_id}/observations",
        params={"as_of": as_of, "limit": 500, **params},
    )
    assert response.status_code == 200, f"history {as_of} failed: {response.status_code}"
    return response.json()["observations"]


def check_b01(tmp_path: Path) -> None:
    with seeded_client(tmp_path, "b01") as client:
        created = create_run(client)
        assert created.headers["x-data-mode"] == "integrated", "seeded run must report integrated"
        run_id = created.json()["run_id"]

        b01 = state(client, run_id, "2026-01-10T09:00:00Z")
        assert b01.headers["x-data-mode"] == "integrated"
        body = b01.json()
        assert body["as_of"] == "2026-01-10T09:00:00Z"
        [assessment] = body["assessments"]
        assert assessment["state"] == "insufficient_data", assessment["state"]
        assert assessment["title"] == "Vigilance data missing", assessment["title"]
        assert assessment["missing_inputs"] == ["reaction_time"], assessment["missing_inputs"]
        assert "start_reaction_check" in assessment["action_ids"]

        visible = history(client, run_id, "2026-01-10T09:00:00Z")
        assert len(visible) == 13, f"expected 13 seeded rows at 09:00, got {len(visible)}"
        ids = {row["id"] for row in visible}
        assert "reaction-10" not in ids, "the 09:01 sample must stay in the future at 09:00"
        assert "sleep-10" in ids


def check_b02(tmp_path: Path) -> None:
    with seeded_client(tmp_path, "b02") as client:
        run_id = create_run(client).json()["run_id"]

        b02 = state(client, run_id, "2026-01-10T09:01:00Z")
        assert b02.headers["x-data-mode"] == "integrated"
        body = b02.json()
        assert body["as_of"] == "2026-01-10T09:01:00Z"
        [assessment] = body["assessments"]
        assert assessment["state"] == "watch", assessment["state"]
        assert assessment["title"] == "Sleep and vigilance change", assessment["title"]
        assert len(assessment["supporting_evidence"]) == 2, assessment["supporting_evidence"]
        baseline_ids = {
            evidence.get("baseline_id") for evidence in assessment["supporting_evidence"]
        }
        assert baseline_ids == {"crew-demo-sleep-v1", "crew-demo-reaction-v1"}, baseline_ids

        visible = history(client, run_id, "2026-01-10T09:01:00Z")
        assert len(visible) == 14, f"expected 14 seeded rows at 09:01, got {len(visible)}"
        assert visible[-1]["id"] == "reaction-10"
        assert visible[-1]["value"] == 310
        assert visible[-1]["provenance"] == "SYNTHETIC"
        assert visible[-1]["metadata"]["input_profile"] == "seeded-demo"


def check_b04(tmp_path: Path) -> None:
    with seeded_client(tmp_path, "b04", resources={"local_reaction_task": False}) as client:
        run_id = create_run(client).json()["run_id"]
        body = state(client, run_id, "2026-01-10T09:00:00Z").json()
        actions = {action["id"]: action for action in body["actions"]}
        assert actions["start_reaction_check"]["available"] is False
        assert (
            actions["start_reaction_check"]["unavailable_reason"]
            == "Reaction check unavailable"
        ), actions["start_reaction_check"]["unavailable_reason"]
        assert actions["review_available_inputs"]["available"] is True
        # The assessment stays pending: a disabled task never invents a reaction result.
        [assessment] = body["assessments"]
        assert assessment["state"] == "insufficient_data"
        assert assessment["missing_inputs"] == ["reaction_time"]


def check_b05(tmp_path: Path) -> None:
    with seeded_client(tmp_path, "b05") as client:
        run1 = create_run(client).json()["run_id"]
        payload = {
            "submission_id": "e2e-sub-1",
            "observed_at": "2026-01-10T09:05:00Z",
            "entries": [SLEEP],
        }

        first = client.post(f"/api/v1/runs/{run1}/observations", json=payload)
        assert first.status_code == 201, first.text
        observation_ids = first.json()["observation_ids"]

        retry = client.post(f"/api/v1/runs/{run1}/observations", json=payload)
        assert retry.status_code == 200, retry.text
        assert retry.json()["observation_ids"] == observation_ids

        conflict = client.post(
            f"/api/v1/runs/{run1}/observations",
            json={**payload, "entries": [{**SLEEP, "value": 400 + 15}]},
        )
        assert conflict.status_code == 409, conflict.text

        run2 = create_run(client).json()["run_id"]
        assert run2 != run1
        run1_history = history(client, run1, "2026-01-10T09:10:00Z")
        run2_history = history(client, run2, "2026-01-10T09:10:00Z")
        assert len(run1_history) == 15, f"expected 14 seeds + 1 submission, got {len(run1_history)}"
        assert len(run2_history) == 14, f"reset run must hold only its seeds, got {len(run2_history)}"
        assert observation_ids[0] in {row["id"] for row in run1_history}
        assert observation_ids[0] not in {row["id"] for row in run2_history}


def preview_is_labeled(tmp_path: Path) -> None:
    """A blocked archive may still be exercised as the explicit, labeled preview."""
    app = create_app(
        tmp_path / "preview.db",
        crew_fixture_path=tmp_path / "absent-crew.json",
        radlab_csv_path=tmp_path / "absent-radlab.csv",
    )
    with TestClient(app) as client:
        run_id = create_run(client, "radlab_stale").json()["run_id"]
        preview = state(client, run_id, "2022-04-01T23:20:00Z")
        assert preview.headers["x-data-mode"] == "fixture-preview"
        assert preview.headers["x-data-source"] == "contracts/examples"


def check_a02_a04(tmp_path: Path, archive: dict) -> str:
    path = Path(archive["path"])
    if not path.is_file():
        preview_is_labeled(tmp_path)
        return f"Blocked - {archive.get('reason', 'RadLab archive not available')}"

    with TestClient(
        create_app(
            tmp_path / "radlab.db",
            crew_fixture_path=tmp_path / "absent-crew.json",
            radlab_csv_path=path,
        )
    ) as client:
        created = create_run(client, "radlab_stale")
        assert created.headers["x-data-mode"] == "integrated"
        run_id = created.json()["run_id"]

        rows = history(client, run_id, "2022-04-02T01:04:59Z")
        dos1 = [row for row in rows if row["source_id"] == "DosTel1"]
        dos2 = [row for row in rows if row["source_id"] == "DosTel2"]
        assert len(dos1) == 84, f"expected 84 DosTel1 rows, got {len(dos1)}"
        assert len(dos2) == 96, f"expected 96 DosTel2 rows, got {len(dos2)}"

        a02_clock = "2022-04-01T23:12:25Z"
        last_dos1_at_a02 = max(
            (row for row in dos1 if row["observed_at"] <= a02_clock),
            key=lambda row: (row["observed_at"], row["id"]),
        )
        stale_from = offset(last_dos1_at_a02["observed_at"], 301)
        current_through = offset(last_dos1_at_a02["observed_at"], 300)

        # A02: freshness boundaries come from the archive timestamps, not a mock.
        at_start = state(client, run_id, a02_clock).json()
        assert [source["state"] for source in at_start["sources"]] == ["current", "current"]
        assert at_start["incidents"] == []
        at_300 = state(client, run_id, current_through).json()
        dos1_300 = next(s for s in at_300["sources"] if s["source_id"] == "DosTel1")
        assert dos1_300["state"] == "current"
        assert dos1_300["age_seconds"] == 300
        assert at_300["incidents"] == []
        at_301 = state(client, run_id, stale_from).json()
        dos1_301 = next(s for s in at_301["sources"] if s["source_id"] == "DosTel1")
        assert dos1_301["state"] == "stale"
        assert dos1_301["age_seconds"] == 301
        [incident] = [i for i in at_301["incidents"] if i["source_id"] == "DosTel1"]
        assert incident["state"] == "open"
        assert incident["opened_at"] == stale_from
        assert incident["closed_at"] is None
        assert incident["last_observation_id"] == last_dos1_at_a02["id"]

        # A03: the 23:20 checkpoint shows DosTel1 stale with its real age.
        a03_clock = "2022-04-01T23:20:00Z"
        a03 = state(client, run_id, a03_clock).json()
        dos1_2320 = next(s for s in a03["sources"] if s["source_id"] == "DosTel1")
        dos2_2320 = next(s for s in a03["sources"] if s["source_id"] == "DosTel2")
        last_dos1 = max(
            (row for row in dos1 if row["observed_at"] <= a03_clock),
            key=lambda row: (row["observed_at"], row["id"]),
        )
        last_dos2 = max(
            (row for row in dos2 if row["observed_at"] <= a03_clock),
            key=lambda row: (row["observed_at"], row["id"]),
        )
        assert dos1_2320["state"] == "stale"
        assert dos1_2320["age_seconds"] == int(
            utc(a03_clock).timestamp() - utc(last_dos1["observed_at"]).timestamp()
        )
        assert dos1_2320["last_observation_id"] == last_dos1["id"]
        assert dos2_2320["state"] == "current"
        assert dos2_2320["age_seconds"] == int(
            utc(a03_clock).timestamp() - utc(last_dos2["observed_at"]).timestamp()
        )
        [open_incident] = [i for i in a03["incidents"] if i["source_id"] == "DosTel1"]
        assert open_incident["state"] == "open"

        # A04: recovery time is read from the archive, not assumed.
        recovered = next(row for row in dos1 if row["observed_at"] >= stale_from)
        at_recovery = state(client, run_id, recovered["observed_at"]).json()
        [resolved] = [i for i in at_recovery["incidents"] if i["source_id"] == "DosTel1"]
        assert resolved["state"] == "resolved"
        assert resolved["closed_at"] == recovered["observed_at"]
        assert recovered["id"] in {row["id"] for row in at_recovery["observations"]}

        # Rewind: the incident is open again and no future closure leaks in.
        rewind = state(client, run_id, a03_clock).json()
        [rewound] = [i for i in rewind["incidents"] if i["source_id"] == "DosTel1"]
        assert rewound["state"] == "open"
        assert rewound["closed_at"] is None
        assert all(row["observed_at"] <= a03_clock for row in rewind["observations"])

    return "Pass - A02/A03/A04 checkpoints derived from the verified archive"


def run_e2e_checks() -> dict[str, str]:
    """Run every gate and return its truthful status."""
    results: dict[str, str] = {
        "AF01": asset_preflight(),
        "X01": X01_NOT_RUN,
    }

    with TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)

        if CREW_FIXTURE.is_file():
            for key, check in (
                ("B01", check_b01),
                ("B02", check_b02),
                ("B04", check_b04),
                ("B05", check_b05),
            ):
                try:
                    check(tmp_path)
                except AssertionError as error:
                    results[key] = f"Fail - {error}"
                except Exception as error:  # noqa: BLE001 - report, never hide
                    results[key] = f"Fail - unexpected {type(error).__name__}: {error}"
                else:
                    results[key] = "Pass"
        else:
            for key in REQUIRED_CHECKS:
                results[key] = f"Fail - canonical fixture missing at {CREW_FIXTURE}"

        archive = verify_radlab_archive()
        results["A01"] = archive["status"]
        try:
            results["A02-A04"] = check_a02_a04(tmp_path, archive)
        except AssertionError as error:
            results["A02-A04"] = f"Fail - {error}"
        except Exception as error:  # noqa: BLE001 - report, never hide
            results["A02-A04"] = f"Fail - unexpected {type(error).__name__}: {error}"

    return results


def failures(results: dict[str, str]) -> list[str]:
    """Required checks must pass; Blocked is allowed only for the external archive."""
    failed = [key for key in REQUIRED_CHECKS if results.get(key) != "Pass"]
    failed += [key for key in ARCHIVE_CHECKS if str(results.get(key, "")).startswith("Fail")]
    if str(results.get("AF01", "")).startswith("Fail"):
        failed.append("AF01")
    return failed


def print_report(results: dict[str, str]) -> None:
    print("=" * 72)
    print("ASTRO VITAL - COMBINED RUNTIME GATE (backend; not the offline rehearsal)")
    print("=" * 72)
    order = ("A01", "A02-A04", "B01", "B02", "B04", "B05", "AF01", "X01")
    for key in order:
        print(f"  {key:<8}: {results.get(key, 'Not run')}")
    print("-" * 72)
    failed = failures(results)
    print(f"  Required failures: {', '.join(failed) if failed else 'none'}")
    blocked = [key for key, value in results.items() if value.startswith("Blocked")]
    print(f"  Blocked: {', '.join(blocked) if blocked else 'none'}")
    print(f"  X01: {results['X01']}")
    print("=" * 72)


def main() -> int:
    results = run_e2e_checks()
    print_report(results)
    return 0 if not failures(results) else 1


def test_e2e():
    """Pytest wrapper: a required-check failure must fail the suite."""
    results = run_e2e_checks()
    failed = failures(results)
    assert not failed, f"required checks failed: {failed}; full results: {results}"
    assert results["X01"].startswith("Not run"), results["X01"]
    assert results["A01"] in ("Pass", "Blocked"), results["A01"]
    assert str(results["A02-A04"]).startswith(("Pass", "Blocked")), results["A02-A04"]


if __name__ == "__main__":
    sys.exit(main())
