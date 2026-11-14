# Validation status

## Completed checks

- Generated the synthetic CSV using its deterministic standard-library generator.
- Compiled all source, test and generator Python modules with `compileall` successfully.
- Inspected local package caches and installed environments for required dependencies.

## Execution completed

Dependencies were installed from `requirements.txt` into `.venv`. The full validation sequence now runs successfully.

- Test command: `.venv/bin/python -m pytest tests -q` → `15 passed`.
- Analysis command: `.venv/bin/python -m src.cli analyze synthetic_mission` → 1512 rows, 6 subjects, 9 candidates.
- Generated outputs: `data/normalized/synthetic_mission.json`, `data/derived/synthetic_mission_features.json`, `reports/datasets/synthetic_mission.json`, `reports/datasets/synthetic_mission.md`, per-subject/metric plots under `reports/datasets/synthetic_mission_plots/`, and `reports/patterns/synthetic_mission.yaml` / `candidates.yaml` / `candidates.md`.
- No runtime failures were observed during normalization, profiling, analysis, pattern generation or report export. `normalize`, `profile`, filtered analysis and JSON/CSV input paths were also exercised.

The implementation is verified for the synthetic fixture. This remains synthetic test data, not NASA data, and candidate relationships still require human review.

## Independent verification after dependency installation

Re-ran the suite: **15 passed in 7.95 seconds**. Re-ran the full synthetic analysis successfully: **1,512 normalized observations, 6 subjects, 9 candidates and 45 PNG plots**.

Verified that the current input and raw archive SHA256 both match the report; every candidate retains SYNTHETIC provenance and review_required status; discovery and validation subject sets are disjoint; all reported plot files exist. Visually inspected the S01 heart-rate plot, including its baseline, rolling mean, deviation and missingness panels.

The report contains 15 missing-data events and 35 candidate change points. The planted one-day sleep/reaction-time association has 244 complete pairs across six subjects, pooled Spearman rho approximately -0.897, and median within-subject rho approximately -0.980; all six subjects share its direction. These are synthetic fixture results, not medical evidence. STRONG remains an engineering heuristic; nominal p-values are unadjusted for autocorrelation and multiple comparisons.

## Detector support and replay verification

After adding detector profiling and offline replay, the full suite passes: **19 passed in 7.76 seconds**. New tests verify source mapping, preserved spacecraft/module metadata, µGy/h units, null astronaut subject counts, separate detector counts, reference-table match/mismatch reporting, gap endpoint timestamps, and byte-identical raw input/archive retention.

Fabricated SYNTHETIC test streams verify the strict five-minute demo boundary (exactly 300 seconds remains current), the requested DosTel1 stale / DosTel2 current split at 23:20, and DosTel1 recovery at 23:30. Tests verify that future readings cannot affect an earlier replay snapshot and that recovery retains the same gap ID with cause unknown.

**Historical DosTel verification remains pending:** the raw file and reference table were not included or found in the workspace. No REAL_HISTORICAL dataset was fabricated or processed, and no historical row counts, median intervals, longest-gap endpoints or replay date/timezone have been verified. Synthetic test timestamps are not historical evidence.
