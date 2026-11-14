# PR10 independent review — current head f83a260

Review date: November 14, 2026. Main base `60898075b5508a9d9e5b46da15e1637aefa67ee2`;
PR10 head `f83a260285286dbdaeda9481a84bc1ec2ca33e5f`.

**Recommendation: merge PR10 first. No blocking defect found in its changes.**
PR10 and PR11 were not merged by this review.

## Executed verification

On an isolated source checkout of pinned main plus only PR10's changed files:

- `python3 -m unittest discover -s tests/fixtures -v`: **13 passed**.
- `python3 -m unittest discover -s tests/engine -q`: **43 passed**.
- `/home/elmahdi/space-health-monitor/.venv/bin/python -m pytest tests -q`:
  **93 passed, 45 subtests passed in 1.20 s**.

This fresh full backend pass supersedes the earlier audit's inability to execute
TestClient in the then-restricted environment. No fresh frontend build or actual
offline-browser acceptance is claimed by this review.

## Reviewed behavior

- Exactly 14 canonical observations, correct five-field D2 envelope and stable IDs.
- All records explicitly SYNTHETIC, correct subject/source/metric/unit/timestamps.
- Reaction metadata follows D3 and does not claim actual trials were performed.
- Five-night sleep median 450 min, five-test reaction median 250 ms.
- Exact Example B at 09:00, future sample excluded; watch at 09:01 with 310 ms (+24%).
- Meaningful 270 ms, missing-slot, missing-baseline and incomparable-result variants.
- Inclusive cutoff checks, resource-disabled behavior, repeat/order/rewind and no mutation.
- Scope confined to fixture/tests/evidence/acceptance/demo documentation.
- Documentation separates fixture/engine passes from pending API/browser/offline checks.

No SQL/API/runtime code is changed by PR10. It supplies data which current main does
not auto-load yet. The fixture itself does not introduce the integration failures below.

## Medium-priority integration finding — belongs to PR11 follow-up

On the isolated combined main + PR10 + PR11 candidate:

`python -m pytest tests -q`: **19 failed, 85 passed, 45 subtests passed in 1.37 s**.

Eighteen failures result from new default auto-seeding conflicting with old empty-run
test expectations. Examples:

- `tests/api/test_runs_persistence.py:42`: 15 history rows instead of 1 (14 seeds + submit).
- `tests/api/test_stub_endpoints.py:66`: seeded requested 09:30 response instead of fixed
  preview at 09:00.
- `tests/api/test_validation.py:48`: rejected submission leaves the existing 14 seeds,
  while the test incorrectly expects an empty history.

The remaining failure is `tests/e2e/test_e2e.py:164`: no frontend/dist exists in the
clean combined source checkout, but the test requires its asset scan to say X01 Pass.
Hamza must isolate empty-run tests and correct the harness's asset/offline gates before
PR11 is accepted. Do not remove seed loading or change the correct fixture to make
empty-run tests pass. Keep real canonical integration tests alongside isolated unit tests.

## Nonblocking notes and limits

- Acceptance/pitch/probe files intentionally describe pre-loader status. Refresh them
  after integrated checks run; old probes should remain labeled with their reviewed SHA.
- Fixture test success is engineering validation of declared synthetic inputs. It does
  not establish clinical validity, historical RadLab correctness or offline browser use.
- PR10's carried-forward scientific source review was not revalidated against the
  external papers during this code review; final pitch source verification remains assigned.
- GitHub returned empty lists for PR10 reviews, inline review comments and issue comments,
  and no check runs. The reported Copilot “medium risk” explanation was not visible through
  those endpoints. This review neither attributes nor dismisses an unseen explanation.

If the PR head changes, inspect the new diff and rerun appropriate checks before merge.
