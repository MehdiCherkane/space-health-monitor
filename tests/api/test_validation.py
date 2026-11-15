"""Regression tests: impossible timestamps, nonfinite metadata, resource override, preview snapshot."""

import json

import pytest
from fastapi.testclient import TestClient

from backend.api.main import create_app

SLEEP = {'metric': 'sleep_duration', 'value': 400, 'unit': 'min', 'source_id': 'crew_sleep_log'}


def create_run(client, scenario_id='sleep_vigilance') -> str:
    response = client.post('/api/v1/runs', json={'scenario_id': scenario_id})
    assert response.status_code == 201, response.text
    return response.json()['run_id']


def raw_post(client, run_id, body: str):
    """Send raw JSON so NaN/Infinity tokens reach the server exactly as a client could send them."""
    return client.post(
        f'/api/v1/runs/{run_id}/observations',
        content=body,
        headers={'Content-Type': 'application/json'},
    )


def stored(client, run_id):
    response = client.get(
        f'/api/v1/runs/{run_id}/observations', params={'as_of': '2026-01-10T10:00:00Z'}
    )
    assert response.status_code == 200, response.text
    return response.json()['observations']


@pytest.mark.parametrize(
    'observed_at',
    ['2026-01-10T09:99:00Z', '2026-01-10T24:00:00Z', '2026-02-30T09:00:00Z', '2026-01-10T09:00:60Z'],
)
def test_impossible_submission_timestamp_is_rejected_and_not_persisted(client, observed_at):
    run_id = create_run(client)
    response = client.post(
        f'/api/v1/runs/{run_id}/observations',
        json={'submission_id': 'bad-time', 'observed_at': observed_at, 'entries': [SLEEP]},
    )
    assert response.status_code == 422
    assert 'valid whole-second UTC' in response.json()['detail']
    assert stored(client, run_id) == []
    # The run stays usable: state evaluation does not 500.
    state = client.get(f'/api/v1/runs/{run_id}/state', params={'as_of': '2026-01-10T09:00:00Z'})
    assert state.status_code == 200


def test_impossible_as_of_is_rejected(client):
    run_id = create_run(client)
    for as_of in ('2026-01-10T09:99:00Z', '2026-01-10T09:00:00+00:00'):
        response = client.get(f'/api/v1/runs/{run_id}/state', params={'as_of': as_of})
        assert response.status_code == 422, as_of


@pytest.mark.parametrize('clock', ['2026-01-10T09:00:0١Z', '2026-01-10T09:0١:00Z'])
def test_noncanonical_unicode_clock_cannot_poison_a_run(client, clock):
    run_id = create_run(client)
    response = client.post(
        f'/api/v1/runs/{run_id}/observations',
        json={'submission_id': 'unicode-time', 'observed_at': clock, 'entries': [SLEEP]},
    )
    assert response.status_code == 422
    assert stored(client, run_id) == []
    for endpoint in ('state', 'observations'):
        response = client.get(f'/api/v1/runs/{run_id}/{endpoint}', params={'as_of': clock})
        assert response.status_code == 422
    assert client.get(
        f'/api/v1/runs/{run_id}/state', params={'as_of': '2026-01-10T10:00:00Z'}
    ).status_code == 200


@pytest.mark.parametrize('value', [1e19, 1.7976931348623157e308])
def test_finite_reaction_values_survive_sqlite_storage_and_retry(client, value):
    run_id = create_run(client)
    payload = {
        'submission_id': 'large-reaction',
        'observed_at': '2026-01-10T09:00:00Z',
        'entries': [{'source_id': 'reaction_task', 'metric': 'reaction_time', 'unit': 'ms',
                     'value': value}],
    }
    first = client.post(f'/api/v1/runs/{run_id}/observations', json=payload)
    assert first.status_code == 201
    retry = client.post(f'/api/v1/runs/{run_id}/observations', json=payload)
    assert retry.status_code == 200
    assert retry.json() == first.json()
    [row] = stored(client, run_id)
    assert row['value'] == value
    assert client.get(
        f'/api/v1/runs/{run_id}/state', params={'as_of': payload['observed_at']}
    ).status_code == 200


