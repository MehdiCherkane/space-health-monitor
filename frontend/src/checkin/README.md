# Crew check-in and local reaction check

Behavioral-demo feature for the `sleep_vigilance` scenario, on branch `build/checkin`.
Owner: Mohsine. Write scope: `frontend/src/checkin/` (tests colocated here).

**Status at this handoff:** the standalone feature is built and verified without the shared
shell. Integrated checks **B01, B04 and B05 are Blocked** until Hamza's shell and API land
(HZ-03/HZ-04/HZ-12/HZ-13). No shared entry point, dependency manifest, lockfile or file
outside this folder was changed.

Base commit: `fd1da9690a5d3b28af5c7353a87114be977a6589` (main after the engine merge).
Contract base: `contracts/v1.md` (kickoff PR #1, `533309242e58985dfa919225b9c2d515c7585872`).

## What it does

- Sample check-in: sleep duration in minutes plus optional sample fatigue, mood and stress
  scores. Blank fields are omitted from the payload; `0` is retained. Invalid input is
  blocked before submit.
- Submit flow: one request at a time, success and retry states, and a retry that reuses the
  original payload, submission id and mission timestamp. Editing the input starts a new
  submission with a new id. Server validation messages (for example `422`) are displayed.
- Short local reaction check: instructions, a practice step, 12 measured trials, a visible
  completion state and Cancel throughout. Early presses are false starts, held-key repeats
  are ignored, and the result is the median of completed valid measured trials.
- Unavailable state: when the engine marks `start_reaction_check` unavailable, the engine's
  reason text is shown with the `review_available_inputs` fallback. Sleep or self-reports
  are never offered as a substitute for the missing reaction result.

Everything the UI shows about availability, labels and reasons comes from props; the
component does not compute statuses and never calls the API itself.

## Export and mounting (for Hamza)

Named export: **`CrewCheckIn`** from `frontend/src/checkin/CrewCheckIn.tsx`, re-exported
from `frontend/src/checkin/index.ts`.

```tsx
import { CrewCheckIn } from "./checkin";

<CrewCheckIn
  runId={runId}
  scenarioId={scenarioId}
  asOf={state.as_of}                 // current mission clock from the shell
  actions={state.actions}            // engine actions (reaction availability + fallback)
  onSubmit={(payload) => submitObservations(runId, payload)}
  onAction={(actionId) => routeAction(actionId)}   // review_available_inputs -> evidence drawer
/>
```

The shell routes `start_reaction_check` to this component (it is mounted here); the
component exposes `review_available_inputs` through `onAction`.

### Props (local stub — Hamza's HZ-03 types are not published yet)

| Prop | Type | Meaning |
|---|---|---|
| `runId` | `string` | Opaque run id; the shell's submit callback scopes the request to it. |
| `scenarioId` | `string` | Contract scenario id. Only `sleep_vigilance` renders the form. |
| `asOf` | `string` | Current mission clock, UTC ISO whole-second; used as `observed_at`. |
| `actions` | `CheckInAction[] \| undefined` | Engine actions. The component reads `start_reaction_check` and `review_available_inputs`; missing `actions` means no reaction check is offered. |
| `onSubmit` | `(payload) => Promise<void>` | Wired by Hamza to `POST /api/v1/runs/{run_id}/observations`. Resolve on 200/201; reject with an `Error` whose message is safe to display (server `422` text passes through). |
| `onAction` | `(actionId: string) => void` *(optional)* | Shell-owned action routing (evidence drawer for `review_available_inputs`). |

These names and the rejection contract are a **local, labeled stub**; replace them when the
shell publishes its types. Report any difference to Hamza.

## Payloads (contract shapes)

Sample check-in — `observed_at` is the mission clock prop; the server adds ids, subject and
provenance, so the client never sends `provenance` or `subject`:

```json
{
  "submission_id": "<opaque unique string>",
  "observed_at": "2026-01-10T09:00:00Z",
  "entries": [
    {"source_id": "crew_sleep_log", "metric": "sleep_duration", "value": 420, "unit": "min"},
    {"source_id": "crew_self_report", "metric": "fatigue", "value": 0, "unit": "score_0_10"}
  ]
}
```

Reaction result — live browser capture time goes in `metadata.captured_at` (contract D4),
mission time in `observed_at`:

```json
{
  "submission_id": "<opaque unique string>",
  "observed_at": "2026-01-10T09:00:00Z",
  "entries": [
    {
      "source_id": "reaction_task",
      "metric": "reaction_time",
      "value": 312,
      "unit": "ms",
      "metadata": {
        "task_version": "demo-rt-v1",
        "input_profile": "browser-keyboard",
        "trial_count": 12,
        "false_starts": 0,
        "completed": true,
        "captured_at": "2026-01-10T09:00:31.250Z"
      }
    }
  ]
}
```

## Form and validation rules (from `contracts/v1.md`)

- `crew_sleep_log` / `sleep_duration` / `min`: blank allowed; otherwise a finite number
  0–1440.
- `crew_self_report` / `fatigue`, `mood`, `stress` / `score_0_10`: blank allowed;
  otherwise an integer 0–10. Blank is omitted; `0` is sent.
- At least one value is required to submit (an empty entries array is not sent).
- Submit is disabled while input is invalid or a request is in flight.
- After a failure, **Retry submission** reuses the original payload, mission timestamp and
  submission id. Changing any input resets the pending submission, so the next send gets a
  new id.
- After a successful submit, the form stays disabled until the input is edited (that starts
  a new check-in).

## Reaction task behaviour

- Instructions → practice (3 trials, never submitted) → measured (12 trials) → completion.
  With 1.5–3 s waits the run takes roughly 40–60 seconds; the plan fixes no trial count, so
  this setting is recorded here for the PR and is a prototype choice, not a clinical cutoff.
- Single response key: space bar. A press before the green prompt is a **false start**
  (counted, not a valid trial); held-key repeats are ignored.
- Timing uses the caller-injected monotonic clock, which defaults to `performance.now()`.
- Result = median of completed valid measured trials, rounded to whole milliseconds, plus
  `trial_count` and `false_starts`. An empty valid-trial set produces no result.
- Cancel at any point (or unmounting/navigating away) clears timers and listeners and
  submits nothing. An interrupted task creates no completed result.
- A live `browser-keyboard` result is visible in history but is **not comparable** with the
  seeded `seeded-demo` baseline; the engine reports that as insufficient data. The
  component does not decide comparability.

## Control names and labels (for Fadoua's click paths, D11)

| Area | Visible text |
|---|---|
| Section heading | **Crew check-in** |
| Mission clock | **Mission time** `<asOf>` |
| Sleep field | **Sleep duration (minutes)**; hint **Sample entry — stored as synthetic.** |
| Self-reports | legend **Sample entry (synthetic) — optional self-reports**; **Fatigue (0–10, optional)**, **Mood (0–10, optional)**, **Stress (0–10, optional)** |
| Submit | **Submit check-in** |
| Failure | server/error message + **Retry submission** |
| Success | **Check-in submitted. Edit a field to start a new check-in.** |
| Reaction entry | engine action label: **Run reaction check** |
| Reaction unavailable | engine reason text: **Reaction check unavailable**; fallback action label: **Review available inputs** |
| Reaction instructions | **Local reaction check**; **Start practice**; **Cancel reaction check** |
| Practice done | **Practice complete**; **Start measured trials** |
| Trials | **Practice trial N of 3**, **Measured trial N of 12**, **Wait for the green prompt…**, **Press the space bar now!**, **False start — wait for the green prompt.** |
| Result | **Reaction check complete**, **Recorded on this device**, **Median response time**, **Valid trials**, **False starts**; **Submit reaction result**; **Run reaction check again** |
| Reaction success | **Reaction result submitted.** |

## Fixture preview harness

`preview/FixturePreview.tsx` mounts the real component with **labeled fake** data:
fixture-preview props, engine-shaped actions for available/unavailable reaction resource, and
a fake submit callback that resolves, rejects (displayable message) or resolves after 1.5 s.
It shows a **Fixture preview — fake callback, synthetic sample entries, not an integrated
run** badge and a callback log. It is dev-only; the app shell should not import it.

It needs Hamza's shell/Vite toolchain to run. Once that exists, mount it as the shell's dev
preview route. (The feature was also type-checked, built and DOM-tested with a temporary
toolchain outside the repository; see below.)

## Verification

### Committed, dependency-free tests (run today)

From `frontend/src/checkin/`:

```bash
node --test
```

Result: **Pass — 39 tests** on Node v24.21.0 (Node's built-in runner with TypeScript type
stripping; the repo has no frontend toolchain yet — D10, owned by Hamza). No dependencies
were added and no manifests changed. Coverage:

- `validation.test.mjs` — blanks, sleep range, 0–10 integers, messages, zero kept, snapshots.
- `payload.test.mjs` — blanks omitted, zero kept, source/metric/unit ids, exactly
  `submission_id`/`observed_at`/`entries`, no provenance/subject, reaction metadata.
- `submission.test.mjs` — in-flight duplicate ignored, retry reuses id/payload/mission
  timestamp, changed input gets a new id, rejection message kept, id uniqueness/format.
- `reactionMachine.test.mjs` — median odd/even/invalid, practice excluded, 3 practice
  trials, false starts, held-key repeats, duplicate stimulus, 12-trial completion,
  empty/invalid timing, cancel produces no result.
- `viewModel.test.mjs` — action lookup, unavailable reason passed through exactly, fallback
  action, missing actions, scenario scope.

### Local type/build/behaviour verification (temporary toolchain outside the repo)

Because the shared frontend toolchain does not exist in this checkout, the feature was
additionally verified with a temporary Vite/Vitest project under the OS temp folder that
imported this folder and aliased `react`. Nothing from that project is committed and the
repo has no new dependency entries.

| Check | Result |
|---|---|
| Strict `tsc --noEmit` (Vite-style: `strict`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, `allowImportingTsExtensions`, `jsx: react-jsx`) | **Pass** |
| `vite build` of the fixture-preview harness (component + CSS + preview) | **Pass** |
| 12 DOM tests (Vitest + jsdom + Testing Library) | **Pass — 12/12** |

DOM coverage: blank omitted + zero kept through the real form; invalid input blocked before
submit; empty form cannot submit; duplicate click while pending sends once; retry reuses id
and mission timestamp; changed input → new id; server-message display; unavailable reason +
fallback callback; available reaction entry; cancel after starting practice submits nothing;
full 3 practice + 12 measured reaction flow submits once with contract metadata and the
median/timeout behavior; unmount mid-task clears timers and submits nothing; RadLab scenario
does not render the form.

### Engine regression (unchanged by this branch)

```bash
python -m unittest discover -s tests/engine
```

Result: **Pass — 43 tests** (run on Python 3.12.10 in this checkout).

## Checks for the PR

| Check | Status | Evidence |
|---|---|---|
| MO-01 inspect branch/contract, local prop stub | **Pass** | Branch `build/checkin`; contract and plan read; stub labeled in `types.ts`. |
| MO-02 component export and fixture preview | **Pass** (code) / preview run **Blocked** | `CrewCheckIn` export; `preview/FixturePreview.tsx`; temporary harness build/vet passed. |
| MO-03 sleep input, sample label, reject invalid | **Pass** | Committed validation/payload tests + temporary DOM tests. |
| MO-04 optional self-reports, blank omitted, zero sent | **Pass** | Committed payload tests + temporary DOM test. |
| MO-05 validation before submit, display 422 message | **Pass** (fake rejection) / real 422 **Blocked** | Message display and retry exercised with the fake callback; API not present. |
| MO-06 payload builder as a pure function | **Pass** | `payload.test.mjs`. |
| MO-07 submit states, stable retry, duplicate guard | **Pass** | `submission.test.mjs` + temporary DOM tests. |
| MO-08 reaction screens (instructions/practice/trials/completion/cancel) | **Pass** | Committed reducer tests + temporary DOM flow. |
| MO-09 performance.now timing, false starts, median | **Pass** | `reactionMachine.ts` + tests; DOM flow. |
| MO-10 reaction submission payload + `captured_at` | **Pass** | `payload.test.mjs`; contract D4 resolved. |
| MO-11 cancel/interruption/empty result | **Pass** | Reducer test; DOM cancel + unmount cleanup test. |
| MO-12 unavailable reason + `review_available_inputs` fallback | **Pass** | `viewModel.test.mjs` + temporary DOM test. |
| MO-13 spy-callback checks | **Pass** | Committed session/payload tests (blanks absent, zero kept, retry id, duplicate in-flight, changed input new id) + temporary DOM tests (render/cancel/unavailable). |
| MO-14 integrated verification B01/B04/B05 | **Blocked** | No shell or API in the repo yet; no endpoint to call. |
| MO-15 PR handoff | **Pass** (draft below) | This README. |
| B01 insufficient-data view at 09:00Z | **Blocked** | Needs Hamza's shell and Hajar's seeded run. |
| B04 unavailable reaction path, assessment pending | **Blocked** | Component path verified with fixture props; integrated assessment is Amine/Hamza wiring. |
| B05 submission retry/409/run isolation | **Blocked** | Server behavior is HZ-12; retry/id semantics verified client-side. |

## Open items and smallest decisions needed

1. **Props/types (HZ-03) — Hamza.** Publish the exact prop names, actions prop shape and
   submit-callback rejection contract; this folder currently uses the labeled local stub in
   `types.ts`. Smallest decision: confirm the six props above and that a rejected promise
   carries a displayable message.
2. **Frontend shell/toolchain (HZ-03/HZ-04, D10) — Hamza.** No manifests, Vite config or
   test runner exist in this checkout. Smallest decision: publish the shared runner and
   tsconfig; confirm `.ts`-extension imports (Vite-style `allowImportingTsExtensions`) and
   that a feature can import its own CSS.
3. **API endpoints (HZ-04/HZ-12/HZ-13) — Hamza.** Needed to run B01/B04/B05 end to end;
   the component ready-to-mount.
4. **Submission id format (D8) — Hamza.** Client uses a non-empty opaque id
   (`crypto.randomUUID()`, with a fallback). Confirm any extra validation.
5. **Labels (D11) — Fadoua/Amine.** The table above is the published click-path vocabulary;
   confirm or request wording changes.
6. **Reaction trial settings — El Mahdi/Mohsine.** 3 practice + 12 measured trials and
   1.5–3 s waits are a recorded prototype choice (plan does not fix them); no clinical
   cutoff is implied.
7. **Empty-action view wording.** When the engine returns no `start_reaction_check` action,
   the component shows "No reaction check is offered for this view." Confirm with Amine/
   Fadoua or hide the section.
8. **D4 resolved by contract:** `metadata.captured_at` (UTC ISO text) is implemented.
   D2/D3 belong to the fixture owner and do not affect this component.

## Files in this feature

```
frontend/src/checkin/
  README.md                  this handoff
  index.ts                   public export (CrewCheckIn + types)
  types.ts                   local labeled prop/contract type stub
  constants.ts               contract ids/units/labels + prototype reaction settings
  validation.ts              client-side field validation
  payload.ts                 pure submission payload builders
  submission.ts              stable-id submission lifecycle (retry/reuse/new-id)
  reactionMachine.ts         pure reaction state machine, median/result arithmetic
  viewModel.ts               action lookup / reaction availability / scenario scope
  status.ts                  request status type
  CrewCheckIn.tsx            main named export
  CheckInForm.tsx            sample sleep + optional self-report form
  ReactionTask.tsx           instructions, practice, measured trials, cancel
  ReactionResultPanel.tsx    completion result and submit/retry
  checkin.css                scoped feature styles
  env.d.ts                   local CSS-module type declaration
  preview/FixturePreview.tsx fixture-preview harness with fake callbacks
  preview/fixtures.ts        preview props (engine-shaped actions)
  *.test.mjs                 committed dependency-free tests
```

## PR handoff

```
Branch: build/checkin
Base (kickoff commit SHA): fd1da9690a5d3b28af5c7353a87114be977a6589
Changed files: frontend/src/checkin/** (all files above; nothing outside the folder)
How to verify (exact command or click path):
  cd frontend/src/checkin && node --test         (39 tests, Node v24.21.0)
  python -m unittest discover -s tests/engine    (43 tests, unchanged regression)
  Preview harness: mount preview/FixturePreview.tsx once the shell exists; toggle
  available/unavailable reaction resource and the resolve/reject/slow fake callback.
Checks (ID — status — exact command — observed result):
  MO-01..MO-13 — Pass — see the checks table above
  MO-14 / B01 / B04 / B05 — Blocked — waiting on Hamza's shell and API (HZ-03/04/12/13)
Preview vs integrated: local temporary harness only (12/12 DOM tests); no integrated run yet.
Open questions / blockers (owner + smallest decision needed): see the list above.
Shared-file changes requested: none.
```

## Disclaimer

Ranges, windows and prototype reaction settings are demo parameters, not clinical cutoffs.
A reaction result here is a response-time measurement for the demo; nothing in this feature
diagnoses or replaces the flight surgeon. Seeded numbers belong to the fixture owner; this
component keeps sample self-reports and the device-measured reaction result visibly
separate (sample-entry badge vs "Recorded on this device").
