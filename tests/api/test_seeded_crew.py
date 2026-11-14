"""Integrated crew scenario against the committed canonical fixture (B01, B02, B04, B05).

These tests load `fixtures/crew/sleep-vigilance.json` from disk — the same file the demo
ships — and evaluate it through the real engine and SQLite persistence. They deliberately
do not build a look-alike fixture in code: a broken canonical file must fail here.

Empty-run and preview behavior lives in the other API tests through the `client` fixture,
which passes explicit absent seed paths.
"""

import pytest
from fastapi.testclient import TestClient

from backend.api.main import create_app

B01_CLOCK = '2026-01-10T09:00:00Z'
B02_CLOCK = '2026-01-10T09:01:00Z'


def create_run(client, scenario_id: str = 'sleep_vigilance'):
    response = client.post('/api/v1/runs', json={'scenario_id': scenario_id})
    assert response.status_code == 201, response.text
    return response


def history(client, run_id: str, as_of: str, **params):
    response = client.get(
        f'/api/v1/runs/{run_id}/observations', params={'as_of': as_of, **params}
    )
    assert response.status_code == 200, response.text
    return response.json()['observations']


def state(client, run_id: str, as_of: str):
    response = client.get(f'/api/v1/runs/{run_id}/state', params={'as_of': as_of})
    assert response.status_code == 200, response.text
    return response


def test_seeded_crew_run_evaluates_integrated_state_at_0900_and_0901(seeded_client):
    created = create_run(seeded_client)
    assert created.headers['x-data-mode'] == 'integrated'
    run_id = created.json()['run_id']

    # B01 — 09:00:00Z: reaction-10 (09:01) is not visible yet, so vigilance is missing.
    b01 = state(seeded_client, run_id, B01_CLOCK)
    assert b01.headers['x-data-mode'] == 'integrated'
    body = b01.json()
    assert body['scenario_id'] == 'sleep_vigilance'
    assert body['as_of'] == B01_CLOCK
    [assessment] = body['assessments']
    assert assessment['state'] == 'insufficient_data'
    assert assessment['title'] == 'Vigilance data missing'
    assert assessment['missing_inputs'] == ['reaction_time']
    assert 'start_reaction_check' in assessment['action_ids']

    visible_ids = {row['id'] for row in body['observations']}
    assert 'reaction-10' not in visible_ids
    assert 'sleep-10' in visible_ids
    b01_history = history(seeded_client, run_id, B01_CLOCK)
    assert len(b01_history) == 13
    assert 'reaction-10' not in {row['id'] for row in b01_history}

    # B02 — 09:01:00Z: the seeded 310 ms sample is visible and triggers watch.
    b02 = state(seeded_client, run_id, B02_CLOCK)
    assert b02.headers['x-data-mode'] == 'integrated'
    body = b02.json()
    assert body['as_of'] == B02_CLOCK
    [assessment] = body['assessments']
    assert assessment['state'] == 'watch'
    assert assessment['title'] == 'Sleep and vigilance change'
    assert len(assessment['supporting_evidence']) == 2
    baseline_ids = {
        evidence.get('baseline_id') for evidence in assessment['supporting_evidence']
    }
    assert baseline_ids == {'crew-demo-sleep-v1', 'crew-demo-reaction-v1'}
    assert 'reaction-10' in {row['id'] for row in body['observations']}

    b02_history = history(seeded_client, run_id, B02_CLOCK)
    assert len(b02_history) == 14
    assert 'reaction-10' in {row['id'] for row in b02_history}
    # Chronological, and the last visible row is the seeded sample.
    assert b02_history[-1]['id'] == 'reaction-10'
    assert b02_history[-1]['value'] == 310


def test_b04_resource_disabled_fallback_action(tmp_path, crew_fixture_path):
    app = create_app(
        db_path=tmp_path / 'b04.db',
        resources={'local_reaction_task': False},
        crew_fixture_path=crew_fixture_path,
        radlab_csv_path=tmp_path / 'absent-radlab.csv',
    )
    with TestClient(app) as client:
        run_id = create_run(client).json()['run_id']
        state_body = state(client, run_id, B01_CLOCK).json()
        action_map = {action['id']: action for action in state_body['actions']}
        assert 'start_reaction_check' in action_map
        assert action_map['start_reaction_check']['available'] is False
        assert (
            action_map['start_reaction_check']['unavailable_reason']
            == 'Reaction check unavailable'
        )
        assert 'review_available_inputs' in action_map
        assert action_map['review_available_inputs']['available'] is True
        assert state_body['assessments'][0]['state'] == 'insufficient_data'


def test_b05_submission_idempotency_conflict_and_isolation(seeded_client):
    run1 = create_run(seeded_client).json()['run_id']
    payload = {
        'submission_id': 'sub-b05-01',
        'observed_at': '2026-01-10T09:05:00Z',
        'entries': [
            {
                'metric': 'sleep_duration',
                'value': 410,
                'unit': 'min',
                'source_id': 'crew_sleep_log',
            }
        ],
    }

    first = seeded_client.post(f'/api/v1/runs/{run1}/observations', json=payload)
    assert first.status_code == 201, first.text
    observation_ids = first.json()['observation_ids']
    assert len(observation_ids) == 1

    retry = seeded_client.post(f'/api/v1/runs/{run1}/observations', json=payload)
    assert retry.status_code == 200
    assert retry.json()['observation_ids'] == observation_ids

    conflict = seeded_client.post(
        f'/api/v1/runs/{run1}/observations',
        json={**payload, 'entries': [{**payload['entries'][0], 'value': 395}]},
    )
    assert conflict.status_code == 409
    assert 'different payload' in conflict.json()['detail']

    run2 = create_run(seeded_client).json()['run_id']
    assert run1 != run2

    run1_history = history(seeded_client, run1, '2026-01-10T09:10:00Z')
    run2_history = history(seeded_client, run2, '2026-01-10T09:10:00Z')
    assert len(run1_history) == 15
    assert len(run2_history) == 14
    assert observation_ids[0] in {row['id'] for row in run1_history}
    assert observation_ids[0] not in {row['id'] for row in run2_history}
    assert {row['id'] for row in run2_history} == {
        row['id'] for row in history(seeded_client, run1, B02_CLOCK)
    }
