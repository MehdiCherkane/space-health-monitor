from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient

from backend.api.main import create_app

SLEEP = {'metric': 'sleep_duration', 'value': 400, 'unit': 'min', 'source_id': 'crew_sleep_log'}
FATIGUE = {'metric': 'fatigue', 'value': 3, 'unit': 'score_0_10', 'source_id': 'crew_self_report'}


def create_run(client, scenario_id='sleep_vigilance') -> str:
    response = client.post('/api/v1/runs', json={'scenario_id': scenario_id})
    assert response.status_code == 201, response.text
    return response.json()['run_id']


def submit(client, run_id, submission_id, observed_at, entries):
    return client.post(
        f'/api/v1/runs/{run_id}/observations',
        json={
            'submission_id': submission_id,
            'observed_at': observed_at,
            'entries': entries,
        },
    )


def history(client, run_id, **params):
    response = client.get(f'/api/v1/runs/{run_id}/observations', params=params)
    assert response.status_code == 200, response.text
    return response.json()['observations']


def test_runs_are_isolated(client):
    first = create_run(client)
    second = create_run(client)

    assert submit(
        client, first, 'batch-a', '2026-01-10T09:05:00Z', [SLEEP]
    ).status_code == 201

    assert len(history(client, first, as_of='2026-01-10T09:10:00Z')) == 1
    assert history(client, second, as_of='2026-01-10T09:10:00Z') == []

    preview = client.get(
        f'/api/v1/runs/{second}/state', params={'as_of': '2026-01-10T09:10:00Z'}
    )
    assert preview.headers['x-data-mode'] == 'fixture-preview'

    integrated = client.get(
        f'/api/v1/runs/{first}/state', params={'as_of': '2026-01-10T09:10:00Z'}
    )
    assert integrated.headers['x-data-mode'] == 'integrated'


def test_identical_retry_returns_the_original_ids_and_one_batch(client):
    run_id = create_run(client)
    first = submit(client, run_id, 'retry-1', '2026-01-10T09:05:00Z', [SLEEP, FATIGUE])
    second = submit(client, run_id, 'retry-1', '2026-01-10T09:05:00Z', [SLEEP, FATIGUE])

    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json()['observation_ids'] == second.json()['observation_ids']
    assert len(history(client, run_id, as_of='2026-01-10T10:00:00Z')) == 2


def test_changed_payload_with_the_same_submission_id_conflicts(client):
    run_id = create_run(client)
    assert submit(client, run_id, 'retry-1', '2026-01-10T09:05:00Z', [SLEEP]).status_code == 201

    conflict = submit(
        client,
        run_id,
        'retry-1',
        '2026-01-10T09:05:00Z',
        [{**SLEEP, 'value': 410}],
    )
    assert conflict.status_code == 409
    assert conflict.json()['detail']
    assert len(history(client, run_id, as_of='2026-01-10T10:00:00Z')) == 1

    later_clock = submit(client, run_id, 'retry-1', '2026-01-10T09:06:00Z', [SLEEP])
    assert later_clock.status_code == 409


def test_the_same_submission_id_is_allowed_in_another_run(client):
    first = create_run(client)
    second = create_run(client)

    assert submit(client, first, 'shared-id', '2026-01-10T09:05:00Z', [SLEEP]).status_code == 201
    assert submit(client, second, 'shared-id', '2026-01-10T09:05:00Z', [SLEEP]).status_code == 201


def test_concurrent_identical_retries_store_one_batch(tmp_path):
    app = create_app(
        tmp_path / 'concurrent.db',
        crew_fixture_path=tmp_path / 'absent-crew.json',
        radlab_csv_path=tmp_path / 'absent-radlab.csv',
    )
    with TestClient(app) as client:
        run_id = create_run(client)

    payload = {
        'submission_id': 'concurrent-1',
        'observed_at': '2026-01-10T09:05:00Z',
        'entries': [SLEEP, FATIGUE],
    }

    def post(_):
        with TestClient(app) as thread_client:
            return thread_client.post(f'/api/v1/runs/{run_id}/observations', json=payload)

    with ThreadPoolExecutor(max_workers=8) as pool:
        responses = list(pool.map(post, range(8)))

    assert sorted(response.status_code for response in responses) == [200] * 7 + [201]
    assert len({tuple(response.json()['observation_ids']) for response in responses}) == 1

    with TestClient(app) as client:
        rows = client.get(
            f'/api/v1/runs/{run_id}/observations',
            params={'as_of': '2026-01-10T10:00:00Z'},
        ).json()['observations']
    assert len(rows) == 2


