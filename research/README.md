# Health pattern mining research workspace

Phase 1 software for profiling heterogeneous longitudinal datasets and producing **candidate relationships for human review**. This workspace is independent of any production frontend, backend or reasoning engine. It uses deterministic statistics, not ML, neural networks or LLM calls. It does not diagnose, choose health states, prescribe actions, generate medical thresholds or automatically turn findings into rules.

**The bundled fixture is SYNTHETIC TEST DATA — NOT NASA DATA.** No NASA dataset has been downloaded or validated in this implementation. Every relationship in the example is invented to exercise software behavior.

## Pipeline

```text
RAW DATA
    ↓
NORMALIZATION
    ↓
DATA QUALITY
    ↓
PERSONAL BASELINE
    ↓
DERIVED FEATURES
    ↓
TREND / CORRELATION / LAG ANALYSIS
    ↓
CROSS-SUBJECT VALIDATION
    ↓
CANDIDATE PATTERNS
    ↓
HUMAN REVIEW
    ↓
DETERMINISTIC RULES  [future manual work; OUT OF SCOPE]
```

## Install and run

Python 3.11 or newer; create a dedicated environment:

```bash
cd /home/elmahdi/research
python -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m src.cli normalize synthetic_mission
.venv/bin/python -m src.cli profile synthetic_mission
.venv/bin/python -m src.cli analyze synthetic_mission
.venv/bin/python -m src.cli patterns synthetic_mission
.venv/bin/python -m src.cli report synthetic_mission
.venv/bin/python -m pytest tests -q
```

`analyze`, `patterns` and `report` run the same complete pipeline, ensuring reports are consistent. `normalize` only normalizes; `profile` produces a descriptive JSON profile. Use dataset IDs from `config/datasets.yaml`; this avoids guessing source units or provenance from filenames. `--config /path/to/datasets.yaml` loads another registry; dataset paths remain relative to the research workspace. Unknown formats, units, metrics, duplicate observation keys, invalid numbers, missing timestamps and missing provenance/source fail explicitly.

Context examples:

```bash
.venv/bin/python -m src.cli analyze synthetic_mission --filter activity=rest
.venv/bin/python -m src.cli analyze synthetic_mission --filter mission_phase=inflight
```

Filters apply before baseline fitting. An inflight-only filter will intentionally have missing preflight baselines. Filtered analysis replaces reports for that ID; register separate dataset IDs to retain parallel analyses. Every report records the filters. Default reports also compare distributions grouped by mission phase and activity without filtering.

Dependencies: pandas (tables/time windows), numpy (numerics), scipy (Spearman), matplotlib (headless PNGs), PyYAML (configuration), Pydantic (contracts), ruptures (PELT change points), pytest (tests). No statsmodels dependency is needed for the implemented methods. Requirements set compatible version ranges; reports record actual installed versions. This is not a locked reproducible environment until an installation has been tested and pinned.

## Structure and contracts

```text
research/
├── README.md
├── VALIDATION.md
├── requirements.txt
├── config/{metrics,datasets}.yaml
├── data/{raw,normalized,derived}/
├── src/
│   ├── models.py
│   ├── ingest.py
│   ├── normalize.py
│   ├── profiling.py
│   ├── baselines.py
│   ├── features.py
│   ├── missingness.py
│   ├── correlations.py
│   ├── lag_analysis.py
│   ├── trends.py
│   ├── changepoints.py
│   ├── pattern_candidates.py
│   ├── report.py
│   └── cli.py
├── tests/test_pipeline.py
├── reports/{datasets,patterns}/
└── examples/{generate_synthetic.py,synthetic_mission.csv}
```

The adapter boundary isolates source-specific parsing from the analysis. Normalized observations use `subject_id`, UTC `timestamp`, `metric`, nullable numeric `value`, `unit`, `source`, `dataset_id`, `provenance`, optional `mission_phase`, `quality` and freeform `metadata`. Naive timestamps are interpreted as UTC; adapters must localize other timezones before normalization. Subject identifiers are strings. Quality flags are retained but do not automatically exclude records. Extra wide-format columns become metadata, supporting contextual grouping and filtering.

The current analysis handles continuous, discrete and numerically encoded ordinal measurements. Non-numeric categorical values belong in context metadata; categorical metric analysis is not implemented. Ordinal scores from different instruments are **not** interchangeable simply because both have unit `score`; use distinct metric names and document instrument definitions.

Raw files are copied byte-for-byte into content-addressed archives under `data/raw/`. Existing archives are never overwritten; their SHA256 is checked before analysis. The input file is never modified. Normalized and derived JSON are regenerable. Non-finite results are exported as JSON null, not invalid NaN tokens. Dataset reports include checksum, source/provenance, resolved configuration, metric configuration and library versions. Embedded analysis sections inherit that report-level lineage. Feature exports have a lineage envelope and row-level input provenance; their provenance is DERIVED. Missingness events also carry row-level lineage. Pattern IDs are deterministic hashes of dataset, metrics and lag method.

