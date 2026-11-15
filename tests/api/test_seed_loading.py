"""Seed loading, validation and run-creation truthfulness (HZ-R2).

The canonical fixture is loaded from disk and mutated only to build labeled variants.
A malformed PRESENT fixture must fail the create-run request before any run row exists;
a missing file may select the explicit preview. The per-test variants are the test-only
injection seam for missing-night and missing-baseline scenarios.
"""

import json
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.api.main import create_app
from backend.replay import CrewFixtureError, load_crew_fixture
from backend.storage import DuplicateSeedError, Storage

ROOT = Path(__file__).resolve().parents[2]
CANONICAL_FIXTURE = ROOT / 'fixtures' / 'crew' / 'sleep-vigilance.json'


def canonical_data() -> dict:
    assert CANONICAL_FIXTURE.is_file(), f'canonical crew fixture missing at {CANONICAL_FIXTURE}'
    return json.loads(CANONICAL_FIXTURE.read_text(encoding='utf-8'))


def write_variant(tmp_path: Path, mutate) -> Path:
    data = canonical_data()
    mutate(data)
    path = tmp_path / 'crew-variant.json'
    path.write_text(json.dumps(data), encoding='utf-8')
    return path


def absent(path: Path) -> Path:
    """An explicit missing seed path: the documented preview selection."""
    return path / 'absent-input'


def test_canonical_fixture_loads_fourteen_validated_rows():
    rows = load_crew_fixture(CANONICAL_FIXTURE)
    assert rows is not None
    assert len(rows) == 14
    assert [row['id'] for row in rows] == [
        'base-sleep-1', 'base-sleep-2', 'base-sleep-3', 'base-sleep-4', 'base-sleep-5',
        'sleep-08', 'sleep-09', 'sleep-10',
        'base-reaction-1', 'base-reaction-2', 'base-reaction-3', 'base-reaction-4',
        'base-reaction-5', 'reaction-10',
    ]
    assert {row['provenance'] for row in rows} == {'SYNTHETIC'}
    assert {row['subject_id'] for row in rows} == {'crew-demo-1'}
    reaction = next(row for row in rows if row['id'] == 'reaction-10')
    assert reaction['value'] == 310
    assert reaction['metadata'] == {
        'task_version': 'demo-rt-v1',
        'input_profile': 'seeded-demo',
        'trial_count': 5,
        'false_starts': 0,
        'completed': True,
    }


def test_missing_fixture_selects_the_explicit_preview(tmp_path):
    app = create_app(
        tmp_path / 'preview.db',
        crew_fixture_path=absent(tmp_path),
        radlab_csv_path=absent(tmp_path),
    )
    with TestClient(app) as client:
        created = client.post('/api/v1/runs', json={'scenario_id': 'sleep_vigilance'})
        assert created.status_code == 201
        # Truthful at creation: no seed was loaded, so no integrated claim.
        assert created.headers['x-data-mode'] == 'fixture-preview'
        run_id = created.json()['run_id']

        state = client.get(f'/api/v1/runs/{run_id}/state', params={'as_of': '2026-01-10T09:30:00Z'})
        assert state.headers['x-data-mode'] == 'fixture-preview'
        assert state.headers['x-data-source'] == 'contracts/examples'
        assert state.json()['as_of'] == '2026-01-10T09:00:00Z'
        history = client.get(
            f'/api/v1/runs/{run_id}/observations', params={'as_of': '2026-01-10T09:30:00Z'}
        )
        assert history.json() == {'observations': []}

        radlab = client.post('/api/v1/runs', json={'scenario_id': 'radlab_stale'})
        assert radlab.status_code == 201
        assert radlab.headers['x-data-mode'] == 'fixture-preview'


def _set_version(data):
    data['schema_version'] = 2


def _set_scenario(data):
    data['scenario_id'] = 'radlab_stale'


def _drop_fixture_id(data):
    del data['fixture_id']


def _set_envelope_subject(data):
    data['subject_id'] = 'crew-demo-2'


def _set_row_subject(data):
    data['observations'][0]['subject_id'] = 'crew-demo-2'


def _set_provenance(data):
    data['observations'][0]['provenance'] = 'REAL_HISTORICAL'


def _set_unit(data):
    data['observations'][0]['unit'] = 'hours'


def _set_pair(data):
    data['observations'][0]['metric'] = 'reaction_time'


def _set_impossible_time(data):
    data['observations'][0]['observed_at'] = '2026-02-30T07:00:00Z'


