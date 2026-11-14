from itertools import combinations
import numpy as np
import pandas as pd
from scipy.stats import spearmanr

def estimate(pairs):
    p = pairs.dropna(subset=['x', 'y'])
    n = len(p)
    warnings = ['correlation_not_causation', 'p_value_exploratory_autocorrelation_unadjusted', 'multiple_testing_unadjusted']
    if n < 20:
        warnings.append('tiny_sample')
    if n < 500:
        warnings.append('asymptotic_p_value_small_sample')
    subjects = p.subject_id.nunique()
    if subjects == 1:
        warnings.append('single_subject')
    rho, pv = (np.nan, np.nan)
    if n >= 3 and p.x.nunique() > 1 and p.y.nunique() > 1:
        rho, pv = spearmanr(p.x, p.y)
    else:
        warnings.append('insufficient_or_constant_data')
    return dict(coefficient=float(rho), p_value=float(pv), sample_count=n,
                subject_count=subjects, warnings=warnings)

def pair_data(df, a, b):
    keys = ['subject_id', 'timestamp']
    x = df[df.metric == a][keys+['value']].rename(columns={'value': 'x'})
    y = df[df.metric == b][keys+['value']].rename(columns={'value': 'y'})
    return x.merge(y, on=keys, validate='one_to_one')

def relationships(df):
    results = []
    for a, b in combinations(sorted(df.metric.unique()), 2):
        p = pair_data(df, a, b)
        pooled = estimate(p)
        between = estimate(p.dropna(subset=['x', 'y']).groupby('subject_id', as_index=False)[['x', 'y']].mean())
        within = [dict(subject_id=s, **estimate(g)) for s, g in p.groupby('subject_id')]
        results.append(dict(metric_a=a, metric_b=b, method='exact_timestamp', pooled=pooled,
                            between_subject=between, within_subject=within))
    return results
