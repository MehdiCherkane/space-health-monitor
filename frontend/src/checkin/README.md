# Crew check-in and local reaction check

Behavioral-demo feature for the `sleep_vigilance` scenario, on branch `build/checkin`.
Owner: Mohsine. Write scope: `frontend/src/checkin/` (tests colocated here).

**Status:** mounted by the shell in `src/App.tsx` for `sleep_vigilance` runs. Props come from
the shared `src/api/types.ts` (`CheckInProps`); this folder no longer mirrors API types.
The shell mounts the component with `key={run.run_id}`, so a fresh run or scenario switch
starts with an empty form, no reaction task and no pending retry payload.

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
- A completed reaction check is **submitted automatically, exactly once**, so a completed
  result is never silently discarded. A failed submission shows the error with a
  **Retry submission** action that reuses the payload and id; **Run reaction check again** is
  disabled while that retry is outstanding.
- Unavailable state: when the engine marks `start_reaction_check` unavailable, the fixed
  title **Reaction check unavailable** is shown with the engine's reason text (when it differs)
  and the `review_available_inputs` fallback. Sleep or self-reports are never offered as a
  substitute for the missing reaction result.

Everything the UI shows about availability, labels and reasons comes from props; the
component does not compute statuses and never calls the API itself.

## Export and mounting

Named export **`CrewCheckIn`** from `./index.ts`; props are `CheckInProps` from
`../api/types.ts`:

| Prop | Meaning |
|---|---|
| `run` | Active run; the shell keys the component by `run.run_id`. |
| `scenarioId` | Only `sleep_vigilance` renders the form. |
| `missionTime` | Current replay clock (UTC whole-second), used as `observed_at`. |
| `actions` | Engine actions; reads `start_reaction_check` and `review_available_inputs`. |
| `onSubmit` | Shell calls `POST /api/v1/runs/{run_id}/observations`, then refreshes state for that run only. Rejections carry displayable messages. |
| `onAction` | Required. Shell route for `review_available_inputs` → **Why?** evidence drawer. |

`submission_id` (D8) is minted here and reused with the same payload and mission time on
retry; the shell forwards the payload unchanged.

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
  (counted, not a valid trial); held-key repeats are ignored. A stray press on the
  practice-complete screen is ignored and not counted.
- Timing uses the caller-injected monotonic clock, which defaults to `performance.now()`.
- Result = median of completed valid measured trials, rounded to whole milliseconds, plus
  `trial_count` and `false_starts`. An empty valid-trial set produces no result.
- Cancel at any point (or unmounting/navigating away) clears timers and listeners and
  submits nothing. An interrupted task creates no completed result.
- On completion the result is submitted automatically exactly once. A rejection keeps the
  completed result and offers **Retry submission**; **Run reaction check again** is disabled
  while the submission is pending or failed, so a completed result cannot be discarded
  silently.
- A live `browser-keyboard` result is visible in history but is **not comparable** with the
  seeded `seeded-demo` baseline; the engine reports that as insufficient data. The
  component does not decide comparability.

## Control names and labels (for Fadoua's click paths, D11)

| Area | Visible text |
|---|---|
| Section heading | **Crew check-in** |
| Mission clock | **Mission time** `<missionTime>` |
| Sleep field | **Sleep duration (minutes)**; hint **Sample entry — stored as synthetic.** |
| Self-reports | legend **Sample entry (synthetic) — optional self-reports**; **Fatigue (0–10, optional)**, **Mood (0–10, optional)**, **Stress (0–10, optional)** |
| Submit | **Submit check-in** |
| Failure | server/error message + **Retry submission** |
| Success | **Check-in submitted. Edit a field to start a new check-in.** |
| Reaction entry | engine action label: **Run reaction check** |
| Reaction unavailable | title **Reaction check unavailable**, engine reason text when different; fallback action label: **Review available inputs** |
| Reaction instructions | **Local reaction check**; **Start practice**; **Cancel reaction check** |
| Practice done | **Practice complete**; **Start measured trials** |
| Trials | **Practice trial N of 3**, **Measured trial N of 12**, **Wait for the green prompt…**, **Press the space bar now!**, **False start — wait for the green prompt.** |
| Result | **Reaction check complete**, **Recorded on this device**, **Median response time**, **Valid trials**, **False starts**; **Run reaction check again** |
| Automatic submission | **Submitting reaction result…** then **Reaction result submitted.**; on failure the error message + **Retry submission** |

## Fixture preview harness

