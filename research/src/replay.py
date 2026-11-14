"""Offline event-time replay. No live health states or inferred gap causes."""
import hashlib
import pandas as pd


def replay(df, clocks, stale_after='5min'):
    threshold = pd.Timedelta(stale_after)
    if threshold <= pd.Timedelta(0):
        raise ValueError('stale_after must be positive')
    times = [pd.Timestamp(c) for c in clocks]
    if any(t.tzinfo is None for t in times):
        raise ValueError('Replay clocks require an explicit timezone and date')
    times = [t.tz_convert('UTC') for t in times]
    if times != sorted(times):
        raise ValueError('Replay clocks must be nondecreasing')
    if df.metric.nunique() != 1:
        raise ValueError('Replay requires one metric; freshness must not mix metrics')
    snapshots = []
    for clock in times:
        states, audit = [], []
        for source, stream in df.groupby('source'):
            # Never consume a future observation, including future recovery readings.
            seen = stream[(stream.timestamp <= clock) & stream.value.notna()].sort_values('timestamp')
            last = seen.timestamp.max()
            age = (clock-last).total_seconds() if pd.notna(last) else None
            state = 'unknown' if age is None else 'stale' if age > threshold.total_seconds() else 'current'
            states.append(dict(source=source, state=state, last_observation=last,
                               age_seconds=age, subject_count=None))
            readings = list(seen.timestamp)
            for start, end in zip(readings, readings[1:] + [None]):
                until = end if end is not None else clock
                if until-start <= threshold:
                    continue
                event_id = hashlib.sha256(f'{stream.dataset_id.iloc[0]}:{source}:{start}'.encode()).hexdigest()[:16]
                audit.append(dict(id='gap_'+event_id, source=source, dataset_id=stream.dataset_id.iloc[0],
                    input_provenance=sorted(seen.provenance.unique()), provenance='DERIVED',
                    start=start, end=end, duration_seconds=(end-start).total_seconds() if end is not None else None,
                    observed_through=until, status='closed' if end is not None else 'open', cause='unknown',
                    stale_strictly_after=start+threshold, recovered_at=end))
        snapshots.append(dict(clock=clock, sources=states, audit_history=audit))
    return dict(stale_after_seconds=threshold.total_seconds(), setting='demo_only',
                comparison='age_seconds > stale_after_seconds', snapshots=snapshots)
