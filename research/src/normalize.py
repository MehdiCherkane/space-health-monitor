import json
import pandas as pd
from .models import Observation


def normalize(frame, config, metrics):
    """Map wide or long records. Invalid numeric strings/units fail explicitly."""
    frame = frame.rename(columns=config.get('columns', {})).copy()
    detector = config.get('observation_kind') == 'detector'
    if detector:
        if 'subject_id' in frame and frame.subject_id.notna().any():
            raise ValueError('Detector observations must not assign astronaut subjects')
        frame['subject_id'] = None
    if not {'subject_id', 'timestamp'} <= set(frame):
        raise ValueError('subject_id and timestamp required (or supply columns mapping)')
    if 'metric' not in frame:
        names = config.get('metrics', [m for m in metrics if m in frame])
        if not names:
            raise ValueError('No configured metric columns')
        frame = frame.melt(id_vars=[c for c in frame if c not in names], value_vars=names,
                           var_name='metric', value_name='value')
    records = []
    for raw in frame.to_dict('records'):
        metric = raw['metric']
        if metric not in metrics:
            raise ValueError(f'Unconfigured metric: {metric}')
        canonical = metrics[metric]['unit']
        unit = raw.get('unit', config.get('units', {}).get(metric, canonical))
        if unit != canonical:
            raise ValueError(f'{metric}: expected {canonical}, got {unit}; convert in adapter')
        metadata = raw.get('metadata', {})
        if isinstance(metadata, str):
            metadata = json.loads(metadata)
        if not isinstance(metadata, dict):
            metadata = {}
        known = set(Observation.model_fields)
        metadata.update({k: v for k, v in raw.items() if k not in known and pd.notna(v)})
        def field(name, default=None):
            v = raw.get(name, config.get(name, default))
            return None if v is None or (not isinstance(v, (dict, list)) and pd.isna(v)) else v
        ts = pd.to_datetime(raw['timestamp'], utc=True, errors='raise')
        if pd.isna(ts) or (not detector and pd.isna(raw['subject_id'])):
            raise ValueError('Missing subject or timestamp')
        value = raw['value']
        obs = Observation(subject_id=None if detector else str(raw['subject_id']), timestamp=ts.to_pydatetime(),
            metric=metric, value=None if pd.isna(value) else float(value), unit=unit,
            dataset_id=config['id'], source=field('source'), provenance=field('provenance'),
            mission_phase=field('mission_phase'), quality=field('quality'), metadata=metadata)
        records.append(obs.model_dump())
    result = pd.DataFrame(records)
    if result.empty:
        raise ValueError('Empty dataset')
    result['timestamp'] = pd.to_datetime(result.timestamp, utc=True)
    # Ambiguous observations must be resolved by adapter or explicit dataset configuration.
    identity = 'source' if detector else 'subject_id'
    if result.duplicated([identity, 'timestamp', 'metric']).any():
        raise ValueError('Duplicate identity/timestamp/metric observations; resolve explicitly in adapter')
    return result.sort_values([identity, 'metric', 'timestamp']).reset_index(drop=True)
