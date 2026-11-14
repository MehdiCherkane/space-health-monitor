import json
import math
from pathlib import Path
import numpy as np
import pandas as pd
import yaml
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from .correlations import pair_data
from .lag_analysis import lag_pairs


def clean(obj):
    if isinstance(obj, dict):
        return {str(k): clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set, frozenset)):
        return [clean(v) for v in obj]
    if not isinstance(obj, np.ndarray):
        try:
            if pd.isna(obj):
                return None
        except (TypeError, ValueError):
            pass
    if isinstance(obj, (pd.Timestamp,)):
        return obj.isoformat()
    import datetime as _dt
    if isinstance(obj, (_dt.datetime, _dt.date)):
        return obj.isoformat()
    if isinstance(obj, np.generic):
        return clean(obj.item())
    if isinstance(obj, float) and not math.isfinite(obj):
        return None
    return obj


def write_json(path, obj):
    Path(path).write_text(json.dumps(clean(obj), indent=2, allow_nan=False)+'\n')


def plots(df, derived, changes, patterns, directory):
    directory.mkdir(parents=True, exist_ok=True)
    paths = []
    for index, ((subject, metric), g) in enumerate(derived.groupby(['subject_id', 'metric'])):
        fig, axes = plt.subplots(3, 1, figsize=(9, 7), sharex=True)
        axes[0].plot(g.timestamp, g.value, '.-', label='observed')
        axes[0].plot(g.timestamp, g.rolling_mean, label='rolling mean')
        axes[0].plot(g.timestamp, g.baseline_median, '--', label='baseline median')
        for c in changes:
            if c['subject_id'] == subject and c['metric'] == metric:
                axes[0].axvline(c['timestamp'], color='red', alpha=.5)
        axes[0].set_ylabel(g.unit.iloc[0]); axes[0].legend()
        axes[1].plot(g.timestamp, g.percentage_deviation)
        axes[1].set_ylabel('baseline deviation %')
        axes[2].scatter(g.timestamp, g.value.notna().astype(int), s=10)
        axes[2].set_yticks([0, 1], ['missing', 'observed'])
        axes[2].set_xlabel('UTC; gaps between points indicate unobserved times')
        fig.suptitle(f'{subject} / {metric} — {", ".join(df.provenance.unique())}')
        fig.autofmt_xdate(); fig.tight_layout()
        name = f'series_{index:03}.png'; fig.savefig(directory/name, dpi=110); plt.close(fig)
        paths.append(name)
    for c in patterns:
        a, b = c['metrics']; r = c['relationship']
        p = pair_data(df, a, b) if r['method'] == 'exact_timestamp' else lag_pairs(df, a, b, r['lag'], r['method'])
        fig, ax = plt.subplots(figsize=(7, 5))
        for subject, g in p.groupby('subject_id'):
            ax.scatter(g.x, g.y, s=12, label=subject, alpha=.6)
        ax.set(xlabel=a, ylabel=b, title=f"Candidate only: {r['method']} lag={r['lag']}")
        ax.legend(); fig.tight_layout()
        name = c['id']+'.png'; fig.savefig(directory/name, dpi=110); plt.close(fig); paths.append(name)
    return paths


def export_report(report, root):
    dataset = report['dataset']['id']
    directory = root/'reports/datasets'; directory.mkdir(parents=True, exist_ok=True)
    write_json(directory/f'{dataset}.json', report)
    lines = [f'# Research dataset: {dataset}', '', 'Candidate evidence only; human review required.', '',
             f"Provenance: {', '.join(report['dataset']['provenance'])}",
             f"Raw SHA256: `{report['dataset']['sha256']}`", '',
             'SYNTHETIC TEST DATA — NOT NASA DATA' if 'SYNTHETIC' in report['dataset']['provenance'] else '', '',
             f"Rows: {report['row_count']}; subjects: {report['subject_count']}", '',
             '| Metric | Valid | Missing % | Median | MAD | IQR | Outliers retained |',
             '|---|---:|---:|---:|---:|---:|---:|']
    for s in report['profile']:
        lines.append(f"| {s['metric']} | {s['valid_count']} | {s['missing_percentage']:.2f} | {s['median']:.3g} | {s['mad']:.3g} | {s['iqr']:.3g} | {len(s['outliers'])} |")
    lines += ['', f"Missing-data events: {len(report['missingness']['events'])}",
              f"Candidate change points: {len(report['changepoints'])}",
              f"Candidate associations: {len(report['candidates'])}", '',
              '## Limitations', '', *['- '+w for w in report['warnings']], '',
              'Full statistics, baselines, context distributions, trends, lag results, missingness events and subject validation are in the adjacent JSON.', '', '## Plots', '']
    lines += [f'[{name}]({dataset}_plots/{name})' for name in report['plots']]
    (directory/f'{dataset}.md').write_text('\n'.join(lines)+'\n')
    # Dataset-specific storage prevents another run from erasing earlier candidates.
    pdirectory = root/'reports/patterns'; pdirectory.mkdir(parents=True, exist_ok=True)
    (pdirectory/f'{dataset}.yaml').write_text(yaml.safe_dump(clean(report['candidates']), sort_keys=False))
    all_candidates = []
    for path in sorted(pdirectory.glob('*.yaml')):
        if path.name != 'candidates.yaml':
            all_candidates.extend(yaml.safe_load(path.read_text()) or [])
    (pdirectory/'candidates.yaml').write_text(yaml.safe_dump(all_candidates, sort_keys=False))
    rows = ['# Candidate patterns — HUMAN REVIEW REQUIRED', '', '| ID | Dataset | Metrics | Method / lag | Median subject rho | Stability |', '|---|---|---|---|---:|---|']
    for c in all_candidates:
        rows.append(f"| {c['id']} | {c['dataset']['id']} | {' / '.join(c['metrics'])} | {c['relationship']['method']} / {c['relationship']['lag']} | {c['stability']['median_subject_effect']:.3g} | {c['confidence']} |")
    rows += ['', 'Correlation is not causation. Stability labels are engineering heuristics, not medical confidence. See YAML for provenance and warnings.']
    (pdirectory/'candidates.md').write_text('\n'.join(rows)+'\n')
