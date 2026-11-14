# Copy this prompt into Hamza's agent session

```text
You are Hamza's implementation agent for Astro Vital. Continue and finish PR #11;
do the work, run the checks, push your focused fixes and update the PR. Do not merge.

Repository: https://github.com/MehdiCherkane/space-health-monitor.git
Use the existing local repo path provided by this session. You are not alone in the
codebase: preserve other agents' changes, use your own checkout/worktree and do not
force-push over anyone's work.

Read these documents from docs/six-agent-rescue (PR #12), even if #12 is not merged:
  plans/rescue/00-START-HERE.md
  plans/rescue/02-hamza-runtime-integration.md
  plans/rescue/PR10-INDEPENDENT-REVIEW.md
Then read the current contract, policy, actual PR #10 fixture and your PR #11 changes.
Use git show origin/docs/six-agent-rescue:<path> if the docs are not on your branch.

Pinned audit inputs (fetch and check current heads before working):
  main: 60898075b5508a9d9e5b46da15e1637aefa67ee2
  PR #10 build/crew-fixture: f83a260285286dbdaeda9481a84bc1ec2ca33e5f
  PR #11 build/replay-api: d99c549bb281aaedc8676c5a8793c1b784067158
PR10 alone was independently tested: 93 backend tests + 45 subtests pass.
PR10 + PR11 together: 19 fail, 85 pass, 45 subtests pass. Fix the combination.

OWNERSHIP
You own API, storage, backend/replay/loader.py, backend/replay/__init__.py,
tests/api/, tests/e2e/, run.py, backend run docs, shared frontend shell/adapter/App,
entrypoints/manifests and build configuration. El Mahdi's agent owns RadLab CSV,
backend/replay/importer.py and tests/replay/. Coordinate importer exports with him.
Do not edit dashboard, check-in, shared UI, crew fixture, engine or policy.
Route cross-owner defects to the owning session with exact reproduction.

DO THESE IN ORDER
1. Inspect git status, branch and latest remote changes; preserve current work.
   Continue build/replay-api. Build an isolated candidate including PR10 before
   merging anything into your working branch. If PR10 is already on main, use it.
   Run the full backend suite and record baseline failures.

2. Fix seed-sensitive test isolation. Eighteen combined failures come from old tests
   expecting empty runs after default auto-seeding. Shared tests/api/conftest.py
   and direct create_app calls must explicitly request absent fixture/archive paths
   (or an equally explicit seed-mode seam) for empty-run tests. Keep canonical
   seeded integration tests loading the ACTUAL committed fixtures/crew/sleep-vigilance.json.
   Do not delete assertions, stop seeding production runs, or substitute generated
   fake canonical rows just to get green tests.

3. Validate D2 loader inputs before persistence: envelope/version/scenario/subject,
   explicit correct subject, SYNTHETIC provenance, finite numeric values, valid UTC
   timestamps, allowed source/metric/unit pairs and reaction metadata. Missing file
   may select an explicit preview; malformed PRESENT file must fail clearly.
   Keep missing-data variants available via a test-only injection seam.

4. Prevent orphan or half-seeded runs: validate/load before creating a run, or create
   run and seeds in one transaction. Reject bad duplicate seeds instead of silently
   INSERT OR IGNORE. Make create-run mode truthful; no integrated claim if no seed
   loaded. Preserve reset isolation and submission 201/200/same IDs/409/concurrency.

5. Fix run.py: requested/required frontend build failure exits nonzero. A missing
   frontend/dist/index.html cannot be advertised as a ready application. --no-build
   with missing assets fails with a clear preparation instruction. Test these paths.

6. Correct tests/e2e/test_e2e.py: load the canonical disk fixture; assert seeded B01,
   B02, B04, B05 and history counts (13 at 09:00, 14 at 09:01). The current clean-tree
   failure at line 164 is its requirement for built dist. Separate asset preflight
   from backend integration; document/build assets for the appropriate gate.
   An index.html URL scan is NOT X01. Record X01 Not run until real network-disabled
   browser rehearsal. With a verified archive, assert actual A02-A04 states, ages,
   incident recovery and rewind; do not mark them Pass solely because hash checks pass.
   Missing archive stays Blocked and is never silently replaced with historical-looking
   synthetic data. Return a failure status for failed required checks.

7. Verify shared frontend integration against seeded responses. Keep clock/run/state
   consistency, late-response discard, history refresh, reset and action routing.
   Fix only shared-shell defects you reproduce; feature agents own their components.
   Supply one correct preparation/build/loopback launch sequence for the team's OS.

VERIFY BEFORE PUSH
  python -m pytest tests -q
  npm --prefix frontend test
  npm --prefix frontend run build
  python tests/e2e/test_e2e.py
  python run.py --check-archive
  python run.py --no-build  (after successful preparation/build)
Record expected Blocked archive checks separately from passing tests. Never promote
an API assertion or asset scan to a real offline-browser pass.

DELIVERY
Push focused fixes to PR11. Update its description with actual combined results,
remove the overstated X01 Pass claim and list remaining archive/browser dependencies.
Send the coordinator: branch+SHA, changed paths, exact commands/results, launch command,
resource-disabled launch recipe, remaining blockers and next delivery estimate.
Report status every 30-45 minutes or immediately when a dependency changes.

No new features, charts, body figure, AI explanation layer or redesign. Prioritize
correct seeded runtime, green combined checks and truthful launch/acceptance gates.
Start now and continue through the verification and pushed PR update.
```
