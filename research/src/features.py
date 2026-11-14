import numpy as np
import pandas as pd
from .profiling import mad

def slope(g):
    valid = g.dropna(subset=['value'])
    if len(valid) < 3:
        return np.nan
    t = (valid.timestamp - valid.timestamp.min()).dt.total_seconds()/86400
    return float(np.polyfit(t, valid.value, 1)[0]) if t.max() > 0 else np.nan

def features(df, baseline, window='7D', floor=1e-6, deviation_mad=2., max_gap='2D'):
    if pd.Timedelta(window) <= pd.Timedelta(0) or pd.Timedelta(max_gap) <= pd.Timedelta(0):
        raise ValueError('Window and max_gap must be positive')
    result = []
    for (subject, metric), g in df.groupby(['subject_id', 'metric']):
        g = g.sort_values('timestamp').copy()
        b = baseline[(baseline.subject_id == subject) & (baseline.metric == metric)].iloc[0]
        s = g.set_index('timestamp').value
        rolling = s.rolling(window, min_periods=2)
        for name, v in [('mean', rolling.mean()), ('median', rolling.median()), ('std', rolling.std()),
                        ('mad', rolling.apply(mad, raw=True))]:
            g['rolling_'+name] = v.to_numpy()
        g['baseline_median'] = b['median']
        g['signed_deviation'] = g.value-b['median']
        g['absolute_deviation'] = g.signed_deviation.abs()
        g['percentage_deviation'] = g.signed_deviation/abs(b['median'])*100 if abs(b['median']) > floor else np.nan
        scale = 1.4826*b['mad']
        g['robust_z'] = g.signed_deviation/scale if scale > floor else np.nan
        dt = g.timestamp.diff().dt.total_seconds()/86400
        g['rate_per_day'] = g.value.diff()/dt.where(dt > 0)
        g['trend_slope_per_day'] = [slope(g[(g.timestamp > t-pd.Timedelta(window)) & (g.timestamp <= t)]) for t in g.timestamp]
        start, previous, direction = None, None, 0
        durations = []
        for t, z in zip(g.timestamp, g.robust_z):
            sign = np.sign(z) if pd.notna(z) and abs(z) >= deviation_mad else 0
            if not sign:
                start, direction = None, 0
            elif start is None or sign != direction or t-previous > pd.Timedelta(max_gap):
                start, direction = t, sign
            durations.append((t-start).total_seconds() if start is not None else 0.)
            previous = t
        g['persistent_deviation_seconds'] = durations
        g['input_provenance'] = g.provenance
        g['provenance'] = 'DERIVED'
        result.append(g)
    return pd.concat(result, ignore_index=True)
