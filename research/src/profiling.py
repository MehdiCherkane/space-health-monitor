import numpy as np
import pandas as pd

def mad(values):
    x = np.asarray(pd.to_numeric(values, errors='coerce'), dtype=float)
    x = x[np.isfinite(x)]
    return float(np.median(np.abs(x - np.median(x)))) if len(x) else float('nan')

def stats(values):
    x = pd.Series(pd.to_numeric(values, errors='coerce')).dropna()
    q1, q3 = x.quantile(.25), x.quantile(.75)
    return dict(valid_count=len(x), mean=x.mean(), median=x.median(), std=x.std(), mad=mad(x),
                min=x.min(), max=x.max(), p25=q1, p75=q3, iqr=q3-q1,
                p05=x.quantile(.05), p95=x.quantile(.95))

def profile(df, context=None):
    keys = ['metric'] + ([context] if context else [])
    results = []
    for key, g in df.groupby(keys, dropna=False):
        s = stats(g.value)
        outliers = g[(g.value < s['p25'] - 1.5*s['iqr']) | (g.value > s['p75'] + 1.5*s['iqr'])]
        results.append(dict(metric=key[0], context=None if not context else str(key[1]),
            row_count=len(g), subject_count=g.subject_id.nunique(), time_start=g.timestamp.min(),
            time_end=g.timestamp.max(), missing_percentage=100*g.value.isna().mean(), **s,
            outliers=outliers[['subject_id', 'timestamp', 'value', 'source', 'provenance']].to_dict('records')))
    return results
