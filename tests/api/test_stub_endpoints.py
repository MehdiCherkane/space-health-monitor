import json
from pathlib import Path

EXAMPLES = Path(__file__).resolve().parents[2] / 'contracts' / 'examples'

SLEEP = {'metric': 'sleep_duration', 'value': 400, 'unit': 'min', 'source_id': 'crew_sleep_log'}
FATIGUE = {'metric': 'fatigue', 'value': 3, 'unit': 'score_0_10', 'source_id': 'crew_self_report'}
REACTION = {'metric': 'reaction_time', 'value': 300, 'unit': 'ms', 'source_id': 'reaction_task'}


def example(name: str) -> dict:
    return json.loads((EXAMPLES / name).read_text(encoding='utf-8'))


def create_run(client, scenario_id: str) -> dict:
    response = client.post('/api/v1/runs', json={'scenario_id': scenario_id})
    assert response.status_code == 201, response.text
    return response.json()


def test_create_radlab_run_returns_contract_range(client):
    run = create_run(client, 'radlab_stale')
    assert run['scenario_id'] == 'radlab_stale'
    assert run['initial_as_of'] == '2022-04-01T23:00:00Z'
    assert run['range_start'] == '2022-04-01T23:00:00Z'
    assert run['range_end'] == '2022-04-02T01:04:59Z'
    assert run['run_id']


def test_create_behavioral_run_returns_session_range(client):
    run = create_run(client, 'sleep_vigilance')
    assert run['scenario_id'] == 'sleep_vigilance'
    assert run['initial_as_of'] == '2026-01-10T09:00:00Z'
    assert run['range_start'] == '2026-01-10T09:00:00Z'
    assert run['range_end'] == '2026-01-10T10:00:00Z'


def test_rejects_unknown_scenario(client):
    assert client.post('/api/v1/runs', json={'scenario_id': 'nope'}).status_code == 422


def test_empty_run_state_is_labeled_fixture_preview(client):
    run = create_run(client, 'radlab_stale')
    expected = example('radlab-stale.json')
    response = client.get(
        f"/api/v1/runs/{run['run_id']}/state",
        params={'as_of': '2022-04-01T23:20:00Z'},
    )
    assert response.status_code == 200
    assert response.headers['x-data-mode'] == 'fixture-preview'
    assert response.headers['x-data-source'] == 'contracts/examples'
    state = response.json()
    assert state['run_id'] == run['run_id']
    assert state['as_of'] == '2022-04-01T23:20:00Z'
    for key in ('sources', 'observations', 'assessments', 'actions', 'incidents'):
        assert state[key] == expected[key]


def test_preview_state_keeps_its_snapshot_clock(client):
    run = create_run(client, 'sleep_vigilance')
    response = client.get(
        f"/api/v1/runs/{run['run_id']}/state",
        params={'as_of': '2026-01-10T09:30:00Z'},
    )
    assert response.status_code == 200
    assert response.json()['as_of'] == '2026-01-10T09:00:00Z'


def test_state_rejects_unknown_run(client):
    response = client.get(
        '/api/v1/runs/missing/state', params={'as_of': '2022-04-01T23:20:00Z'}
    )
    assert response.status_code == 404


def test_state_rejects_bad_or_out_of_range_clock(client):
    run = create_run(client, 'radlab_stale')
    url = f"/api/v1/runs/{run['run_id']}/state"
    assert client.get(url, params={'as_of': '2022-04-01T23:20'}).status_code == 422
    assert client.get(url, params={'as_of': '2022-04-01T23:20:00.500Z'}).status_code == 422
    assert client.get(url, params={'as_of': '2022-04-01T22:59:59Z'}).status_code == 422
    assert client.get(url, params={'as_of': '2022-04-02T01:05:00Z'}).status_code == 422


def test_empty_history_is_an_empty_integrated_list(client):
    run = create_run(client, 'sleep_vigilance')
    response = client.get(
        f"/api/v1/runs/{run['run_id']}/observations",
        params={'as_of': '2026-01-10T09:00:00Z'},
    )
    assert response.status_code == 200
    assert response.json() == {'observations': []}
    assert response.headers['x-data-mode'] == 'integrated'


def test_history_rejects_unknown_run_and_bad_limit(client):
    assert (
        client.get(
            '/api/v1/runs/missing/observations',
            params={'as_of': '2022-04-01T23:20:00Z'},
        ).status_code
        == 404
    )
    run = create_run(client, 'radlab_stale')
    url = f"/api/v1/runs/{run['run_id']}/observations"
    assert client.get(url, params={'as_of': '2022-04-01T23:20:00Z', 'limit': 0}).status_code == 422
    assert client.get(url, params={'as_of': '2022-04-01T23:20:00Z', 'limit': 181}).status_code == 200


def test_submission_rejects_a_radlab_run(client):
    run = create_run(client, 'radlab_stale')
    response = client.post(
        f"/api/v1/runs/{run['run_id']}/observations",
        json={
            'submission_id': 's1',
            'observed_at': '2022-04-01T23:20:00Z',
            'entries': [SLEEP],
        },
    )
    assert response.status_code == 422


def test_submission_accepts_a_valid_behavioral_batch(client):
    run = create_run(client, 'sleep_vigilance')
    response = client.post(
        f"/api/v1/runs/{run['run_id']}/observations",
        json={
            'submission_id': 's1',
            'observed_at': '2026-01-10T09:05:00Z',
            'entries': [SLEEP, FATIGUE],
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body['submission_id'] == 's1'
    assert body['observation_ids'] == ['s1:0', 's1:1']
    assert response.headers['x-data-mode'] == 'integrated'


def test_submission_rejects_invalid_entries(client):
    run = create_run(client, 'sleep_vigilance')
    url = f"/api/v1/runs/{run['run_id']}/observations"
    base = {'submission_id': 's1', 'observed_at': '2026-01-10T09:05:00Z'}

    assert client.post(url, json={**base, 'entries': []}).status_code == 422
    assert (
        client.post(
            url, json={**base, 'observed_at': '2026-01-10T10:00:01Z', 'entries': [SLEEP]}
        ).status_code
        == 422
    )
    assert client.post(url, json={**base, 'entries': [{**SLEEP, 'unit': 'hours'}]}).status_code == 422
    assert client.post(url, json={**base, 'entries': [{**SLEEP, 'value': 1441}]}).status_code == 422
    assert client.post(url, json={**base, 'entries': [{**FATIGUE, 'value': 10.5}]}).status_code == 422
    assert client.post(url, json={**base, 'entries': [{**REACTION, 'value': 0}]}).status_code == 422
    assert (
        client.post(url, json={**base, 'entries': [{**SLEEP, 'source_id': 'reaction_task'}]}).status_code
        == 422
    )


def test_submission_id_shape_is_validated(client):
    run = create_run(client, 'sleep_vigilance')
    url = f"/api/v1/runs/{run['run_id']}/observations"
    base = {'observed_at': '2026-01-10T09:05:00Z', 'entries': [SLEEP]}

    assert client.post(url, json={**base, 'submission_id': ''}).status_code == 422
    assert client.post(url, json={**base, 'submission_id': 'x' * 129}).status_code == 422
    assert client.post(url, json={**base, 'submission_id': 'has space'}).status_code == 422
    assert client.post(url, json={**base, 'submission_id': '-leading'}).status_code == 422
    assert (
        client.post(
            url, json={**base, 'submission_id': 'checkin-2026-01-10T09:05:00Z_01'}
        ).status_code
        == 201
    )
