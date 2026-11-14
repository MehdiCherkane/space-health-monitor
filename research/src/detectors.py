"""Detector profiles; detector counts are never astronaut subject counts."""
import json
import numpy as np
import pandas as pd
from .profiling import stats
from .replay import replay
from .report import clean, write_json


def detector_profiles(df):
    results = []
    for (source, metric), g in df.groupby(['source', 'metric']):
        g = g.sort_values('timestamp')
        times = g.timestamp
        intervals = times.diff().dt.total_seconds().dropna()
        gaps = [dict(start=a, end=b, seconds=(b-a).total_seconds(), cause='unknown')
                for a, b in zip(times, times.iloc[1:])]
        longest = max((gap['seconds'] for gap in gaps), default=None)
        summary = stats(g.value)
        outliers = g[(g.value < summary['p25']-1.5*summary['iqr']) | (g.value > summary['p75']+1.5*summary['iqr'])]
        results.append(dict(source=source, metric=metric, unit=g.unit.iloc[0], subject_count=None,
            row_count=len(g), time_start=times.min(), time_end=times.max(),
            median_interval_seconds=intervals.median() if len(intervals) else None,
            longest_gap_seconds=longest, longest_gaps=[gap for gap in gaps if gap['seconds'] == longest],
            missing_percentage=100*g.value.isna().mean(), **summary,
            metadata=[json.loads(item) for item in sorted({json.dumps(m, sort_keys=True) for m in g.metadata})],
            outliers=outliers[['timestamp','value','source','provenance']].to_dict('records')))
    return results


def verify_reference(profiles, reference, tolerance_seconds=1e-6):
    if not reference:
        return dict(status='not_verified', reason='Reference table not supplied', checks=[])
    actual = {p['source']:p for p in profiles}
    checks = []
    for source in sorted(set(actual) | set(reference)):
        for field in ['row_count', 'median_interval_seconds', 'longest_gap_seconds']:
            expected = reference.get(source, {}).get(field)
            observed = actual.get(source, {}).get(field)
            passed = (expected is not None and observed is not None and
                      np.isclose(observed, expected, rtol=0, atol=0 if field=='row_count' else tolerance_seconds))
            checks.append(dict(source=source, field=field, expected=expected, actual=observed, passed=bool(passed)))
    return dict(status='passed' if all(c['passed'] for c in checks) else 'failed', checks=checks)


def export_detector_report(df, lineage, config, root):
    profiles = detector_profiles(df)
    report = dict(dataset=lineage, observation_kind='detector', subject_count=None,
        detector_count=df.source.nunique(), row_count=len(df), profile=profiles,
        reference_verification=verify_reference(profiles, config.get('reference_table')),
        replay=replay(df, config.get('replay_clocks', []), config.get('stale_after', '5min')),
        warnings=['Detector measurements are not astronaut subjects.',
                  'Five minutes is a demo freshness setting, not a radiation or medical threshold.',
                  'Gap cause is unknown. Intervals use all recorded timestamps, with no imputation.'])
    output = root/'reports/datasets'; output.mkdir(parents=True, exist_ok=True)
    name = lineage['id']
    write_json(output/f'{name}.json', report)
    lines = [f'# Detector dataset: {name}', '', f"Provenance: {', '.join(lineage['provenance'])}",
             f"Raw SHA256: `{lineage['sha256']}`", '', 'Astronaut subject count: unset.', '',
             '| Detector | Rows | Median interval (s) | Longest gap (s) | Unit |', '|---|---:|---:|---:|---|']
    for p in profiles:
        lines.append(f"| {p['source']} | {p['row_count']} | {p['median_interval_seconds']} | {p['longest_gap_seconds']} | {p['unit']} |")
    for p in profiles:
        for gap in p['longest_gaps']:
            lines.append(f"\n{p['source']} longest gap: {gap['start'].isoformat()} → {gap['end'].isoformat()}; cause unknown.\n")
    lines += ['', f"Reference table verification: {report['reference_verification']['status']}", '',
              'Five-minute freshness threshold: demo only; stale when age is strictly greater than 300 seconds.', '']
    for snap in report['replay']['snapshots']:
        lines.append(f"Replay {snap['clock'].isoformat()}:")
        lines += [f"- {s['source']}: {s['state']}; age {s['age_seconds']} seconds" for s in snap['sources']]
        lines.append('')
    lines += ['Gap history, timestamps, recovery and unknown causes are retained in the JSON audit history.']
    (output/f'{name}.md').write_text('\n'.join(lines)+'\n')
    return clean(dict(dataset=name, rows=len(df), subjects=None, detectors=df.source.nunique(),
                      reference_verification=report['reference_verification']['status'], report=str(output/f'{name}.md')))