@pytest.mark.parametrize('metadata', [float('nan'), float('inf'), [float('nan')]])
def test_invalid_nonfinite_metadata_shape_returns_json_422(client, metadata):
    run_id = create_run(client)
    response = raw_post(client, run_id, json.dumps({
        'submission_id': 'bad-shape', 'observed_at': '2026-01-10T09:00:00Z',
        'entries': [SLEEP, {**SLEEP, 'metadata': metadata}],
    }))
    assert response.status_code == 422
    assert response.json()['detail']
    # Validation errors must themselves be valid JSON and must never partially write a batch.
    json.loads(response.text, parse_constant=lambda token: pytest.fail(f'invalid JSON: {token}'))
    assert stored(client, run_id) == []


def test_history_limit_rejects_values_outside_sqlite_integer_range(client):
    run_id = create_run(client)
    endpoint = f'/api/v1/runs/{run_id}/observations'
    for limit in (2**63, 10**30):
        response = client.get(endpoint, params={'as_of': '2026-01-10T09:00:00Z', 'limit': limit})
        assert response.status_code == 422
    assert client.get(endpoint, params={
        'as_of': '2026-01-10T09:00:00Z', 'limit': 181,
    }).status_code == 200


@pytest.mark.parametrize('entry', [
    {**SLEEP, 'value': True},
    {'source_id': 'crew_self_report', 'metric': 'fatigue', 'unit': 'score_0_10', 'value': False},
    {'source_id': 'reaction_task', 'metric': 'reaction_time', 'unit': 'ms', 'value': True},
])
def test_boolean_measurements_are_rejected_before_numeric_coercion(client, entry):
    run_id = create_run(client)
    response = client.post(f'/api/v1/runs/{run_id}/observations', json={
        'submission_id': 'boolean-value', 'observed_at': '2026-01-10T09:00:00Z',
        'entries': [SLEEP, entry],
    })
    assert response.status_code == 422
    assert stored(client, run_id) == []


@pytest.mark.parametrize('change', [
    {'metadata': {'note': '\ud800'}},
    {'metadata': {'\udfff': 'invalid key'}},
    {'source_id': '\ud800'},
    {'value': '\udfff'},
])
def test_unpaired_surrogates_cannot_poison_storage_or_error_responses(client, change):
    run_id = create_run(client)
    response = raw_post(client, run_id, json.dumps({
        'submission_id': 'bad-unicode', 'observed_at': '2026-01-10T09:05:00Z',
        'entries': [SLEEP, {**SLEEP, **change}],
    }))
    assert response.status_code == 422
    assert response.json()['detail']
    assert stored(client, run_id) == []
    assert client.get(
        f'/api/v1/runs/{run_id}/state', params={'as_of': '2026-01-10T10:00:00Z'}
    ).status_code == 200


@pytest.mark.parametrize('token', ['NaN', 'Infinity', '-Infinity'])
def test_nonfinite_metadata_is_rejected_and_batch_not_written(client, token):
    run_id = create_run(client)
    body = (
        '{"submission_id":"meta-%s","observed_at":"2026-01-10T09:00:00Z","entries":['
        '{"metric":"sleep_duration","value":400,"unit":"min","source_id":"crew_sleep_log"},'
        '{"metric":"fatigue","value":3,"unit":"score_0_10","source_id":"crew_self_report",'
        '"metadata":{"nested":{"values":[1, %s]}}}]}'
    ) % (token.strip('-'), token)
    response = raw_post(client, run_id, body)
    assert response.status_code == 422
    assert 'metadata.nested.values[1] must be a finite number' in response.json()['detail']
    # Neither entry of the failed batch was written.
    assert stored(client, run_id) == []
    state = client.get(f'/api/v1/runs/{run_id}/state', params={'as_of': '2026-01-10T09:00:00Z'})
    assert state.status_code == 200


