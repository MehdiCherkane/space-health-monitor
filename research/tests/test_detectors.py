"""Fabricated test values only; no historical DosTel data is bundled here."""
import pandas as pd
import pytest
from src.normalize import normalize
from src.detectors import detector_profiles, verify_reference
from src.replay import replay


def fixture():
    times = {'DosTel1':['23:10:00','23:14:00','23:30:00'],
             'DosTel2':['23:14:00','23:18:00','23:22:00','23:26:00','23:30:00']}
    rows = [dict(instrument_id=s,timestamp='2026-01-01T'+t+'Z',spacecraft='test_craft',
                 module='test_module',absorbed_dose_rate=.1) for s, ts in times.items() for t in ts]
    return normalize(pd.DataFrame(rows), dict(id='synthetic_detector_test',observation_kind='detector',
        columns={'instrument_id':'source'},provenance='SYNTHETIC'), {'absorbed_dose_rate':{'unit':'µGy/h'}})


def test_detector_identity_units_metadata_and_reference():
    df = fixture()
    assert df.subject_id.isna().all()
    assert set(df.source)=={'DosTel1','DosTel2'}
    assert set(df.unit)=={'µGy/h'}
    assert df.metadata.iloc[0]=={'spacecraft':'test_craft','module':'test_module'}
    profiles = detector_profiles(df)
    p = profiles[0]
    assert p['subject_count'] is None
    assert p['row_count']==3 and p['median_interval_seconds']==600
    assert p['longest_gap_seconds']==960
    assert p['longest_gaps'][0]['start']==pd.Timestamp('2026-01-01T23:14:00Z')
    assert p['longest_gaps'][0]['end']==pd.Timestamp('2026-01-01T23:30:00Z')
    ref={'DosTel1':dict(row_count=3,median_interval_seconds=600,longest_gap_seconds=960),
         'DosTel2':dict(row_count=5,median_interval_seconds=240,longest_gap_seconds=240)}
    assert verify_reference(profiles,ref)['status']=='passed'
    ref['DosTel1']['row_count']=4
    assert verify_reference(profiles,ref)['status']=='failed'
    assert verify_reference(profiles,None)['status']=='not_verified'


def test_replay_strict_boundary_no_future_leak_and_recovery():
    result=replay(fixture(), ['2026-01-01T'+t+'Z' for t in ['23:19:00','23:20:00','23:30:00']])
    boundary, stale, recovery=result['snapshots']
    assert boundary['sources'][0]['state']=='current'
    assert [s['state'] for s in stale['sources']]==['stale','current']
    assert stale['sources'][0]['age_seconds']==360
    gap=stale['audit_history'][0]
    assert gap['end'] is None and gap['cause']=='unknown'
    assert recovery['sources'][0]['state']=='current'
    closed=recovery['audit_history'][0]
    assert closed['id']==gap['id'] and closed['cause']=='unknown'
    assert closed['status']=='closed' and closed['duration_seconds']==960
    assert closed['end']==pd.Timestamp('2026-01-01T23:30:00Z')


def test_replay_before_first_observation_and_invalid_clocks():
    result=replay(fixture(), ['2026-01-01T00:00:00Z'])
    assert all(s['state']=='unknown' for s in result['snapshots'][0]['sources'])
    assert not result['snapshots'][0]['audit_history']
    with pytest.raises(ValueError,match='timezone'):
        replay(fixture(),['2026-01-01T23:20:00'])


def test_detector_cli_preserves_raw_and_leaves_subject_count_unset(tmp_path):
    import json
    import yaml
    from src.cli import run
    (tmp_path/'config').mkdir()
    df=fixture()
    raw=df.rename(columns={'source':'instrument_id','value':'absorbed_dose_rate'})
    raw['spacecraft']='test_craft'; raw['module']='test_module'
    raw=raw[['instrument_id','timestamp','absorbed_dose_rate','spacecraft','module']]
    raw.to_csv(tmp_path/'input.csv',index=False)
    original=(tmp_path/'input.csv').read_bytes()
    config={'test':dict(path='input.csv',observation_kind='detector',provenance='SYNTHETIC',
        columns={'instrument_id':'source'},replay_clocks=['2026-01-01T23:20:00Z','2026-01-01T23:30:00Z'])}
    (tmp_path/'config/datasets.yaml').write_text(yaml.safe_dump(config))
    (tmp_path/'config/metrics.yaml').write_text(yaml.safe_dump({'absorbed_dose_rate':{'unit':'µGy/h'}}))
    result=run('test',root=tmp_path)
    assert result['subjects'] is None and result['detectors']==2
    report=json.loads((tmp_path/'reports/datasets/test.json').read_text())
    assert report['subject_count'] is None
    assert report['reference_verification']['status']=='not_verified'
    assert (tmp_path/'input.csv').read_bytes()==original
    assert (tmp_path/report['dataset']['raw_archive']).read_bytes()==original
    assert all(p['unit']=='µGy/h' and p['subject_count'] is None for p in report['profile'])