`preview/FixturePreview.tsx` mounts the real component with **labeled fake** data:
fixture-preview props, engine-shaped actions for available/unavailable reaction resource, and
a fake submit callback that resolves, rejects (displayable message) or resolves after 1.5 s.
It shows a **Fixture preview — fake callback, synthetic sample entries, not an integrated
run** badge and a callback log. It is dev-only; the app shell should not import it.

The app's static state gallery (`/?gallery`) also mounts the component with a fake submit
callback for every behavioral state.

## Verification

### Committed, dependency-free tests (reproducible on this branch)

From `frontend/src/checkin/`:

```bash
node --test
```

Result: **Pass — 41 tests** on Node v24.21.0 (Node's built-in runner with TypeScript type
stripping; the repo has no frontend toolchain yet — D10, owned by Hamza). No dependencies
were added and no manifests changed. Coverage:

- `validation.test.mjs` — blanks, sleep range, 0–10 integers, messages, zero kept, snapshots.
- `payload.test.mjs` — blanks omitted, zero kept, source/metric/unit ids, exactly
  `submission_id`/`observed_at`/`entries`, no provenance/subject, reaction metadata.
- `submission.test.mjs` — in-flight duplicate ignored, retry reuses id/payload/mission
  timestamp, changed input gets a new id, rejection message kept, id uniqueness/format.
- `reactionMachine.test.mjs` — median odd/even/invalid, practice excluded, 3 practice
  trials, false starts, held-key repeats, duplicate stimulus, stimulus-delay window,
  12-trial completion, practice-complete stray press ignored, empty/invalid timing, cancel
  produces no result.
- `viewModel.test.mjs` — action lookup, unavailable reason passed through exactly, fallback
  action, missing actions, scenario scope.

### Local harness evidence (NOT reproducible from this branch yet)

The shared Vite/Vitest toolchain now exists on `build/replay-api` but is not on this
standalone branch, so a temporary Vite/Vitest project outside the repository (installed under
the OS temp folder, importing this folder with a `react` alias) was used while building it:

| Check | Result |
|---|---|
| Strict `tsc --noEmit` (Vite-style: `strict`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, `allowImportingTsExtensions`, `jsx: react-jsx`) | Pass (local only) |
| `vite build` of the fixture-preview harness (component + CSS + preview) | Pass (local only) |
| DOM tests (Vitest + jsdom + Testing Library) | Pass — 13/13 (local only) |
| Real headless Chrome render of the built fixture preview | Rendered as expected (local only) |

DOM checks exercised: blank omitted + zero kept through the real form; invalid input blocked
before submit; empty form cannot submit and the hint only appears after editing; duplicate
click while pending sends once; retry reuses id and mission timestamp; changed input → new
id; server-message display; unavailable title/reason + fallback callback; available reaction
entry; cancel after starting practice submits nothing; full 3 practice + 12 measured flow
auto-submits exactly once with contract metadata; failed automatic submission retried with
the same id and payload; unmount mid-task clears timers and submits nothing; RadLab scenario
does not render the form.

**This is recorded for transparency, not claimed as a Pass in the repo.** It is not
reproducible from this standalone branch because the shell toolchain and manifests live on
Hamza's branch. After the shell merges, port these DOM tests into this folder and run them
with the shared Vitest runner.

### Engine regression (unchanged by this branch)

```bash
python -m unittest discover -s tests/engine
```

Result: **Pass — 43 tests** (Python 3.12.10 in this checkout).

## Checks recorded at the `build/checkin` handoff

Historical record; rows marked Blocked for the shell/toolchain are superseded by the
integrated tests above. Rule used below: **Pass** needs a command reproducible on this branch; **Blocked** means the
check needs the shared shell/toolchain or API that is not in this checkout (plan §1.6).