def _set_nonfinite_value(data):
    data['observations'][0]['value'] = float('nan')


def _set_out_of_range_sleep(data):
    data['observations'][0]['value'] = 1441


def _drop_reaction_metadata_field(data):
    del data['observations'][8]['metadata']['trial_count']


def _break_reaction_metadata_type(data):
    data['observations'][8]['metadata']['completed'] = 'yes'


def _duplicate_id(data):
    data['observations'][1]['id'] = data['observations'][0]['id']


def _empty_observations(data):
    data['observations'] = []


MALFORMED_FIXTURES = [
    ('schema-version', _set_version, 'schema_version must be 1'),
    ('scenario-id', _set_scenario, "scenario_id must be 'sleep_vigilance'"),
    ('fixture-id', _drop_fixture_id, "fixture_id"),
    ('envelope-subject', _set_envelope_subject, "subject_id must be 'crew-demo-1'"),
    ('row-subject', _set_row_subject, "subject_id must be 'crew-demo-1'"),
    ('provenance', _set_provenance, "provenance must be 'SYNTHETIC'"),
    ('unit', _set_unit, 'unsupported source/metric/unit'),
    ('pair', _set_pair, 'unsupported source/metric/unit'),
    ('timestamp', _set_impossible_time, 'not a real UTC time'),
    ('nonfinite', _set_nonfinite_value, 'must be a finite number'),
    ('sleep-range', _set_out_of_range_sleep, 'above 1440'),
    ('reaction-metadata-missing', _drop_reaction_metadata_field, "'trial_count'"),
    ('reaction-metadata-type', _break_reaction_metadata_type, "'completed' must be bool"),
    ('duplicate-id', _duplicate_id, 'Duplicate observation id'),
    ('empty', _empty_observations, 'at least one row'),
]


@pytest.mark.parametrize(
    ('label', 'mutate', 'expected'), MALFORMED_FIXTURES, ids=[case[0] for case in MALFORMED_FIXTURES]
)
def test_malformed_present_fixture_fails_clearly_without_creating_a_run(
    tmp_path, label, mutate, expected
):
    path = write_variant(tmp_path, mutate)
    db_path = tmp_path / f'{label}.db'
    app = create_app(
        db_path, crew_fixture_path=path, radlab_csv_path=absent(tmp_path)
    )
    with TestClient(app) as client:
        response = client.post('/api/v1/runs', json={'scenario_id': 'sleep_vigilance'})
        assert response.status_code == 500, response.text
        assert 'Crew fixture is invalid' in response.json()['detail']
        assert expected in response.json()['detail']
    # No orphan or half-seeded run survives a rejected seed.
    assert Storage(db_path).count_runs() == 0


def test_loader_reports_the_missing_field_for_a_present_bad_file(tmp_path):
    path = write_variant(tmp_path, _set_unit)
    with pytest.raises(CrewFixtureError, match='unsupported source/metric/unit'):
        load_crew_fixture(path)


@pytest.mark.parametrize('timestamp', [
    '2026-01-10T09:01:0١Z',
    '2026-01-10T09:0١:00Z',
])
def test_unicode_seed_timestamp_is_rejected_before_a_run_exists(tmp_path, timestamp):
    path = write_variant(
        tmp_path,
        lambda data: data['observations'][-1].update(observed_at=timestamp),
    )
    db_path = tmp_path / 'unicode-seed.db'
    with TestClient(create_app(db_path, crew_fixture_path=path)) as client:
        response = client.post('/api/v1/runs', json={'scenario_id': 'sleep_vigilance'})
        assert response.status_code == 500, response.text
        assert 'whole-second UTC timestamp' in response.json()['detail']
    assert Storage(db_path).count_runs() == 0


@pytest.mark.parametrize('value', [10**19, 1e19, 2**63, 1e308])
def test_large_finite_reaction_seed_can_be_stored_and_evaluated(tmp_path, value):
    path = write_variant(
        tmp_path,
        lambda data: data['observations'][-1].update(value=value),
    )
    with TestClient(create_app(tmp_path / 'large-seed.db', crew_fixture_path=path)) as client:
        created = client.post('/api/v1/runs', json={'scenario_id': 'sleep_vigilance'})
        assert created.status_code == 201, created.text
        run_id = created.json()['run_id']
        state = client.get(
            f'/api/v1/runs/{run_id}/state', params={'as_of': '2026-01-10T09:01:00Z'}
        )
        assert state.status_code == 200, state.text
        reaction = next(row for row in state.json()['observations'] if row['id'] == 'reaction-10')
        assert float(reaction['value']) == float(value)
        assert state.json()['assessments'][0]['state'] == 'watch'


