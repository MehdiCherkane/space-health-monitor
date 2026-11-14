import numpy as np
import ruptures as rpt

def changepoints(df, penalty=5., min_size=5):
    if penalty <= 0 or min_size < 2:
        raise ValueError('Positive penalty and min_size >= 2 required')
    results = []
    for (subject, metric), g in df.groupby(['subject_id', 'metric']):
        g = g.dropna(subset=['value']).sort_values('timestamp')
        if len(g) < min_size*2 or g.value.std() == 0:
            continue
        signal = ((g.value-g.value.mean())/g.value.std()).to_numpy()
        breaks = rpt.Pelt(model='l2', min_size=min_size, jump=1).fit(signal).predict(pen=penalty)
        for ix in breaks[:-1]:
            results.append(dict(subject_id=subject, metric=metric, timestamp=g.timestamp.iloc[ix],
                preceding_timestamp=g.timestamp.iloc[ix-1], method='PELT_L2_standardized_valid_observation_order',
                penalty=penalty, min_size=min_size, status='candidate_event',
                warnings=['missing_values_omitted_no_imputation', 'irregular_spacing_not_modeled', 'outlier_sensitive']))
    return results
