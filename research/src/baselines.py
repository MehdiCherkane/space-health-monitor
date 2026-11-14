import pandas as pd
from .profiling import stats

def baselines(df, phase='preflight'):
    rows = []
    for (subject, metric), g in df.groupby(['subject_id', 'metric']):
        selected = g if phase is None else g[g.mission_phase == phase]
        rows.append(dict(subject_id=subject, metric=metric, baseline_phase=phase,
                         baseline_missing=selected.value.count() == 0, **stats(selected.value)))
    return pd.DataFrame(rows)
