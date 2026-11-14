# Agent 2 — Hamza: amend PR11 and make the combined runtime reliable

## Mission and scope

Continue PR #11 from `build/replay-api`; do not recreate merged API/persistence/shell.
Read the common start file, audit report, PR10 fixture/README, PR11 diff, existing API
tests and frontend App/shell. Pin current heads. Budget 2–4 focused hours.

Own `backend/api/`, `backend/storage/`, `backend/replay/loader.py`,
`backend/replay/__init__.py`, `tests/api/`, `tests/e2e/`, `run.py`, backend run docs,
shared frontend shell/adapter/App/entrypoints/manifests and shared build configuration.
El Mahdi's agent now owns importer/archive and `tests/replay/` implementation. Coordinate
exports in `__init__.py`; don't both edit importer. Feature/UI folders stay with owners.
You are not alone; preserve other agents' work and use your own checkout.

## HZ-R1 — reproduce the combined candidate, not just your branch

1. Update from merged main without losing your PR changes; include #10 on an isolated
   integration checkout if it is not yet merged. Record both source SHAs.
2. Run the entire `python -m pytest tests -q` plus frontend `npm test` / `npm run build`.
   Record actual results. Audit environment could not freshly rerun TestClient because
   it stalled at AnyIO portal entry even on main; do not mistake that for a confirmed
   code failure. Use your known working environment and preserve version information.
3. Explicitly inspect all tests expecting empty runs: shared conftest and direct
   create_app calls in persistence/validation tests. #10 activates default auto-seeding.
   Empty-run tests must pass explicit absent crew/archive paths or a documented explicit
   seed-mode seam; they must not depend on whether fixture files happen to exist.
4. Keep separate canonical integration cases using the actual committed PR10 JSON.
   Stop duplicating the canonical 14 rows in helper functions for final E2E proof.
   Unit-generated variants can remain as mechanics tests, with clear labels.

## HZ-R2 — seed loading, transactions and honest runtime mode

1. Validate D2 envelope keys/version/scenario/subject and Observation shapes before
   inserting a run: synthetic provenance, explicit subject, finite numeric values,
   canonical UTC times, allowed metric/source/unit pairs, valid reaction metadata.
   Present malformed file must fail with useful context. Missing optional file may
   explicitly select preview. Do not catch invalid-present input and show a passing preview.
2. Keep fixture completeness/14 canonical rows checked against the production fixture;
   allow explicit test-only missing-night/incomparable variants to reach the evaluator.
3. Load and validate first, then atomically create run+seed, or use one transaction.
   A seed failure must leave no orphan run or half-seeded state. Replace silent duplicate
   `INSERT OR IGNORE` behavior with rejection/rollback where duplicate seed input is invalid.
4. Creation header must reflect actual seed mode or omit the mode claim at creation;
   an empty run cannot advertise integrated and immediately return a fixed preview.
5. Verify reset creates a new isolated run and reuses read-only seeds. User submissions
   never change canonical fixture files. Keep 201/200/same IDs/409 and concurrent retry.

## HZ-R3 — launcher and truthful E2E harness

1. `run.py --build`: if build fails, exit nonzero before serving any stale bundle.
   Default missing bundle must build successfully or stop. `--no-build` with missing
   index must stop clearly. Test the failure paths by stubbing the build process.
2. Validate/document local host behavior and packaged dependencies/assets. For the
   demo use 127.0.0.1; don't print “offline ready” solely because the host is loopback.
3. Rewrite E2E to load the committed canonical fixture by default. A missing required
   fixture is Blocked/Fail with reason, never replaced by generated canonical rows.
4. Add real B01/B02/B04/B05 API assertions: header integrated, exact requested clock,
   13 history rows at 09:00, 14 at 09:01, baseline/evidence IDs present, resource fallback,
   identical retries, changed payload conflict and reset isolation.
5. With a verified archive, assert actual A02–A04 checkpoints from Agent 1's report.
   No broad “Pass” based on the verifier result alone. Without archive explicitly
   record A01/A02–A04 Blocked while exercising labeled preview behavior separately.
6. Rename index asset URL scan as a preflight; inspect referenced bundles if retaining
   it. X01 remains Not run until real disconnected browser rehearsal evidence exists.
   Return nonzero on failed required assertions; report Blocked explicitly. A CLI
   success exit cannot be the only evidence that the whole demo passed.
7. Remove stale X01 Pass claims in PR11 body and backend/launch instructions.

## HZ-R4 — shared frontend integration only when needed

1. Verify App consumes seeded responses as integrated, requested clock matches state,
   history refreshes after submit, unavailable action routes to evidence, resets
   isolate components, stale requests cannot replace a newer scenario/run.
2. Keep feature changes with Amine/Mohsine/Nassim. If a browser report locates a shell
   bug, reproduce with existing App/replay regression tests and fix narrowly.
3. Supply one exact prepare/build/launch sequence for the team's OS. Install/build
   while network is available, then run from local bundle with network disabled.
   Update README/CONTRIBUTING stale plain-HTML setup through a focused shared-doc fix.

## Gate and handoff

Commands: `python -m pytest tests -q`; `npm --prefix frontend test`;
`npm --prefix frontend run build`; `python tests/e2e/test_e2e.py`;
`python run.py --check-archive`; `python run.py --no-build` after preparation.
If there are legitimate Blocked data checks, enumerate them separately from test pass.

Deliver a small PR11 amendment with combined test output and truthful acceptance table.
Give agents the candidate SHA, launch command, resource-disabled launch recipe using
ASTRO_VITAL_RESOURCES, and working scenario clocks. Release owner reviews/merges.
Done means canonical crew flow works through real persistence and engine, suite remains
green with both PRs, launcher fails correctly and harness does not manufacture Pass.
