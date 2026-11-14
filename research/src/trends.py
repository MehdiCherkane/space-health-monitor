import numpy as np
from .features import slope

def trends(df, min_samples=8, min_span_days=7):
    results = []
    for (subject, metric), g in df.groupby(['subject_id', 'metric']):
        g = g.dropna(subset=['value']).sort_values('timestamp')
        halves = np.array_split(np.arange(len(g)), 2)
        full = slope(g)
        hs = [slope(g.iloc[ix]) for ix in halves]
        span = (g.timestamp.max()-g.timestamp.min()).total_seconds()/86400 if len(g) else 0
        persistent = len(g) >= min_samples and span >= min_span_days and all(np.isfinite(v) and v*full > 0 for v in hs)
        results.append(dict(subject_id=subject, metric=metric, slope_per_day=full,
                            half_slopes=hs, sample_count=len(g), persistent=bool(persistent),
                            direction='up' if full > 0 else 'down' if full < 0 else 'undefined'))
    return results
