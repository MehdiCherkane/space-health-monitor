# Agent 1 — El Mahdi: historical data, replay proof and release coordination

## Mission and starting point

Read `00-START-HERE.md`, `STATUS-AND-PR-REVIEW.md`, `contracts/v1.md`, the policy,
PR10's fixture/tests, PR11's importer and its mocked replay test. Your deliverable is
a verified historical replay and a trustworthy final merged candidate. The engine is
already implemented: fix only demonstrated defects. Budget 2–4 focused hours plus
coordination; data acquisition time is uncertain.

Use `finish/archive-release` from current main. Read the common workspace rules.
You are not alone: preserve other owners' work and use an isolated checkout.

## Exclusive writes and boundaries

Own `fixtures/radlab/`, `backend/replay/importer.py`, `tests/replay/test_importer.py`,
`tests/replay/test_radlab_run.py`, `backend/engine/`, `tests/engine/`, `rules/`,
`contracts/` and release records under `release/`. Only this session merges PRs.
Hamza owns `backend/replay/__init__.py`, loader, API/storage, launcher and E2E harness.
Send him required import/signature changes before editing his files. Keep importer
function names already used by #11 stable unless a concrete defect requires otherwise.

## Ordered work packets

### EM-R1 — first 20 minutes: establish the candidate and archive decision

1. Pin main and open PR heads; compare against this audit. Review #10 fixture changes.
2. Run `python -m unittest discover -s tests/fixtures -v` and engine checks on #10.
   Merge #10 when green and scope clean; publish resulting main SHA to all sessions.
   Do not merge #11 just because its description says X01 Pass.
3. Locate the original `iss-radlab-dostel-2022-04-01.csv` from the plan's supplied
   library/source. Inspect workspace/team-provided artifacts before requesting data.
4. Compute SHA-256 of exact raw bytes. Required hash:
   `be73563615dbbd28b0b8548a0b9ba40c2059f3dc68ef8941203eb350dcc9e9fb`.
   Record found/missing/mismatch with path and actual hash. Never edit CSV bytes to
   imitate a match or label a synthetic stream historical.
5. If unavailable after 20 minutes, report the precise access/data blocker and continue
   code review/crew integration. Request the exact artifact from El Mahdi; do not burn
   the other agents' working time. A re-export with a different hash requires an explicit
   contract decision, source/provenance note and recalculated checkpoints before use.

### EM-R2 — validate actual archive/importer

1. Inspect the actual CSV header and timestamp/value formats. Remove speculative alias
   handling only when the supported format is established. Make required columns explicit.
2. Preserve source timestamp string, module and spacecraft; normalize times according to
   the UTC convention. Reject impossible times and unsupported fractional precision;
   do not silently truncate distinct readings into one timestamp.
3. Require configured detector IDs, finite nonnegative dose, correct metric/unit,
   null subject and stable D1 IDs. Reject duplicates source/metric/time; report malformed
   rows with location rather than silently skipping required measurements.
4. Verify 84 DosTel1 and 96 DosTel2 records, range selection and no unexpected sources.
   Document whether counts refer to original snapshot versus selected replay range.
5. Store unchanged bytes plus a small provenance/readme report in `fixtures/radlab/`.
   Add negative tests for mismatch, bad/missing header, duplicate, nonfinite/negative
   dose and invalid time. Synthetic fixtures remain labeled test mechanics.

### EM-R3 — real A01–A04 proof

Against the actual verifier/importer and integrated API (after Hamza's fixes), without
monkeypatching the checksum/verifier:

- A01: hash match, 84/96 rows, null subject, metadata/raw timestamps retained.
- A02: both current at 23:12:25; DosTel1 age 300 current at 23:17:25, 301 stale at 23:17:26.
- A03: at 23:20:00 ages 455 and 0; one open DosTel1 incident; referenced readings resolve.
- A04: at 23:30 both current; same incident resolved once. Closure time is the first
  valid later observation from the file, not assumed to be exactly 23:30. Rewind to
  23:20 returns open/null closure and excludes future observations. Repeat read does
  not mutate DB or multiply incidents.

Keep deterministic synthetic unit tests and separately named historical integration
checks. Missing archive means historical checks Blocked, never silently replaced.
Give Hamza the actual archive report and checkpoints for his E2E harness.

### EM-R4 — merge and release gate

1. Review Hamza's amended #11 on top of #10, especially isolated legacy tests, actual
   fixture loading, honest results and build failures. Merge focused green candidate.
2. Review Amine/Mohsine/Nassim fixes by owned paths, regression proof and runtime contract.
   Fadoua's independent acceptance record must refer to the resulting merged SHA.
3. Execute the common test/build commands on that exact candidate. If the available
   environment stalls, capture versions/trace and get a working agent environment to
   reproduce; do not call the gate green on PR descriptions alone.
4. Run both scenario walkthroughs with Hamza. Protect time for Nassim/Fadoua's real
   offline rehearsal and recording. Freeze features when the first acceptable candidate
   is ready; accept only demonstrated release-blocker fixes afterward.
5. Record final SHA, outstanding limitations, complete test evidence, launch command,
   recording location and submission location in `release/final-status.md`.
   If a blocker remains, explicitly approve the reduced claim/scope with the user.

## Verification and handoff

Use `python -m pytest tests/engine tests/replay -q`, the corrected real E2E command,
`python run.py --check-archive` and the production browser checks. Run full suite/build
at the final integration gate, not after every documentation tweak.

Deliver archive SHA/count/provenance report first; focused importer PR second; final
release packet last. Send all six sessions the new shared SHA after each merge gate.
Done means actual historical replay proven and final candidate approved; if data stays
missing, report that dependency as Blocked and finish all independent release work.
