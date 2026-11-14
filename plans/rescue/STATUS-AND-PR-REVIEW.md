# Readiness and open PR review

**Follow-up verification:** The environment restrictions have since changed and the
full backend runs now execute. Main + PR10: **93 passed, 45 subtests passed**.
Combined main + PR10 + PR11: **19 failed, 85 passed, 45 subtests passed**.
See [the independent review](PR10-INDEPENDENT-REVIEW.md) for commands and diagnosis;
the earlier environment limitation recorded below is historical, not the current result.

Pinned main: `60898075b5508a9d9e5b46da15e1637aefa67ee2` (131 tracked files).
The source checkout was downloaded through the connected GitHub app and all files
verified against their Git blob hashes; the reconstructed Git tree matches upstream.
Terminal GitHub DNS is unavailable. Local latest checkout:
`/home/elmahdi/space-health-audit-20261114/main`.
PR-only changed files and combined candidate are in sibling `pr10`, `pr11`, `combined`.
The older `/home/elmahdi/space-health-monitor` checkout was preserved.

## What is ready

| Area | Actual state |
|---|---|
| Engine/policy/contract | Merged, 43 engine checks independently pass; both canonical states reproduce |
| Dashboard | Merged via #9: cards, named checkpoint controls, Why, source history, incidents, reset |
| UI kit and gallery | Merged via #9: tokens, badges, drawer, responsive presentation and 12 example states |
| Check-in/reaction | Merged via #5 and #9: sample form, retry, reaction logic, App mounting/action routing |
| API/persistence/shell | Merged via #4/#6/#9: SQLite runs, atomic/idempotent submissions, state/history endpoints, replay clock and response suppression |
| Canonical crew fixture | Ready in open #10; absent from audited main |
| Crew auto-seeding/import/launch | Present in open #11; needs integration corrections |
| Actual RadLab CSV | Absent from main and both open PRs; no matching file found in this workspace |
| Final offline acceptance/recording/submission | No evidence of a completed final production-build run in the reviewed PRs |

The architecture and most feature code exist. The remaining work is seed integration,
historical data verification, bounded defects, honest test gates and submission evidence.
Do not estimate readiness by counting old unchecked build tasks.

## PR #10 — recommend merge first after checking current head

Head `f83a260285286dbdaeda9481a84bc1ec2ca33e5f`.
Adds the 14-row D2/D3 fixture, 13 fixture tests and evidence/acceptance material.
Independent review found no blocking fixture/code defect. Fixture uses correct IDs,
units, baseline values, synthetic metadata and expected variants.

Executed on the main + #10 source overlay:

- `python3 -m unittest discover -s tests/fixtures -v`: 13 Pass.
- `python3 -m unittest discover -s tests/engine -q`: 43 Pass.
- Combined #10/#11 `pytest tests/engine tests/fixtures -q`: 56 tests Pass, 45 subtests Pass.

Its old “loader missing” API probe is honest historical evidence. After integration,
append a new probe and update current statuses rather than treating the old one as
current. Source citations still need the final claim audit. No final browser/offline
pass is established by this PR.

## PR #11 — amend, then validate with #10 before merge

Head `d99c549bb281aaedc8676c5a8793c1b784067158`.
The runtime integration is useful; its PR description overstates X01 readiness.
The following findings were checked against actual source, not inferred from the PR title.

