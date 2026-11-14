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
