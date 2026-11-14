import pandas as pd
from .correlations import estimate

def lag_pairs(df, a, b, lag=1, method='row'):
    """Positive lag pairs earlier A with later B. No cross-subject matches."""
    if method not in ('row', 'temporal'):
        raise ValueError('Lag method must be row or temporal')
    x = df[df.metric == a][['subject_id', 'timestamp', 'value']].rename(columns={'value': 'x'})
    y = df[df.metric == b][['subject_id', 'timestamp', 'value']].rename(columns={'value': 'y'})
    if method == 'temporal':
        delta = pd.Timedelta(lag)
        if delta < pd.Timedelta(0):
            raise ValueError('Lag must be nonnegative')
        x['timestamp'] += delta
        return x.merge(y, on=['subject_id', 'timestamp'], validate='one_to_one')
    if not isinstance(lag, int) or lag < 0:
        raise ValueError('Row lag must be a nonnegative integer')
    # Row lag operates on the union of scheduled A/B timestamps, retaining null rows.
    p = x.merge(y, on=['subject_id', 'timestamp'], how='outer', validate='one_to_one').sort_values(['subject_id', 'timestamp'])
    p['x'] = p.groupby('subject_id').x.shift(lag)
    return p

def lag_analysis(df, specs):
    return [dict(**spec, statistics=estimate(lag_pairs(df, spec['a'], spec['b'], spec['lag'], spec['method']))) for spec in specs]