| Check | Status | Evidence |
|---|---|---|
| MO-01 inspect branch/contract, prop types | **Pass** | Contract and plan read; props now come from the shared `src/api/types.ts`. |
| MO-02 component export and preview-harness source | **Pass** | `CrewCheckIn` export from `index.ts`; `preview/FixturePreview.tsx` committed. |
| MO-02 preview runs in a shell | **Blocked** | Shell is published on `build/replay-api`, not merged into this standalone branch; local harness evidence only. |
| MO-03/04/05 client validation, payload, server-message display (pure logic) | **Pass** | `validation.test.mjs`, `payload.test.mjs`; message/retry code inspected. |
| MO-03/04/05 rendered form behavior | **Blocked** | Needs HZ-03 toolchain; local DOM evidence only. |
| MO-06 payload builders as pure functions | **Pass** | `payload.test.mjs`. |
| MO-07 submission session logic (stable id/retry/duplicate guard) | **Pass** | `submission.test.mjs`. |
| MO-07 rendered submit/retry states | **Blocked** | Needs HZ-03 toolchain; local DOM evidence only. |
| MO-08/09/11 reaction machine (phases, timing, false starts, median, cancel/empty) | **Pass** | `reactionMachine.test.mjs`. |
| MO-08/11 rendered reaction screens, timers, unmount cleanup | **Blocked** | Needs HZ-03 toolchain; local DOM evidence only. |
| MO-10 reaction payload + `captured_at` | **Pass** | `payload.test.mjs`; contract D4 resolved. |
| MO-12 availability logic + engine reason + fallback data | **Pass** | `viewModel.test.mjs`. |
| MO-12 rendered fallback click | **Blocked** | Needs shell wiring/onAction; local DOM evidence only. |
| MO-13 committed spy checks (blanks absent, zero kept, retry id, duplicate in-flight, changed input new id) | **Pass** | `submission.test.mjs` + `payload.test.mjs`. |
| MO-13 component-level spy checks (cancel zero calls, one completed task submits once, available/unavailable rendering) | **Blocked** | Local harness 13/13, not reproducible from this branch until the shell toolchain merges. |
| MO-14 integrated verification B01/B04/B05 | **Blocked** | No shell/API or merged build in this checkout. |
| MO-15 PR handoff | **Pass** | This README + PR text below. |
| B01 insufficient-data view at 09:00Z | **Blocked** | Needs Hamza shell + Fadoua seeded run. |
| B04 unavailable reaction path, assessment pending | **Blocked** | Component fallback source complete; integrated assessment is shell/dashboard wiring. |
| B05 submission retry/409/run isolation | **Blocked** | Server behavior is HZ-12; client retry/id semantics verified in `submission.test.mjs`. |

## Open items and smallest decisions needed

Resolved on `build/frontend-ui`: `allowImportingTsExtensions` is in `tsconfig.json`,
`onAction` is required in the shared `CheckInProps`, the mirrored `types.ts` and local
`env.d.ts` were removed, the shell forwards the client-minted `submission_id` unchanged, and
rendered behaviour (submit/retry, fresh-run reset, fallback routing) is covered by
`src/App.test.tsx` under Vitest + jsdom.

5. **Labels (D11) — Fadoua/Amine.** The table above is the published click-path vocabulary;
   confirm or request wording changes.
6. **Automatic reaction submission — El Mahdi/Hamza.** The plan's Part A says "a complete
   check calls the stub once", so the completed result is auto-submitted exactly once;
   failures are retryable and "Run again" is disabled while pending/failed. Confirm this
   matches the intended integrated flow.
7. **Sleep requiredness — El Mahdi.** The contract says self-reports are optional and MO-06
   omits blank fields; the current form also allows a self-report-only batch when sleep is
   blank. Confirm whether a sleep value must be present for a check-in.
8. **Reaction trial settings — El Mahdi/Mohsine.** 3 practice + 12 measured trials and
   1.5–3 s waits are a recorded prototype choice (the plan does not fix them); no clinical
   cutoff is implied.
9. **Empty-action view wording.** When the engine returns no `start_reaction_check` action,
   the component shows "No reaction check is offered for this view." Confirm with Amine/
   Fadoua or hide the section.

## Files in this feature

```
frontend/src/checkin/
  README.md                  this handoff
  index.ts                   public export (CrewCheckIn)
  constants.ts               contract ids/units/labels + prototype reaction settings
  validation.ts              client-side field validation
  payload.ts                 pure submission payload builders
  submission.ts              stable-id submission lifecycle (retry/reuse/new-id)
  reactionMachine.ts         pure reaction state machine, delay window, median/result arithmetic
  viewModel.ts               action lookup / reaction availability / scenario scope
  status.ts                  request status type
  CrewCheckIn.tsx            main named export
  CheckInForm.tsx            sample sleep + optional self-report form
  ReactionTask.tsx           instructions, practice, measured trials, cancel, focus handling
  ReactionResultPanel.tsx    completion result, automatic-submission state and retry
  checkin.css                scoped feature styles
  preview/FixturePreview.tsx fixture-preview harness with fake callbacks
  preview/fixtures.ts        preview props (engine-shaped actions)
  *.test.mjs                 committed dependency-free tests
```

## Disclaimer

Ranges, windows and prototype reaction settings are demo parameters, not clinical cutoffs.
A reaction result here is a response-time measurement for the demo; nothing in this feature
diagnoses or replaces the flight surgeon. Seeded numbers belong to the fixture owner; this
component keeps sample self-reports and the device-measured reaction result visibly
separate (sample-entry badge vs "Recorded on this device").
