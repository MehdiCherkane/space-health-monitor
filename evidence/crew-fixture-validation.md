# Crew fixture validation - November 14, 2026

Historical PR #10 record for the pre-merge build described below. PR #10 is
merged. The original raw probe is preserved. For the new main check, see the
[acceptance baseline](acceptance-baseline-2026-11-14.md).

Tester: Codex acting for Fadoua. Base: `60898075b5508a9d9e5b46da15e1637aefa67ee2`
(latest `main` retrieved for validation), plus the fixture changes on
`build/crew-fixture`. Python 3.14.10. No engine, policy, contract, API or UI edits.
The GitHub snapshot's blob/tree/commit hashes were verified and `git fsck --full`
passed. CLI Git network access was unavailable; this is a shallow local snapshot.

## Executed checks

Run commands from the repository root. [Full output](crew-fixture-test-output.txt)
records the 13 fixture checks, 43 existing engine checks and available tool versions.
These are engine checks, not browser acceptance or scientific validation.

| Scope | Status | Command/evidence and observed result |
| --- | --- | --- |
| D2/D3 input | Pass | `python -m unittest discover -s tests/fixtures -v`: 13 tests passed, including exact envelope, IDs, values, timestamps, provenance, metadata and unique IDs and source/metric/time tuples |
| B01 engine, 09:00Z | Pass | `test_b01_0900_exact_contract_response_and_no_future_sample`: full result equals Example B, with eight referenced sleep rows, no future reaction, `insufficient_data` |
| B02 engine, 09:01Z | Pass | `test_b02_0901_watch_math_and_traceable_evidence`: `watch`; title **Sleep and vigilance change**; all 14 evidence/source references resolve |
| B03 engine variants | Pass | 270 ms yields `observed`; removing each required night yields `insufficient_data`; changed task/profile retains current reading but blocks comparison |
| Baseline, boundaries, B04 engine | Pass | Missing each of 10 baseline rows, 60/59 min and 20/19.9% boundaries, resource-off fallback and complete result, repeated/reversed/rewound evaluation |
| Existing engine regression | Pass | `python -m unittest discover -s tests/engine -v`: 43 tests; includes exact RadLab Example A. Archive import is outside this proof |
| Fresh API seed path, requested 09:01Z | Blocked | Actual FastAPI TestClient probe returned preview at 09:00Z and zero stored rows; [response](crew-api-preview-probe.json) |
| Full API pytest suite | Blocked | Local `python -m pytest --version` reports `No module named pytest`; dependencies are declared in `backend/requirements.txt` |
| Frontend build/visual rehearsal | Not run | `frontend/node_modules` and `.venv` absent in this checkout; no frontend code changed. Node 26.13.1/npm 11.20.0 present |
| Integrated B01-B04 / X01 | Blocked | HZ-11 seed loader missing; RadLab archive/importer unavailable; no offline browser rehearsal performed |

## Validated values and limits

The [fixture](../fixtures/crew/sleep-vigilance.json), [tests](../tests/fixtures/test_crew_fixture.py),
[D2/D3 contract](../contracts/v1.md), [Example B](../contracts/examples/sleep-vigilance-missing.json)
and [team plan Example B](../plans/space-apps-two-day-team-plan.md) fix the inputs:

- Sleep median of 450/440/450/460/445 is 450 min. Recent 380/370/420 min produce
  deficits 70/80/30 min, exactly two at least 60 min below baseline.
- Reaction median of 245/250/255/248/252 is 250 ms.
  `(310 - 250) / 250 * 100 = 24%`; the engine reports **+24.0%**.
- `reaction-10` becomes eligible at `2026-01-10T09:01:00Z`. Before then, the
  current session result is missing despite the five earlier reaction baseline rows.
- A comparable 270 ms result is +8%, below the configured 20% cutoff. Its complete
  comparison is `observed`, not a claim of health or fitness.

The three-night window, five-row baselines, 60 min and 20% cutoffs come from
`SLEEP_VIGILANCE@1` in [policy](../rules/demo-v1.json). They are prototype settings.
All fixture rows and trial metadata are synthetic declarations, not measured NASA
crew data or performed trials. No causal or medical conclusion is established.

## API blocker reproduced

Using `fastapi.testclient.TestClient(create_app(database_path))` with a new isolated
SQLite database, POST `/api/v1/runs` with `{"scenario_id":"sleep_vigilance"}`,
then GET that run's `/state?as_of=2026-01-10T09:01:00Z` and `/observations` at the
same clock. Observed: create 201, state 200, `X-Data-Mode: fixture-preview`,
`X-Data-Source: contracts/examples`, returned clock `09:00:00Z`, assessment
`insufficient_data`, stored history count 0. Temporary database removed afterward.
An initial OS-temp attempt failed on directory permissions; the successful probe
used a workspace scratch database. No runtime code was changed.

Hamza must load the canonical seeds on new runs and verify visible history and
rewind/reset. El Mahdi should independently run the fixture tests. Amine/Nassim
can then validate the returned evidence on screen; Mohsine owns live capture.
The fixture is ready for these consumers, while integrated acceptance remains blocked.

RadLab A01 is separately blocked: no pinned CSV/importer in this checkout.
`backend/README.md` reports a computed hash beginning `2d1c5d96` versus expected
`be735636`; this is Hamza's recorded report, not a hash measured in this run. The
full observed hash is not published there. Keep gap cause unknown and request the
checksum-matched archive; do not substitute synthetic data under a historical label.

Scientific-source wording remains scoped in [demo-claims.md](demo-claims.md),
including the existing `EVID_SLEEP_003` attribution correction for El Mahdi's review.
External sources were not re-reviewed during this fixture validation.

## Handoff inventory and hygiene

Initial validation was completed before committing. Publication is tracked by the PR.
All 12 changed/new files are inside Fadoua's ownership:

- [Canonical fixture](../fixtures/crew/sleep-vigilance.json) and [loader handoff](../fixtures/crew/README.md).
- [Fixture tests](../tests/fixtures/test_crew_fixture.py) and the test directory's `.gitignore` for Python bytecode.
- [Acceptance checklist](../acceptance/manual-checklist.md).
- [Recording procedure](../demo/recording-checklist.md) and [pitch](../demo/two-minute-pitch.md).
- [Evidence index](README.md), [claim/source table](demo-claims.md), this validation record,
  [test transcript](crew-fixture-test-output.txt), and [API probe result](crew-api-preview-probe.json).

`git diff --check` passed. A separate scan included untracked files and checked
ownership, trailing whitespace, final newlines, JSON parsing and local Markdown
link targets: no issues. Before publication, Git status showed four modified and eight new files.

SHA-256 of the validated bytes (useful when attaching this record to a later build):

| Input | SHA-256 |
| --- | --- |
| Canonical fixture | `aad023f94acd1a8805affc3d363ad9cedd334d79b7f23ac636f996e08c52a4cf` |
| `contracts/v1.md` | `cdc697ea46fab682a7c1c58dd6a6ee394cac0bea6d6d2cbf12db2bdccd8c3807` |
| `rules/demo-v1.json` | `29072eaf097917623258322681358fa174e1861475cbc3398046949d67223901` |