def test_seed_integer_outside_finite_storage_range_is_rejected_clearly(tmp_path):
    path = write_variant(
        tmp_path,
        lambda data: data['observations'][-1].update(value=10**400),
    )
    with pytest.raises(CrewFixtureError, match='finite number'):
        load_crew_fixture(path)
    db_path = tmp_path / 'unrepresentable-seed.db'
    with TestClient(create_app(db_path, crew_fixture_path=path)) as client:
        response = client.post('/api/v1/runs', json={'scenario_id': 'sleep_vigilance'})
        assert response.status_code == 500
        assert 'finite number' in response.json()['detail']
    assert Storage(db_path).count_runs() == 0


@pytest.mark.parametrize('metadata', [
    {'note': '\ud800'},
    {'nested': [{'note': '\udfff'}]},
    {'\ud800': 'value'},
])
def test_unpaired_surrogate_metadata_is_rejected_before_seed_persistence(tmp_path, metadata):
    path = write_variant(
        tmp_path,
        lambda data: data['observations'][0].update(metadata=metadata),
    )
    with pytest.raises(CrewFixtureError, match='valid Unicode text'):
        load_crew_fixture(path)
    db_path = tmp_path / 'surrogate-seed.db'
    with TestClient(create_app(db_path, crew_fixture_path=path)) as client:
        response = client.post('/api/v1/runs', json={'scenario_id': 'sleep_vigilance'})
        assert response.status_code == 500
        assert 'valid Unicode text' in response.json()['detail']
    assert Storage(db_path).count_runs() == 0


def test_valid_unicode_metadata_survives_seed_storage_and_api_response(tmp_path):
    metadata = {'équipage': ['مرحبا', '🛰️']}
    path = write_variant(
        tmp_path,
        lambda data: data['observations'][-1].setdefault('metadata', {}).update(metadata),
    )
    with TestClient(create_app(tmp_path / 'unicode-metadata.db', crew_fixture_path=path)) as client:
        run_id = client.post('/api/v1/runs', json={'scenario_id': 'sleep_vigilance'}).json()['run_id']
        response = client.get(
            f'/api/v1/runs/{run_id}/state', params={'as_of': '2026-01-10T09:01:00Z'}
        )
        assert response.status_code == 200
        row = next(row for row in response.json()['observations'] if row['id'] == 'reaction-10')
        assert row['metadata']['équipage'] == metadata['équipage']


@pytest.mark.parametrize('field', ['id', 'source_timestamp', 'source_id', 'metric', 'unit'])
def test_unpaired_surrogate_observation_text_is_rejected_before_seed_persistence(tmp_path, field):
    path = write_variant(
        tmp_path,
        lambda data: data['observations'][0].update({field: '\ud800'}),
    )
    db_path = tmp_path / 'surrogate-observation.db'
    with TestClient(create_app(db_path, crew_fixture_path=path)) as client:
        response = client.post('/api/v1/runs', json={'scenario_id': 'sleep_vigilance'})
        assert response.status_code == 500
        assert 'valid Unicode text' in response.json()['detail']
    assert Storage(db_path).count_runs() == 0


@pytest.mark.parametrize('literal', ['NaN', 'Infinity', '-Infinity', '1e999'])
@pytest.mark.parametrize('observation_id', ['sleep-08', 'reaction-10'])
def test_nonfinite_nested_metadata_is_rejected_before_persistence(
    tmp_path, literal, observation_id
):
    data = canonical_data()
    row = next(row for row in data['observations'] if row['id'] == observation_id)
    row.setdefault('metadata', {})['extra'] = [{'value': 'NONFINITE_NUMBER'}]
    path = tmp_path / 'nonfinite-metadata.json'
    path.write_text(
        json.dumps(data).replace('"NONFINITE_NUMBER"', literal), encoding='utf-8'
    )
    with pytest.raises(CrewFixtureError) as error:
        load_crew_fixture(path)
    assert str(path) in str(error.value)
    assert f'Observation {observation_id} metadata.extra[0].value must be a finite number' in str(error.value)

    db_path = tmp_path / 'nonfinite.db'
    with TestClient(create_app(db_path, crew_fixture_path=path)) as client:
        response = client.post('/api/v1/runs', json={'scenario_id': 'sleep_vigilance'})
        assert response.status_code == 500
        assert 'metadata.extra[0].value must be a finite number' in response.json()['detail']
    assert Storage(db_path).count_runs() == 0
    with sqlite3.connect(db_path) as connection:
        assert connection.execute('SELECT COUNT(*) FROM observations').fetchone()[0] == 0


