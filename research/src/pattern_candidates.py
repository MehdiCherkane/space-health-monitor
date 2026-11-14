import hashlib
import numpy as np
from .correlations import pair_data, estimate
from .lag_analysis import lag_pairs
from .models import Candidate

# Engineering heuristics only. No p-value selection or medical interpretation.
CRITERIA = {'STRONG': {'samples': 100, 'subjects': 5, 'effect': .5, 'consistency': .8},
            'MODERATE': {'samples': 30, 'subjects': 3, 'effect': .3, 'consistency': .67}}

def split_subjects(df, seed=42):
    ids = np.array(sorted(df.subject_id.unique()))
    np.random.default_rng(seed).shuffle(ids)
    n = max(1, int(len(ids)*.7)) if len(ids) > 1 else len(ids)
    return ids[:n].tolist(), ids[n:].tolist()

def effect(p):
    effects = [estimate(g)['coefficient'] for _, g in p.groupby('subject_id')]
    effects = [r for r in effects if np.isfinite(r)]
    return float(np.median(effects)) if effects else np.nan

def classify(n, subjects, magnitude, consistency, validated):
    if n < 10 or subjects < 2 or not np.isfinite(magnitude):
        return 'INCONCLUSIVE'
    for name, c in CRITERIA.items():
        if validated and n >= c['samples'] and subjects >= c['subjects'] and magnitude >= c['effect'] and consistency >= c['consistency']:
            return name
    return 'WEAK'

def candidates(df, correlations, lag_specs):
    discovery, validation = split_subjects(df)
    specs = [dict(a=r['metric_a'], b=r['metric_b'], method='exact_timestamp', lag=0) for r in correlations] + lag_specs
    results = []
    for spec in specs:
        a, b, method, lag = (spec[k] for k in ('a', 'b', 'method', 'lag'))
        p = pair_data(df, a, b) if method == 'exact_timestamp' else lag_pairs(df, a, b, lag, method)
        p = p.dropna(subset=['x', 'y'])
        disc, val = p[p.subject_id.isin(discovery)], p[p.subject_id.isin(validation)]
        de, ve = effect(disc), effect(val)
        # Select only on discovery subjects; validation never selects candidates.
        if not np.isfinite(de) or abs(de) < .3:
            continue
        subject_effects = {s: estimate(g)['coefficient'] for s, g in p.groupby('subject_id')}
        usable = [v for v in subject_effects.values() if np.isfinite(v)]
        same = sum(v*de > 0 for v in usable)
        opposite = sum(v*de < 0 for v in usable)
        consistent = bool(np.isfinite(ve) and de*ve > 0)
        pooled = estimate(p)
        warnings = pooled['warnings'] + ['discovery_selected', 'engineering_stability_not_medical_confidence', 'shared_time_trends_may_confound']
        if 'SYNTHETIC' in set(df.provenance):
            warnings.append('SYNTHETIC_TEST_DATA_NOT_NASA_DATA')
        if not consistent:
            warnings.append('validation_not_directionally_confirmed')
        loso = []
        if 2 <= len(subject_effects) <= 10:
            for subject in subject_effects:
                train, held = effect(p[p.subject_id != subject]), subject_effects[subject]
                loso.append(dict(held_out_subject=subject, training_median_effect=train, held_out_effect=held,
                                 direction_consistent=bool(np.isfinite(train) and np.isfinite(held) and train*held > 0)))
        stability = dict(discovery_subjects=discovery, validation_subjects=validation,
            discovery_statistics=estimate(disc), validation_statistics=estimate(val),
            discovery_median_effect=de, validation_median_effect=ve, validation_consistent=consistent,
            subject_effects=subject_effects, evaluable_subject_count=len(usable), same_direction=same,
            opposite_direction=opposite, zero_direction=sum(v == 0 for v in usable),
            median_subject_effect=float(np.median(usable)), effect_range=[min(usable), max(usable)],
            leave_one_subject_out=loso)
        identifier = hashlib.sha256(f'{df.dataset_id.iloc[0]}:{a}:{b}:{method}:{lag}'.encode()).hexdigest()[:12]
        results.append(Candidate(id='candidate_'+identifier, metrics=[a,b],
            relationship=dict(type='association' if method == 'exact_timestamp' else 'lagged_association',
                direction='positive' if de > 0 else 'negative', method=method, lag=lag),
            statistics=pooled, stability=stability,
            dataset=dict(id=df.dataset_id.iloc[0], sources=sorted(df.source.unique()), provenance=sorted(df.provenance.unique())),
            confidence=classify(len(p),len(usable),abs(de),same/max(1,len(usable)),consistent), warnings=warnings).model_dump())
    return results
