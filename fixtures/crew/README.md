# Canonical synthetic crew fixture

Owner: Fadoua. Consumer: Hamza (HZ-11 loader); reviewer: El Mahdi.
[sleep-vigilance.json](sleep-vigilance.json) implements [contract D2/D3](../../contracts/v1.md).
It is one input object containing exactly 14 observations, not an API state envelope.
All rows belong to `crew-demo-1` and are `SYNTHETIC`. No trials were performed to
generate these seeds; the reaction metadata describes the declared demo scenario.

| IDs | UTC dates/time | Values | Source / metric / unit |
| --- | --- | --- | --- |
| `base-sleep-1` through `base-sleep-5` | Jan 1-5, 2026, 07:00 | 450, 440, 450, 460, 445 | `crew_sleep_log` / `sleep_duration` / `min` |
| `sleep-08`, `sleep-09`, `sleep-10` | Jan 8-10, 2026, 07:00 | 380, 370, 420 | `crew_sleep_log` / `sleep_duration` / `min` |
| `base-reaction-1` through `base-reaction-5` | Jan 1-5, 2026, 09:00 | 245, 250, 255, 248, 252 | `reaction_task` / `reaction_time` / `ms` |
| `reaction-10` | Jan 10, 2026, 09:01 | 310 | `reaction_task` / `reaction_time` / `ms` |

Each reaction has `task_version: demo-rt-v1`, `input_profile: seeded-demo`,
`trial_count: 5`, `false_starts: 0`, `completed: true`. IDs are stable; join by ID.
Sleep rows are identical to Example B. The five reaction baseline values come from
the team plan, section 3, Example B. Median baselines are 450 min and 250 ms.

Run from the repository root, with Python's standard library and the local engine:

```console
python -m unittest discover -s tests/fixtures -v
python -m unittest discover -s tests/engine -v
```

The tests load this file afresh for every check. Variants are copies or isolated
in-memory edits, never extra rows in the canonical fixture:

| Variant/check | Expected engine result |
| --- | --- |
| Canonical at `2026-01-10T09:00:00Z` | Exact Example B, `insufficient_data`; future sample excluded |
| Canonical at `2026-01-10T09:01:00Z` | `watch`, **Sleep and vigilance change**, +24.0% |
| `reaction-10.value = 270` | `observed`, **Demo pattern not observed**, +8.0%; no missing inputs |
| Remove any one of `sleep-08/09/10` | `insufficient_data`, missing `sleep_duration` |
| Remove any one baseline row | `insufficient_data`, missing corresponding baseline |
| Change current reaction profile or task version | Source `current`, reason `incomparable_reaction_result`; assessment `insufficient_data` |
| Reaction 300 / 299.75 ms | `watch` / `observed` (20% / 19.9%) |
| Both short nights 390 / 391 min | `watch` / `observed` (60 / 59 min below baseline) |
| Resource disabled at 09:00 / 09:01 | Pending with unavailable action and fallback / existing complete `watch` preserved |
| Reverse order, repeat, rewind | Deterministic; input unchanged; no future observation references |

For engine integration, load JSON and pass `fixture["observations"]`, the explicit
scenario/run/UTC clock, resource configuration and `rules/demo-v1.json` to
`backend.engine.evaluate`. Keep the five-field envelope for loader validation.
Reject duplicate IDs and source/metric/timestamp tuples before import.

For API integration, seed each fresh behavioral run with the same immutable 14 rows
while preserving canonical IDs, provenance and metadata. State/history must filter
by `as_of`; do not discard baseline rows merely because they precede the replay range.
Do not send seeds through the check-in POST: its timestamp range excludes baselines,
it creates submission IDs, and reaction submissions are `LIVE_MEASURED`.

PR #10 merged this fixture. The independent review passed before merge and the
fixture and engine suites passed again on reviewed main `9c4a29e`. A fresh-run
probe on that SHA still returned a fixed preview and zero history. Hamza's
seeded candidate remains a separate verification step. Check the expected
values, time, seed history and fresh-run isolation in addition to data mode.
[Independent review](../../plans/rescue/PR10-INDEPENDENT-REVIEW.md) ·
[Acceptance baseline](../../evidence/acceptance-baseline-2026-11-14.md) ·
[Acceptance ledger](../../acceptance/manual-checklist.md).
