# Agent 4 — Mohsine: close reaction availability and component lifecycle gaps

## Mission and ownership

Check-in, retry and reaction logic already exist. Fix the concrete restart bypass and
commit meaningful component verification. Budget 1.5–2.5 hours. Read common start/audit,
contract, `CrewCheckIn.tsx`, `ReactionResultPanel.tsx`, `ReactionTask.tsx`, submission
logic, existing pure Node tests, shared DOM harness and App tests.

Use `finish/checkin-verification` from latest main. Own `frontend/src/checkin/` and
colocated tests only. You are not alone: preserve others' changes. Hamza owns API/shell
types and submits payload unchanged; Nassim owns shared UI. No API/contracts changes.

## MO-R1 — concrete availability defect, first delivery

1. Reproduce completed-result view, then rerender with disabled or absent
   `start_reaction_check`. Current `CrewCheckIn.tsx:192–200` passes unconditional
   `onRunAgain={startReaction}`; the result panel only guards pending/failed submission.
2. Gate starting and restarting against the latest action props at the callback boundary,
   not only a disabled button. Retain the last measured result and its provenance.
3. Show the engine-provided unavailable reason and available review-inputs fallback.
   A completed result retry may still resend the identical already captured payload;
   it must not silently perform a new measurement or create a new submission ID.
4. Decide active-task availability change behavior consistently with “unavailable means
   cannot run”: cancel/clean up active measurement without completed submission, and
   show reason/fallback. A resource re-enabled later permits a fresh instructed task.
5. Add DOM tests for available→unavailable after completion, unavailable→available,
   missing action, stale button/callback attempt, and active-task interruption. Test
   actual component state/props, not just a helper boolean.

## MO-R2 — port essential component lifecycle checks

Existing README cites 13 tests in an external temporary harness; make the important
cases runnable by committed Vitest. Keep existing Node tests green; avoid duplicating
their median/payload unit assertions wholesale.

- Sample form: blank optional fields omitted; zero preserved; invalid values blocked
  before submit; asynchronous 422 shown with editable/retry behavior.
- Pending submit: double click sends one request. Network failure retains exact payload,
  mission timestamp and ID on retry; changed fields create a new ID.
- Task: instructions/practice excluded from measured result; valid completion submits
  once; held-key repeats ignored; false starts excluded from median and counted.
- Cancel, component unmount and navigation clear timers/listeners and submit nothing.
  Empty/interrupted task produces no completed result.
- Reuse shared test utilities/fake timers. App already tests reset/late response isolation;
  add only component cases that fill the documented coverage gap.

## MO-R3 — one actual device check through seeded API

After Hamza publishes combined candidate:

1. Prepare/build, launch, fresh crew run, pause at mission 09:00. The 09:01 seeded sample
   must remain in the future. Confirm UI says reaction missing before measurement.
2. Perform the actual keyboard task. Inspect submitted/returned observation: source
   reaction_task, finite positive ms median, valid trial counts, completed true,
   task_version demo-rt-v1, input_profile browser-keyboard and real captured_at metadata.
3. Server provenance is LIVE_MEASURED; observed_at uses mission time. Capture time belongs
   to actual device time. Why/history shows the real result with its label.
4. Assessment stays insufficient_data because browser-keyboard is incomparable with
   seeded-demo. Do not alter profile or number to force watch. Use seeded 09:01 sample
   separately for the repeatable behavioral story.
5. Test skip/cancel, unavailable fallback, normal submit, failure/retry, reset and scenario
   change on the candidate. Coordinate a network-failure test with Hamza/Nassim if needed.

## Gate and handoff

Run `node --test 'frontend/src/checkin/*.test.mjs'` and the default frontend test command
from the appropriate working directory; run focused Vitest during development and full
build after the fix. Record exact counts from your execution.

Publish focused PR with reproduction→fix→regression result, SHA, callback compatibility,
actual capture evidence and any remaining Blocked integration checks. Supply final
control names to Fadoua. Done means no unavailable task can start/restart and measured
data, retries and cleanup retain the contract through the real seeded application.
