import hashlib
import json
from pathlib import Path
import numpy as np
import pandas as pd
import pytest
import yaml
from src.normalize import normalize
from src.ingest import GenericAdapter
from src.profiling import mad, profile
from src.baselines import baselines
from src.features import features
from src.missingness import missingness
from src.correlations import estimate, pair_data, relationships
from src.lag_analysis import lag_pairs
from src.pattern_candidates import candidates, split_subjects, classify
from src.models import Candidate
from src.report import clean
from src.changepoints import changepoints
from src.cli import run

METRICS = {'x': {'unit':'score'}, 'y': {'unit':'ms'}}
CONFIG = {'id':'test','source':'fixture','provenance':'SYNTHETIC'}

def sample():
    return normalize(pd.DataFrame([dict(subject_id=s, timestamp=f'2026-01-{d:02}',
        mission_phase='preflight' if d < 4 else 'inflight', x=float(d), y=float(30-d))
        for s in ['a','b','c','d'] for d in range(1,11)]), CONFIG, METRICS)

def test_normalization_and_json(tmp_path):
    path = tmp_path/'data.json'
    path.write_text('[{"subject_id":"001","timestamp":"2026-01-01","x":null,"activity":"rest"}]')
    df = GenericAdapter().normalize(GenericAdapter().load(path), CONFIG, METRICS)
    assert df.subject_id.iloc[0] == '001'
    assert pd.isna(df.value.iloc[0]) and df.metadata.iloc[0]['activity'] == 'rest'
    assert str(df.timestamp.dt.tz) == 'UTC'
    assert df.provenance.iloc[0] == 'SYNTHETIC'

@pytest.mark.parametrize('change', [{'value':'bad'}, {'unit':'unknown'}, {'value':float('inf')}, {'timestamp':None}])
def test_invalid_values_fail(change):
    row = dict(subject_id='a',timestamp='2026-01-01',metric='x',value=1,unit='score')
    row.update(change)
    with pytest.raises((ValueError, TypeError)):
        normalize(pd.DataFrame([row]), CONFIG, METRICS)

def test_duplicate_rejected():
    row = dict(subject_id='a',timestamp='2026-01-01',x=1)
    with pytest.raises(ValueError, match='Duplicate'):
        normalize(pd.DataFrame([row,row]),CONFIG,METRICS)

def test_baseline_mad_and_features():
    df = sample(); b = baselines(df)
    x = b[(b.subject_id == 'a') & (b.metric == 'x')].iloc[0]
    assert x['median'] == 2 and x['mad'] == 1 and x['std'] == 1
    assert mad([1,2,3,100,np.nan]) == 1
    f = features(df,b,window='3D')
    row = f[(f.subject_id == 'a') & (f.metric == 'x')].iloc[3]
    assert row.rolling_mean == 3 and row.rolling_mad == 1
    assert row.percentage_deviation == 100 and row.rate_per_day == 1
    assert row.trend_slope_per_day == pytest.approx(1)
    assert row.absolute_deviation == 2

def test_zero_and_missing_baselines():
    df = sample(); df.loc[df.metric == 'x','value'] = 0.
    f = features(df,baselines(df))
    assert f[f.metric == 'x'].percentage_deviation.isna().all()
    assert f[f.metric == 'x'].robust_z.isna().all()
    assert features(df,baselines(df,'absent')).percentage_deviation.isna().all()

def test_irregular_window_and_missingness():
    df = sample(); df = df[(df.subject_id == 'a') & (df.metric == 'x')].copy()
    df = df.iloc[[0,1,8,9]].copy(); df.loc[df.index[-1], 'value'] = np.nan
    f = features(df,baselines(df),window='3D')
    assert pd.isna(f.rolling_mean.iloc[2])
    q = missingness(df,{'x':'1D'},'2026-01-12')
    assert q['summary'][0]['longest_gap_seconds'] == 7*86400
    assert q['summary'][0]['time_since_last_observation_seconds'] == 3*86400
    assert {e['type'] for e in q['events']} == {'unexpected_gap','stale_source','missing_value'}

def test_correlations_and_lags():
    df = sample(); p = pair_data(df,'x','y')
    assert estimate(p)['coefficient'] == pytest.approx(-1)
    assert estimate(p)['subject_count'] == 4
    temporal = lag_pairs(df,'x','y','1D','temporal')
    assert len(temporal) == 36
    assert temporal.iloc[0].x == 1 and temporal.iloc[0].y == 28
    row = lag_pairs(df,'x','y',1,'row')
    assert row.groupby('subject_id').head(1).x.isna().all()
    assert row.dropna().x.tolist() == temporal.x.tolist()
    with pytest.raises(ValueError):
        lag_pairs(df,'x','y',-1,'row')

def test_missing_rows_not_compressed_in_lag():
    df = sample(); df.loc[(df.metric == 'x') & (df.timestamp.dt.day == 2), 'value'] = np.nan
    p = lag_pairs(df,'x','y',1,'row')
    assert p[p.timestamp.dt.day == 3].x.isna().all()

def test_subject_split_and_candidates_serialization():
    df = sample(); a,b = split_subjects(df)
    assert set(a).isdisjoint(b) and set(a+b) == set(df.subject_id)
    cs = candidates(df, relationships(df), [])
    assert cs
    c = Candidate.model_validate(json.loads(json.dumps(clean(cs[0]), allow_nan=False)))
    assert c.status == 'review_required'
    assert c.stability['same_direction'] == 4 and c.stability['validation_consistent']
    assert len(c.stability['leave_one_subject_out']) == 4
    assert 'SYNTHETIC_TEST_DATA_NOT_NASA_DATA' in c.warnings
    assert classify(1000,1,.9,1,False) == 'INCONCLUSIVE'

def test_outlier_retention():
    df = sample(); df.loc[df.index[0],'value'] = 10000
    before = df.copy(deep=True)
    p = profile(df)
    assert any(s['outliers'] for s in p)
    pd.testing.assert_frame_equal(before,df)

def test_changepoint_step():
    df = sample(); df = df[(df.subject_id == 'a') & (df.metric == 'x')].copy()
    df['value'] = [0]*5+[10]*5
    cp = changepoints(df,penalty=1,min_size=2)
    assert any(c['timestamp'].day == 6 for c in cp)

def test_pipeline_end_to_end(tmp_path, monkeypatch):
    import src.cli as cli
    root = Path(__file__).resolve().parents[1]
    for sub in ['config','examples','reports/datasets']:
        (tmp_path/sub).mkdir(parents=True)
    for name in ['metrics.yaml','datasets.yaml']:
        (tmp_path/'config'/name).write_bytes((root/'config'/name).read_bytes())
    src = root/'examples/synthetic_mission.csv'
    target = tmp_path/'examples/synthetic_mission.csv'; target.write_bytes(src.read_bytes())
    before = hashlib.sha256(target.read_bytes()).hexdigest()
    monkeypatch.setattr(cli, 'plots', lambda *a: [])
    result = run('synthetic_mission',root=tmp_path)
    assert result['subjects'] == 6 and result['candidates'] > 0
    report = json.loads((tmp_path/'reports/datasets/synthetic_mission.json').read_text())
    assert report['dataset']['sha256'] == before == hashlib.sha256(target.read_bytes()).hexdigest()
    assert report['context_profiles']['activity']
    assert any(e['type'] == 'stale_source' for e in report['missingness']['events'])
    assert yaml.safe_load((tmp_path/'reports/patterns/candidates.yaml').read_text())