Supported provenance labels: REAL_HISTORICAL, LIVE_MEASURED, SYNTHETIC and DERIVED. Synthetic status remains visible in reports and candidate warnings even though derived features have DERIVED provenance. This pipeline does not verify that externally declared provenance is truthful; review source documentation before importing real data.

## Add a dataset

CSV accepts wide tables (one column per metric) or long observations. JSON accepts arrays of records with the same layouts. Example registry entry:

```yaml
my_dataset:
  path: data/my_dataset.csv
  adapter: generic
  source: published_source_identifier
  provenance: REAL_HISTORICAL
  columns: {participant: subject_id, collected_at: timestamp, pulse: heart_rate}
  metrics: [heart_rate]
  units: {heart_rate: bpm}
  baseline_phase: preflight
  expected_intervals: {heart_rate: 1h}
  contexts: [mission_phase, activity]
  features: {window: 24h, max_gap: 2h, floor: 0.000001, deviation_mad: 2}
  lags: []
```

Only declare REAL_HISTORICAL after checking the source. Unit defaults in the registry assert the source unit; they are not automatic detection or conversion. A long-form `unit` must match `metrics.yaml`. Incompatible units fail instead of being combined. A source with Fahrenheit, alternate concentration units or ambiguous instrument scales needs an explicit conversion in its adapter and conversion metadata.

For a custom loader, subclass `DatasetAdapter` in `src/ingest.py` (or a separate module), implement `load(path)`, optionally override `normalize(frame, config, metrics)`, and register the class in `ADAPTERS`. Return the same canonical DataFrame contract and apply the generic normalization validator. Do not change analysis functions for NASA-specific column names. Resolve multiple instruments reporting the same subject/metric/time explicitly in an adapter; the generic loader refuses to average them silently.

## Statistics and interpretation

- Profiles include row/subject counts, time range, explicit-null percentage, mean, median, sample standard deviation, raw MAD, min/max, percentiles and IQR. Outliers use the descriptive 1.5×IQR fence and remain in every calculation. This is not a health threshold.
- Personal baselines use configured phase rows (default `preflight`). Set `baseline_phase: null` to use all available rows, a retrospective descriptive baseline that uses future observations. Missing baseline periods stay missing; no fallback silently consumes inflight data. Baseline summaries include p05/p25/p75/p95.
- Features include signed and absolute deviations, percentage difference divided by absolute baseline median, and `(value − baseline median)/(1.4826 × MAD)`. Denominators at or below configurable `floor` yield null. Rolling windows use elapsed time, open on the left and closed on the right, with at least two valid values. Sample standard deviation uses ddof=1. Missing values are not filled.
- Rate of change uses actual elapsed days between adjacent records. Rolling slope uses actual elapsed days and at least three valid observations. Persistent deviation measures elapsed time from the first same-direction observation beyond `deviation_mad` robust units. Missing values, direction changes and gaps beyond `max_gap` reset it. These are descriptive observed runs, not proof that a signal stayed elevated between readings. This engineering deviation setting is not a medical threshold.
- Trends require at least eight valid samples spanning seven days, with full-series and both half-series slopes sharing a nonzero sign. Half splits are by valid-observation count. Slopes are in canonical units per day. No clinical interpretation follows from sign alone.
- PELT uses L2 cost on standardized valid observations, configurable penalty and minimum segment length. Missing observations are omitted explicitly without imputation; timestamps on either side of each split are retained. PELT models observation order, not elapsed-time dynamics. Spikes and gaps may create apparent regimes.
- Missingness separates explicit null values, internal gaps and stale tails. Freshness is evaluated at configured `as_of` or dataset end. A gap exceeding 1.5× the configured interval produces evidence. Without an expected interval, longest gap and age are reported but no stale threshold is inferred. Leading gaps begin at the first recorded timestamp for that subject/metric/source; unknown coverage before that time cannot be inferred. Entirely absent streams require an external schedule and are not discovered automatically.
- Ordinary pairs use exact subject/timestamp matches, with pairwise complete cases only. Reports distinguish pooled correlations, correlations between subject means, and individual within-subject Spearman effects. They do not claim that pooled rows are independent.
- Positive temporal lag compares A at `t−lag` to B at `t` using exact matches. Row lag shifts A over each subject's sorted union of A/B timestamps, retaining null rows; it means measurement-grid positions, not days. Neither method uses nearest-neighbor interpolation. Asynchronous datasets may need an explicit, documented adapter alignment policy.

## Candidate selection and validation

A deterministic seed-42 shuffle of sorted subject IDs assigns roughly 70% to discovery, with at least one subject left for validation if possible. All rows from a subject remain together. Candidate selection requires an absolute median discovery subject Spearman effect of at least 0.3. Undefined/constant subject effects are excluded from the median, never set to zero. This cutoff is an engineering search heuristic.

Candidates report pooled statistics, discovery/validation statistics and median effects, each subject effect, same/opposite/zero directions, effect range and evaluable subject count. Validation confirms direction only when its median effect has the same nonzero sign as discovery. For 2–10 subjects, leave-one-subject-out summaries compare the median effect of other subjects against the held-out effect; these are descriptive sensitivity checks on already-selected candidates, not nested unbiased validation.