def test_state_uses_the_engine_and_excludes_future_observations(client):
    run_id = create_run(client)
    assert submit(
        client, run_id, 'later', '2026-01-10T09:10:00Z', [SLEEP]
    ).status_code == 201

    before = client.get(
        f'/api/v1/runs/{run_id}/state', params={'as_of': '2026-01-10T09:05:00Z'}
    )
    assert before.status_code == 200
    assert before.headers['x-data-mode'] == 'integrated'
    early_state = before.json()
    assert early_state['observations'] == []
    assert {source['state'] for source in early_state['sources']} == {'missing'}

    at_time = client.get(
        f'/api/v1/runs/{run_id}/state', params={'as_of': '2026-01-10T09:10:00Z'}
    )
    state = at_time.json()
    assert [row['id'] for row in state['observations']] == ['later:0']
    sleep_source = next(
        source for source in state['sources'] if source['source_id'] == 'crew_sleep_log'
    )
    assert sleep_source['last_observation_id'] == 'later:0'
    assert sleep_source['age_seconds'] == 0
    assert state['assessments'][0]['state'] == 'insufficient_data'
    assert state['assessments'][0]['missing_inputs']


def test_state_includes_each_referenced_observation_once(client):
    run_id = create_run(client)
    assert submit(
        client, run_id, 'one', '2026-01-10T09:05:00Z', [SLEEP]
    ).status_code == 201
    state = client.get(
        f'/api/v1/runs/{run_id}/state', params={'as_of': '2026-01-10T09:05:00Z'}
    ).json()
    ids = [row['id'] for row in state['observations']]
    assert ids == ['one:0']


def test_state_is_read_only(client):
    run_id = create_run(client)
    assert submit(client, run_id, 's1', '2026-01-10T09:05:00Z', [SLEEP]).status_code == 201
    before = history(client, run_id, as_of='2026-01-10T10:00:00Z')

    client.get(f'/api/v1/runs/{run_id}/state', params={'as_of': '2026-01-10T09:30:00Z'})
    client.get(f'/api/v1/runs/{run_id}/state', params={'as_of': '2026-01-10T09:30:00Z'})

    assert history(client, run_id, as_of='2026-01-10T10:00:00Z') == before


def test_history_returns_the_newest_limit_in_chronological_order(client):
    run_id = create_run(client)
    for index, value in enumerate((400, 410, 420)):
        response = submit(
            client,
            run_id,
            f'night-{index}',
            f'2026-01-10T09:0{index + 1}:00Z',
            [{**SLEEP, 'value': value}],
        )
        assert response.status_code == 201

    rows = history(client, run_id, as_of='2026-01-10T10:00:00Z', limit=2)
    assert [row['value'] for row in rows] == [410, 420]
    assert [row['observed_at'] for row in rows] == [
        '2026-01-10T09:02:00Z',
        '2026-01-10T09:03:00Z',
    ]


def test_history_filters_by_source_and_metric(client):
    run_id = create_run(client)
    assert submit(
        client, run_id, 'mixed', '2026-01-10T09:05:00Z', [SLEEP, FATIGUE]
    ).status_code == 201

    sleep_rows = history(
        client, run_id, as_of='2026-01-10T10:00:00Z', source_id='crew_sleep_log'
    )
    fatigue_rows = history(
        client, run_id, as_of='2026-01-10T10:00:00Z', metric='fatigue'
    )
    assert [row['metric'] for row in sleep_rows] == ['sleep_duration']
    assert [row['source_id'] for row in fatigue_rows] == ['crew_self_report']
