"""Shared API test fixtures.

Two explicit app modes, so tests never depend on whether the on-disk seed files
happen to exist:

- `client` — absent crew/archive paths: the empty-run and preview behavior.
- `seeded_client` — the ACTUAL committed canonical fixture at
  `fixtures/crew/sleep-vigilance.json`, for the integrated B01/B02/B05 path.

The RadLab archive is deliberately absent from both: it is a pinned external input that
is not in the repository, so A02-A04 stay Blocked until it is supplied.
"""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.api.main import create_app

ROOT = Path(__file__).resolve().parents[2]
CREW_FIXTURE = ROOT / 'fixtures' / 'crew' / 'sleep-vigilance.json'


@pytest.fixture()
def crew_fixture_path() -> Path:
    """The committed canonical fixture; a prerequisite for the integrated tests."""
    assert CREW_FIXTURE.is_file(), f'canonical crew fixture missing at {CREW_FIXTURE}'
    return CREW_FIXTURE


@pytest.fixture()
def client(tmp_path):
    """Explicit absent seed inputs: an empty run that serves the fixture preview."""
    app = create_app(
        tmp_path / 'runs.db',
        crew_fixture_path=tmp_path / 'absent-crew.json',
        radlab_csv_path=tmp_path / 'absent-radlab.csv',
    )
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def seeded_client(tmp_path, crew_fixture_path):
    """A run seeded from the real canonical fixture, evaluated by the real engine."""
    app = create_app(
        tmp_path / 'seeded.db',
        crew_fixture_path=crew_fixture_path,
        radlab_csv_path=tmp_path / 'absent-radlab.csv',
    )
    with TestClient(app) as test_client:
        yield test_client