Exact confidence logic is in `CRITERIA` and `classify()` in `pattern_candidates.py`:

| Class | Requirements |
|---|---|
| INCONCLUSIVE | Fewer than 10 complete pairs, fewer than 2 evaluable subjects, or undefined effect |
| STRONG | At least 100 pairs, 5 evaluable subjects, discovery median absolute effect ≥0.5, ≥80% same-direction subjects, directionally consistent validation |
| MODERATE | At least 30 pairs, 3 evaluable subjects, discovery median absolute effect ≥0.3, ≥67% same-direction subjects, directionally consistent validation |
| WEAK | All remaining selected candidates |

These labels describe **engineering stability only**, including for fabricated test data. Sample counts are complete pairs, not effective independent sample sizes. Consistency includes all evaluable subjects; zero effects count in its denominator. A very small held-out group can satisfy directional confirmation, so a strong label is not proof of generalization. Reports retain the actual validation sizes. No p-value threshold selects candidates. A single subject can produce a candidate but cannot exceed INCONCLUSIVE.

Each candidate has `status: review_required`. Dataset-specific YAML files are aggregated into `reports/patterns/candidates.yaml` and a Markdown index, so running another dataset does not erase earlier candidates. Accepted findings would be manually reviewed and translated into a separate production configuration; production code must not import this research package.

## Outputs and plots

An analysis writes:

- `data/normalized/<id>.json`: canonical observations.
- `data/derived/<id>_features.json`: derived observations with lineage.
- `reports/datasets/<id>.json`: complete machine-readable evidence.
- `reports/datasets/<id>.md`: summary and plot links.
- `reports/datasets/<id>_plots/`: per-subject/metric time series with rolling mean, baseline, change markers, deviation and missingness panels; candidate ordinary/lagged scatters colored by subject.
- `reports/patterns/<id>.yaml`, `candidates.yaml` and `candidates.md`: human-review queue.

The generator uses Python's standard library and seed 2026. Six subjects span 42 daily timestamps, with a ten-day baseline, gradual sleep decline, a planted next-day reaction-time association, exercise HR elevations, a resting HR elevation, a sensor spike, missing sleep values, a stale HRV tail, and a step in CO2. Regenerate with `python examples/generate_synthetic.py`. Synthetic generation is reproducible; planted effects have no medical evidentiary value.

## Scientific limitations and references

This is exploratory analysis, not scientific or clinical validation. Serial dependence, repeated observations, shared trends, confounding, nonrandom missingness, measurement error, and multiple searches can all inflate apparent relationships. P-values are unadjusted and explicitly flagged. No causal identification, formal cluster-aware inference, permutation testing, detrending, multiple-testing correction, power analysis or external cohort replication is implemented. Subject splitting reduces person leakage but cannot remove shared mission confounding. Real-data adapters and unit/instrument validation need dataset-specific work.

SciPy documents Spearman and notes limitations of its asymptotic p-value at smaller sample sizes: https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.spearmanr.html

PELT implementation and parameters: https://centre-borelli.github.io/ruptures-docs/user-guide/detection/pelt/

See `VALIDATION.md` for the actual execution status; a written test suite is not evidence that tests passed.

## Environmental detectors and offline replay

For instrument observations set `observation_kind: detector` in the dataset registry. Map `instrument_id` to `source` with `columns: {instrument_id: source}`. Generic normalization preserves `spacecraft` and `module` in metadata. Subject IDs and astronaut subject counts are null; instruments are counted separately as detectors. The configured `absorbed_dose_rate` canonical unit is **µGy/h**, with no conversion to equivalent dose or µSv/h.

Detector `profile`/`analyze` uses the existing raw archive, normalization and report path, then runs detector-specific summaries instead of personal baselines or subject validation. Profiles are grouped by source and metric. Median intervals and longest gaps use consecutive recorded timestamps, include both endpoints of every tied longest gap, and never infer a gap cause. `reference_table` is a mapping from source name to `row_count`, `median_interval_seconds` and `longest_gap_seconds`; without it verification explicitly reports `not_verified`. Count comparisons are exact; interval tolerance is one microsecond.

Configure `replay_clocks` as a list of dated, timezone-aware timestamps and `stale_after: 5min`. This is a **demo setting only**. Replay sees only nonmissing readings at or before each clock. Age exactly 300 seconds is current; age greater than 300 seconds is stale. A new valid reading restores current state. Audit snapshots retain open/closed gaps under stable IDs, with start/end timestamps, recovery time and `cause: unknown`; recovery never erases the gap. Before any valid reading, state is unknown. Replay currently accepts a single metric and treats its timestamps as event/availability times; it does not simulate delayed delivery.

Tests use fabricated DosTel-named streams with SYNTHETIC provenance to verify the requested 23:20 stale/current split and 23:30 recovery. Those tests do not establish historical row counts or historical event times. The actual DosTel file, reference table and replay date/timezone must be supplied before a REAL_HISTORICAL run can be verified.
