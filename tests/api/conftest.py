import pytest
from fastapi.testclient import TestClient

from backend.api.main import create_app


@pytest.fixture()
def client(tmp_path):
    """Each test gets its own SQLite file, so runs never leak between tests."""
    app = create_app(tmp_path / 'runs.db')
    with TestClient(app) as test_client:
        yield test_client
