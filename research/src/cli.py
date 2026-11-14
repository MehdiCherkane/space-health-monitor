"""Run from research/: python -m src.cli analyze synthetic_mission."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import importlib.metadata
import pandas as pd
import yaml
from .ingest import ADAPTERS
from .profiling import profile
from .baselines import baselines
from .features import features
from .missingness import missingness
from .correlations import relationships
from .lag_analysis import lag_analysis
from .trends import trends
from .changepoints import changepoints
from .pattern_candidates import candidates, CRITERIA
from .report import write_json, clean, plots, export_report

ROOT = Path(__file__).resolve().parents[1]

def run(dataset_id, command='analyze', root=ROOT, filters=None, config_path=None):
    if not re.fullmatch(r'[A-Za-z0-9_-]+', dataset_id):
        raise ValueError('Dataset ID must contain only letters, numbers, underscore or hyphen')
    config = yaml.safe_load(Path(config_path or root/'config/datasets.yaml').read_text())[dataset_id]
    config = dict(config, id=dataset_id)
    metrics = yaml.safe_load((root/'config/metrics.yaml').read_text())
    path = (root/config['path']).resolve()
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    raw = root/'data/raw'/f'{dataset_id}_{digest}{path.suffix}'
    raw.parent.mkdir(parents=True, exist_ok=True)
    if not raw.exists():
        with raw.open('xb') as destination, path.open('rb') as source:
            shutil.copyfileobj(source, destination)
    if hashlib.sha256(raw.read_bytes()).hexdigest() != digest:
        raise ValueError('Archived raw checksum mismatch')
    adapter = ADAPTERS[config.get('adapter', 'generic')]()
    df = adapter.normalize(adapter.load(raw), config, metrics)
    (root/'data/normalized').mkdir(parents=True, exist_ok=True)
    write_json(root/'data/normalized'/f'{dataset_id}.json', df.to_dict('records'))
    if command == 'normalize':
        return {'normalized_rows': len(df)}
    for key, value in (filters or {}).items():
        if key in df:
            df = df[df[key].astype(str) == value]
        else:
            df = df[df.metadata.map(lambda m: str(m.get(key)) == value)]
    if df.empty:
        raise ValueError('No observations after filtering')
    lineage = dict(id=dataset_id, sha256=digest, raw_archive=str(raw.relative_to(root)),
                   sources=sorted(df.source.unique()), provenance=sorted(df.provenance.unique()), filters=filters or {})
    (root/'reports/datasets').mkdir(parents=True, exist_ok=True)
    if config.get('observation_kind') == 'detector':
        from .detectors import export_detector_report
        return export_detector_report(df, lineage, config, root)
    if command == 'profile':
        output = dict(dataset=lineage, profile=profile(df))
        write_json(root/'reports/datasets'/f'{dataset_id}_profile.json', output)
        return clean(output)
    baseline = baselines(df, config.get('baseline_phase', 'preflight'))
    derived = features(df, baseline, **config.get('features', {}))
    quality = missingness(df, config.get('expected_intervals'), config.get('as_of'))
    corr = relationships(df)
    lags = config.get('lags', [])
    patterns = candidates(df, corr, lags)
    changes = changepoints(df, **config.get('changepoints', {}))
    contexts = {}
    for context in config.get('contexts', ['mission_phase']):
        cdf = df.copy()
        if context not in cdf:
            cdf[context] = cdf.metadata.map(lambda m: m.get(context))
        contexts[context] = profile(cdf, context)
    warnings = ['Correlation is not causation; all patterns require human review.',
        'P-values are exploratory: no correction for serial dependence, repeated observations or multiple comparisons.',
        'Exact timestamp matching can discard asynchronous pairs; no interpolation or imputation is performed.',
        'Baseline absence or near-zero baseline/MAD yields null deviations.',
        'Context distributions are descriptive; pooled associations can reflect confounding or common time trends.',
        'Change points use valid-observation order and are sensitive to spikes and irregular sampling.',
        'Missing percentages count explicit null records; absent scheduled rows are reported as gaps, not invented rows.',
        'Freshness is relative to configured as_of or the dataset end, not the current clock.']
    if df.subject_id.nunique() == 1:
        warnings.append('SINGLE SUBJECT: no independent subject validation possible.')
    if len(df) < 20:
        warnings.append('TINY DATASET: results are unstable.')
    if 'SYNTHETIC' in set(df.provenance):
        warnings.append('SYNTHETIC TEST DATA — NOT NASA DATA; deliberately planted relationships are not scientific evidence.')
    report = dict(dataset=lineage, row_count=len(df), subject_count=df.subject_id.nunique(),
        config=config, metrics_config=metrics, confidence_criteria=CRITERIA,
        versions={p: importlib.metadata.version(p) for p in ['pandas','numpy','scipy','matplotlib','pyyaml','pydantic','ruptures']},
        profile=profile(df), context_profiles=contexts, baselines=baseline.to_dict('records'),
        missingness=quality, correlations=corr, lags=lag_analysis(df,lags), trends=trends(df),
        changepoints=changes, candidates=patterns, warnings=warnings)
    output = root/'data/derived'; output.mkdir(parents=True, exist_ok=True)
    write_json(output/f'{dataset_id}_features.json', dict(dataset=lineage, provenance='DERIVED', observations=derived.to_dict('records')))
    report['plots'] = plots(df, derived, changes, patterns, root/'reports/datasets'/f'{dataset_id}_plots')
    export_report(report, root)
    return {'dataset': dataset_id, 'rows': len(df), 'subjects': df.subject_id.nunique(),
            'candidates': len(patterns), 'report': str(root/'reports/datasets'/f'{dataset_id}.md')}

def main():
    parser = argparse.ArgumentParser(description='Research evidence only; no medical rule generation.')
    parser.add_argument('command', choices=['normalize','profile','analyze','patterns','report'])
    parser.add_argument('dataset_id')
    parser.add_argument('--config', type=Path, help='Alternate datasets YAML')
    parser.add_argument('--filter', action='append', default=[], metavar='KEY=VALUE')
    args = parser.parse_args()
    filters = dict(item.split('=', 1) for item in args.filter)
    print(json.dumps(run(args.dataset_id, args.command, filters=filters, config_path=args.config), indent=2, allow_nan=False))

if __name__ == '__main__':
    main()