def test_missing_night_variant_reaches_the_evaluator(tmp_path):
    """Test-only seam: a valid D2 file may carry fewer rows than the canonical fixture."""
    path = write_variant(
        tmp_path,
        lambda data: data.update(
            observations=[row for row in data['observations'] if row['id'] != 'sleep-09']
        ),
    )
    app = create_app(
        tmp_path / 'missing-night.db',
        crew_fixture_path=path,
        radlab_csv_path=absent(tmp_path),
    )
    with TestClient(app) as client:
        created = client.post('/api/v1/runs', json={'scenario_id': 'sleep_vigilance'})
        assert created.headers['x-data-mode'] == 'integrated'
        run_id = created.json()['run_id']
        history = client.get(
            f'/api/v1/runs/{run_id}/observations', params={'as_of': '2026-01-10T09:01:00Z'}
        ).json()['observations']
        assert len(history) == 13
        assert 'sleep-09' not in {row['id'] for row in history}

        state = client.get(
            f'/api/v1/runs/{run_id}/state', params={'as_of': '2026-01-10T09:01:00Z'}
        ).json()
        [assessment] = state['assessments']
        assert assessment['state'] == 'insufficient_data'
        assert assessment['title'] == 'Comparison incomplete'
        assert assessment['missing_inputs'] == ['sleep_duration']


def test_missing_reaction_baseline_variant_reaches_the_evaluator(tmp_path):
    path = write_variant(
        tmp_path,
        lambda data: data.update(
            observations=[
                row for row in data['observations'] if row['id'] != 'base-reaction-1'
            ]
        ),
    )
    app = create_app(
        tmp_path / 'missing-baseline.db',
        crew_fixture_path=path,
        radlab_csv_path=absent(tmp_path),
    )
    with TestClient(app) as client:
        run_id = client.post('/api/v1/runs', json={'scenario_id': 'sleep_vigilance'}).json()['run_id']
        state = client.get(
            f'/api/v1/runs/{run_id}/state', params={'as_of': '2026-01-10T09:01:00Z'}
        ).json()
        [assessment] = state['assessments']
        assert assessment['state'] == 'insufficient_data'
        assert assessment['missing_inputs'] == ['reaction_baseline']


def test_present_but_unverified_archive_fails_instead_of_previewing(tmp_path):
    bad_csv = tmp_path / 'radlab-bad.csv'
    bad_csv.write_text(
        'instrument_id,timestamp,absorbed_dose_rate\n'
        'DosTel1,2022-04-01 23:12:25,1.5\n',
        encoding='utf-8',
    )
    db_path = tmp_path / 'bad-archive.db'
    app = create_app(
        db_path,
        crew_fixture_path=absent(tmp_path),
        radlab_csv_path=bad_csv,
    )
    with TestClient(app) as client:
        response = client.post('/api/v1/runs', json={'scenario_id': 'radlab_stale'})
        assert response.status_code == 500, response.text
        assert 'failed verification' in response.json()['detail']
    assert Storage(db_path).count_runs() == 0


def test_duplicate_seed_rows_are_rejected_and_leave_no_run(tmp_path):
    store = Storage(tmp_path / 'duplicate.db')
    store.initialize()
    rows = load_crew_fixture(CANONICAL_FIXTURE)
    assert rows is not None
    run = {
        'run_id': 'duplicate-seed-run',
        'scenario_id': 'sleep_vigilance',
        'initial_as_of': '2026-01-10T09:00:00Z',
        'range_start': '2026-01-10T09:00:00Z',
        'range_end': '2026-01-10T10:00:00Z',
    }
    with pytest.raises(DuplicateSeedError):
        store.create_run(run, [rows[0], rows[0]])
    # The run and its partial batch were rolled back together.
    assert store.count_runs() == 0
    assert store.count_observations(run['run_id']) == 0

    store.create_run(run, rows)
    assert store.count_observations(run['run_id']) == 14
    with pytest.raises(DuplicateSeedError):
        store.seed_observations(run['run_id'], rows[:1])
    # A rejected duplicate seed batch leaves the existing history untouched.
    assert store.count_observations(run['run_id']) == 14
