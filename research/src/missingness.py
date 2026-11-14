import pandas as pd

def missingness(df, intervals=None, as_of=None):
    intervals = intervals or {}
    end = pd.to_datetime(as_of, utc=True) if as_of else df.timestamp.max()
    if end < df.timestamp.max():
        raise ValueError('as_of precedes dataset observations')
    summaries, events = [], []
    for (subject, metric, source), g in df.groupby(['subject_id', 'metric', 'source']):
        valid = g[g.value.notna()].sort_values('timestamp')
        expected = pd.Timedelta(intervals[metric]) if metric in intervals else None
        if expected is not None and expected <= pd.Timedelta(0):
            raise ValueError('Measurement intervals must be positive')
        last = valid.timestamp.max()
        age = (end-last).total_seconds() if pd.notna(last) else None
        times = list(valid.timestamp)
        # Include leading and trailing observation coverage boundaries.
        boundaries = [g.timestamp.min()] + times + [end]
        gaps = [(b-a).total_seconds() for a, b in zip(boundaries, boundaries[1:])]
        common = dict(subject_id=subject, metric=metric, source=source,
                      dataset_id=g.dataset_id.iloc[0], input_provenance=sorted(g.provenance.unique()), provenance='DERIVED')
        summaries.append(dict(**common, as_of=end, time_since_last_observation_seconds=age,
            expected_interval_seconds=expected.total_seconds() if expected is not None else None,
            missing_percentage=100*g.value.isna().mean(), longest_gap_seconds=max(gaps, default=0)))
        for t in g.loc[g.value.isna(), 'timestamp']:
            events.append(dict(**common, type='missing_value', timestamp=t))
        for a, b in zip(boundaries, boundaries[1:]):
            if expected is not None and b-a > expected*1.5:
                events.append(dict(**common, type='stale_source' if b == end and (pd.isna(last) or last < end) else 'unexpected_gap',
                                   start=a, end=b, gap_seconds=(b-a).total_seconds()))
    return dict(summary=summaries, events=events)
