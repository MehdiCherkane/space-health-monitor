"""Shared-shell contract check (HZ-R4).

The App/`useReplay` tests render the engine envelopes in
`frontend/src/gallery/states.json`. This test proves those envelopes are the *same*
objects the seeded runtime returns for B01 and B02, so the shell is verified against
seeded responses rather than a parallel hand-written fixture.

Only `run_id` is normalized; `as_of`, sources, observations, assessments, actions and
incidents must match exactly. A drift here means the frontend tests no longer describe
the real runtime.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from backend.api.main import create_app  # noqa: E402

CREW_FIXTURE = ROOT / "fixtures" / "crew" / "sleep-vigilance.json"
GALLERY = ROOT / "frontend" / "src" / "gallery" / "states.json"


def gallery_state(state_id: str) -> dict:
    states = json.loads(GALLERY.read_text(encoding="utf-8"))
    return next(item["state"] for item in states if item["id"] == state_id)


def seeded_state(tmp_path: Path, as_of: str) -> dict:
    app = create_app(
        tmp_path / "shell-contract.db",
        crew_fixture_path=CREW_FIXTURE,
        radlab_csv_path=tmp_path / "absent-radlab.csv",
    )
    with TestClient(app) as client:
        created = client.post("/api/v1/runs", json={"scenario_id": "sleep_vigilance"})
        assert created.status_code == 201, created.text
        run_id = created.json()["run_id"]
        response = client.get(f"/api/v1/runs/{run_id}/state", params={"as_of": as_of})
        assert response.status_code == 200, response.text
        return response.json()


def test_b01_and_b02_match_the_envelopes_the_shell_renders():
    assert CREW_FIXTURE.is_file(), f"canonical crew fixture missing at {CREW_FIXTURE}"
    assert GALLERY.is_file(), f"gallery states missing at {GALLERY}"

    with TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        for state_id, as_of in (
            ("state-8", "2026-01-10T09:00:00Z"),  # B01
            ("state-9", "2026-01-10T09:01:00Z"),  # B02
        ):
            expected = json.loads(json.dumps(gallery_state(state_id)))
            actual = json.loads(json.dumps(seeded_state(tmp_path, as_of)))
            actual["run_id"] = expected["run_id"]
            assert actual == expected, (
                f"{state_id} diverged from the seeded runtime at {as_of}: "
                f"{sorted(key for key in expected if actual.get(key) != expected[key])}"
            )