| Priority | File/location | Finding | Required correction |
|---|---|---|---|
| P0 | `tests/api/conftest.py:10`; older persistence/validation/preview tests | Default `create_app` now auto-loads #10's fixture, but existing tests expect empty histories/preview. Source assumptions conflict when PRs combine | Explicit absent seed paths for empty-run tests; separate canonical seeded tests; run whole combined suite |
| P0 | `tests/e2e/test_e2e.py:43–54,168` | Index HTML URL scan is called X01 Pass and required by pytest | Rename as asset preflight; X01 stays Not run until actual offline browser acceptance |
| P0 | `tests/e2e/test_e2e.py:146–153` | A02–A04 reported Pass whenever archive verification passes, without checkpoint assertions | Real archive path must assert all clocks, ages, incidents, recovery and rewind |
| P0 | `run.py:57–58` | Failed build result ignored; server can launch stale/missing frontend | Requested/required build failure exits nonzero; missing index never advertised as ready |
| P1 | `backend/replay/loader.py:44–76` | Accepts wrong subject/provenance/metric/unit/time/value and defaults absent subject | Validate envelope/observations against D2 and metric rules; malformed present file fails explicitly |
| P1 | `backend/api/main.py:239–251` | Run inserted before seed validation; create response always says integrated | Validate first or transactionally create+seed; truthful creation mode or omit mode there |
| P1 | `backend/storage/store.py` seed method | `INSERT OR IGNORE` can conceal bad duplicate seed IDs | Explicit duplicate rejection/rollback and tested run isolation |
| P1 | `backend/replay/importer.py` | Guessed header aliases, skipped incomplete rows, truncated fractional timestamps, no finite/nonnegative dose check | Inspect real file/header; reject malformed data explicitly; preserve raw timestamp; no fabricated provenance |

Loader validation weakness was reproduced with standard-library Python: a single row
with `REAL_HISTORICAL`, string value, unit `fish`, timestamp `garbage` and source `nobody`
was accepted and assigned a default subject. Production seed validation must catch it.
Canonical completeness checks belong to the shipped fixture; test-only missing-data
variants must remain possible through an explicit test seam.

## Frontend defect and gaps

- `CrewCheckIn.tsx:192–200` renders a completed result and passes unconditional
  `onRunAgain={startReaction}`. `ReactionResultPanel.tsx:53–59` only disables restart
  for pending/failed submission. Changed unavailable/absent action props can be bypassed
  by “Run reaction check again.” Mohsine fixes current-action gating and adds DOM tests.
- No dashboard-specific test file is committed. Existing App tests cover shell lifecycle
  cases well; Amine adds bounded evidence/incident dashboard regression tests.
- Check-in component DOM tests cited in its README lived in an external temporary
  harness. Mohsine ports the essential cases into the shared Vitest runner.
- jsdom drawer stubs do not prove native focus containment. Nassim verifies in a browser.

## What was and was not rerun here

Independent execution: 56 engine+fixture tests and 45 pytest subtests Pass; check-in
Node test files pass. Main API/full combined backend runs stall locally at Starlette
TestClient entering its AnyIO portal; no backend-suite execution Pass is claimed here.
This also happens before any first request on the main snapshot, so it is an environment
limitation to investigate, not evidence that PR11 alone causes the stall.

Fresh `npm ci --offline --ignore-scripts` fails with ENOTCACHED for
`undici-8.12.4.tgz`. Therefore a new locked frontend install/build/Vitest Pass is not
claimed here. #9 reported 33 Vitest + 41 Node, build Pass, backend 80 + 26 subtests and
research 19 Pass; those are author-reported prior results, requiring the final gate.

No current browser offline run was performed during this audit. Localhost serving,
mocked archive tests and an HTML URL regex do not establish X01 or actual NASA replay.

## Remaining effort and risk

Planning estimate: 16–24 aggregate agent-hours, 4–6 elapsed working hours with parallel
sessions and prompt integration, plus archive acquisition uncertainty. This assumes
small focused fixes and working dependency environments. It is an estimate, not a
measured percentage or deadline guarantee.

Highest risk: the actual checksum-matching CSV. Second risk: combining individually
tested branches without updating seed-sensitive tests. Third: recording/claiming a
preview or preflight as a full demo. Address those before spending time on visual polish.

The differentiated demo story is already strong: an offline monitor that exposes when
its evidence is stale or incomplete and lets the audience trace every result through
Why. Show the real transitions clearly, support every claim and rehearse the same build.