def test_top_level_nonfinite_metadata_value_is_rejected(client):
    run_id = create_run(client)
    body = (
        '{"submission_id":"meta-top","observed_at":"2026-01-10T09:00:00Z","entries":['
        '{"metric":"sleep_duration","value":400,"unit":"min","source_id":"crew_sleep_log",'
        '"metadata":{"audit_number":NaN}}]}'
    )
    response = raw_post(client, run_id, body)
    assert response.status_code == 422
    assert stored(client, run_id) == []


def test_valid_metadata_is_kept_intact(client):
    run_id = create_run(client)
    metadata = {'note': 'ok', 'nested': {'n': [1, 2.5, None, True]}}
    response = client.post(
        f'/api/v1/runs/{run_id}/observations',
        json={
            'submission_id': 'meta-ok',
            'observed_at': '2026-01-10T09:00:00Z',
            'entries': [{**SLEEP, 'metadata': metadata}],
        },
    )
    assert response.status_code == 201, response.text
    [row] = stored(client, run_id)
    assert row['metadata'] == metadata


def test_disabled_reaction_resource_keeps_the_action_visible_with_a_fallback(tmp_path):
    app = create_app(
        tmp_path / 'b04.db',
        resources={'local_reaction_task': False},
        crew_fixture_path=tmp_path / 'absent-crew.json',
        radlab_csv_path=tmp_path / 'absent-radlab.csv',
    )
    with TestClient(app) as client:
        run_id = create_run(client)
        response = client.post(
            f'/api/v1/runs/{run_id}/observations',
            json={'submission_id': 's1', 'observed_at': '2026-01-10T09:00:00Z', 'entries': [SLEEP]},
        )
        assert response.status_code == 201, response.text
        state = client.get(
            f'/api/v1/runs/{run_id}/state', params={'as_of': '2026-01-10T09:00:00Z'}
        )
        assert state.headers['x-data-mode'] == 'integrated'
        body = state.json()
        actions = {action['id']: action for action in body['actions']}
        assert actions['start_reaction_check']['available'] is False
        assert actions['start_reaction_check']['unavailable_reason'] == 'Reaction check unavailable'
        assert actions['review_available_inputs']['available'] is True
        [assessment] = body['assessments']
        assert assessment['state'] == 'insufficient_data'


def test_resource_override_rejects_unknown_resources(tmp_path):
    with pytest.raises(ValueError):
        create_app(tmp_path / 'bad.db', resources={'made_up': False})
    with pytest.raises(ValueError):
        create_app(tmp_path / 'bad.db', resources={'local_reaction_task': 'no'})


def test_resource_override_from_environment(tmp_path, monkeypatch):
    monkeypatch.setenv('ASTRO_VITAL_RESOURCES', json.dumps({'local_reaction_task': False}))
    app = create_app(
        tmp_path / 'env.db',
        crew_fixture_path=tmp_path / 'absent-crew.json',
        radlab_csv_path=tmp_path / 'absent-radlab.csv',
    )
    with TestClient(app) as client:
        run_id = create_run(client)
        client.post(
            f'/api/v1/runs/{run_id}/observations',
            json={'submission_id': 's1', 'observed_at': '2026-01-10T09:00:00Z', 'entries': [SLEEP]},
        )
        state = client.get(
            f'/api/v1/runs/{run_id}/state', params={'as_of': '2026-01-10T09:00:00Z'}
        ).json()
        actions = {action['id']: action for action in state['actions']}
        assert actions['start_reaction_check']['available'] is False


def test_preview_is_a_fixed_snapshot_at_its_canonical_time(client):
    run_id = create_run(client, 'radlab_stale')
    for as_of in ('2022-04-01T23:00:00Z', '2022-04-01T23:30:00Z'):
        response = client.get(f'/api/v1/runs/{run_id}/state', params={'as_of': as_of})
        assert response.headers['x-data-mode'] == 'fixture-preview'
        # Never relabeled as the requested clock: no future readings at 23:00,
        # no stale snapshot posing as 23:30.
        assert response.json()['as_of'] == '2022-04-01T23:20:00Z'
