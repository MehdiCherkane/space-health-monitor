# Acceptance baseline · November 14, 2026

Reviewed `main` at `9c4a29ecbba0a77564b2d6c792de8d96c5d91ae6`. PR #10
(`f83a260285286dbdaeda9481a84bc1ec2ca33e5f`) and PR #12 are merged.
The fixture SHA-256 is `aad023f94acd1a8805affc3d363ad9cedd334d79b7f23ac636f996e08c52a4cf`.
PR #11 was open at `d99c549bb281aaedc8676c5a8793c1b784067158`, the same
head cited in the rescue audit. It was not supplied as a green candidate.
[Hamza's handoff and candidate request](https://github.com/MehdiCherkane/space-health-monitor/pull/11#issuecomment-6883153721).

| Check / scope | Status | Execution or evidence |
| --- | --- | --- |
| Canonical fixture, local Windows Python 3.14.10 | Pass | `python -m unittest discover -s tests/fixtures -q` → 13 tests, OK. |
| Engine regression, same checkout | Pass | `python -m unittest discover -s tests/engine -q` → 43 tests, OK. Example A and B, seeded B02, B03 variants and B04 engine action behavior. [Direct 09:00 and 09:01 evaluator output](main-9c4a29e-engine-checkpoints.json). |
| Full backend on base + PR10 | Pass | Coordinator’s independent run, 93 tests + 45 subtests. [Pinned review](../plans/rescue/PR10-INDEPENDENT-REVIEW.md). |
| Full backend on old #10 + #11 combination | Fail | Coordinator’s independent run, 19 failed, 85 passed + 45 subtests. Applies to the reviewed combination. [Pinned review](../plans/rescue/PR10-INDEPENDENT-REVIEW.md). |
| Seeded B01/B02 on current main | Blocked | The fixture exists. Fresh run 201, GET state/history 200 at both clocks, mode `fixture-preview`, both states returned 09:00Z and both history counts 0. [Captured probe](main-9c4a29e-preview-probe.json). |
| Full backend rerun in this worktree | Blocked | `python -m pytest --version` → `No module named pytest`. Declared dependency resolution also reported no available pytest distribution. |
| Frontend dependency install | Blocked | `npm --prefix frontend ci --offline` → `ENOTCACHED` for `xmlchars-2.2.0.tgz`. A regular install also resolved to cache-only mode and failed on the same artifact. |
| Frontend production build and browser | Not run | No `frontend/dist` at inspection. Incomplete dependency install blocks a new build. |
| Real archive and replay | Blocked | No tracked pinned CSV on reviewed main. Archive hash and replay evidence are pending from El Mahdi. |
| Disconnected launch and media | Blocked | Release SHA, seeded runtime and historical archive pending. No screenshots or recording captured. |

The new probe POSTed `{"scenario_id":"sleep_vigilance"}` to
`/api/v1/runs` using `TestClient(create_app(scratch_db))`, then requested
`/api/v1/runs/{run_id}/state` and `/observations` using each recorded UTC
clock as `as_of`. It used an isolated SQLite database, removed after capture.

The [original preview probe](crew-api-preview-probe.json) is historical. It was
run on `60898075b5508a9d9e5b46da15e1637aefa67ee2` plus the then-local PR #10
fixture changes. See the [original validation record](crew-fixture-validation.md).
The current probe is a separate snapshot. Neither probe exercises the PR #11
runtime, a browser, or a disconnected launch.

Terminal Git fetch failed through the configured proxy. The new worktree was
built from the connected GitHub snapshot with Git object hashes verified
against `origin/main`. The working tree under the previous branch was preserved.
