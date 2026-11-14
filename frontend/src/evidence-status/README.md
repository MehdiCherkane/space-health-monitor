# Evidence status

A compact, read-only section that makes the uncertainty handling the engine already
implements understandable: what evidence is usable, what prevents an assessment, and what
the crew member can do next.

The panel never fetches, never changes the replay clock, never submits observations and
never computes another assessment. Every word it shows is derived from the returned
`StateEnvelope` (or is a fixed explanatory sentence such as the medical-certainty
limitation). It adds no model, calibrated probability or clinical confidence field.

- Branch: `finish/evidence-status`
- Implementation and tests commit: `9ec8f6d77399159d92b154f78e247a85cb99ed28`
- This README, results and demo guidance are added in a follow-up documentation commit.

## Files

| File | Purpose |
|---|---|
| `evidenceStatus.ts` | Pure presenter: requirements, source rows, actions, meaning, limits. |
| `EvidenceStatusPanel.tsx` | The exported component and small internal row components. |
| `EvidenceStatusPanel.test.tsx` | 22 Vitest/jsdom regression tests using canonical gallery states and one actual engine response. |
| `evidence-status.css` | Scoped `.evidence-status-*` styles built on the current semantic tokens. |
| `index.ts` | Barrel export for the module. |

Nothing outside this folder is changed. No dependency or manifest is added.

## Component API

```tsx
import type { DataMode, LoadStatus, StateEnvelope } from '../api/types'

export interface EvidenceStatusPanelProps {
  state: StateEnvelope | null
  dataMode: DataMode
  status: LoadStatus
  onAction: (actionId: string) => void
  onOpenEvidence: () => void
}

export function EvidenceStatusPanel(props: EvidenceStatusPanelProps): JSX.Element
```

The component uses the existing shared types unchanged. It keeps no copy of props in
state and no effects: a new response, a null state or a different clock immediately
replaces the previous display.

## Integration for Claude

The redesigned dashboard already receives every input the panel needs. Import the module
and place it near the main assessment / `Why?` action, for example as the first item in
the main column after the assessment panels:

```tsx
import { EvidenceStatusPanel } from '../evidence-status'

<EvidenceStatusPanel
  state={props.state}
  dataMode={props.dataMode}
  status={props.status}
  onAction={props.onAction}
  onOpenEvidence={props.onOpenEvidence}
/>
```

- The module is self-contained; mounting it is one import and one element. It can be
  removed again by deleting the folder and the element.
- Suggested placement: immediately after the assessment / main `Why?` action, before or
  beside the source cards. Detailed limits are collapsed behind "What this means".
- It expects the dashboard column to give it width; the section is a normal
  `ui-card` with `min-width: 0` and no fixed positioning.
- Do not wrap it in another drawer and do not route its actions yourself: `Why?` calls
  the supplied `onOpenEvidence`, and action buttons call the supplied `onAction` with
  the engine's action ID. The shell keeps owning routing and the existing drawer.
- The scoped CSS only styles `.evidence-status-*`; it does not alter global layout,
  tokens, buttons or badges. Shared controls come from `../ui` (`ActionButton`,
  `StatusBadge`, `ProvenanceBadge`, `DataModeBadge`, `UtcTime`, `EvidenceList`).

## What it reads from the returned envelope

- `state.sources`: `source_id`, `state`, `last_observation_id`,
  `age_seconds`, `reason_code`. States and reason text are rendered as returned;
  ages are not recalculated and no freshness threshold is applied by the panel.
- `state.assessments`: `state`, `title`, `rule_id` + `rule_version`,
  `missing_inputs`, `action_ids`, `supporting_evidence`,
  `conflicting_evidence`.
- `state.actions`: `id`, `label`, `available`, `unavailable_reason`.
  Unavailable actions stay visible and disabled with the returned reason. Action IDs that
  are not present in `state.actions` are shown as a non-executable "Action `id`
  unavailable" line; the panel never invents a control.
- `state.observations`: joined by ID through a `Map`. A missing reference renders
  "Evidence unavailable" with its ID; no value, state or provenance is invented.
- `state.as_of`: rendered with the existing UTC formatter
  (`2026-01-10 09:00:00 UTC`). Ages and freshness come only from the response.
- `conflicting_evidence`, when the engine returns it, is rendered with its detail,
  code, baseline ID and observation references. When empty the panel says exactly
  "No conflicting evidence returned." and the "What this means" area states that
  automatic conflict detection is not implemented, so this is not an agreement claim.

### Absent reaction result versus recorded but incomparable result

The engine uses the same missing-input identifier, `reaction_time`, for both cases.
The panel distinguishes them from the returned reaction source reason code:

| Returned source reason | Rendered requirement |
|---|---|
| `current_session_missing` or `last_observation_id === null` | "Reaction result missing." |
| `incomparable_reaction_result` with a recorded reading | "Reaction result recorded; comparison with the demo baseline is unavailable." The recorded value, observation timestamp, provenance badge and ID are shown. |
| `invalid_observation` | "Reaction result recorded but unusable for the comparison." |

Baselines are separate requirements: `sleep_baseline` → "Sleep baseline incomplete.",
`reaction_baseline` → "Reaction baseline incomplete.". Sleep slots use
`sleep_duration` → "A required sleep log is missing." or "... is invalid.".
Detector missing inputs (`DosTel1`/`DosTel2`) use the detector name and its returned
source state. Unknown identifiers are preserved visibly with a safe readable fallback.

The statement "Required inputs available for this demo rule." appears only when a real
returned assessment has no missing inputs and is not `insufficient_data`. An
`insufficient_data` assessment with an empty missing-inputs list is shown as incomplete
without a specific cause instead of declaring completeness.

## Modes, loading and replay correctness

| Input | Display |
|---|---|
| `state === null` + `loading` | "Loading evidence status…", no previous evidence or controls. |
| `state === null` + `error` | "Evidence status is unavailable for this time.", no previous evidence. |
| `state === null` otherwise | "No evidence status is available at this time." |
| `dataMode === 'fixture-preview'` | "Fixture preview — fixed example." plus a note that these are not stored observations from a run. |
| `dataMode === 'unknown'` | "Data mode unknown." and a note that the values are not confirmed as backend-evaluated stored observations. |
| `dataMode === 'integrated'` | Rendered as the existing "Integrated run" badge; never renamed to live/validated data. |
| No assessments returned | "No assessment was returned for this time, so evidence completeness cannot be confirmed." No actions and no completeness claim. |
| Multiple assessments | Each assessment keeps its own title, state badge, rule, meaning and requirements. The summary says they are listed separately; the first is never presented as a global verdict. Shared action references are rendered once. |

The panel never uses the wall clock and never applies the 300 s detector rule itself.
It renders the engine's source states and reason codes, so a scheduled sleep input's
age is not judged against the detector threshold.

## No model or confidence

No probability, calibrated confidence, gauge, synthetic score, diagnosis or arbitrary
Strong/Moderate/Weak label is introduced or displayed. The qualitative
`confidence_ceiling` values in `evidence/hypothesis_evidence_map.yaml` (e.g.
`MODERATE`) are research constraints for hypotheses; they are not runtime values for
a person's current result and the panel does not display them. Verified against
`a16b1b8` (the same main the assignment was prepared against): `frontend/src/api/types.ts`,
`backend/engine/` and `contracts/v1.md` contain no confidence/probability field, and
`backend/engine/selection.py` still returns an empty `conflicting_evidence` list.
`backend/engine/freshness.py` does not compare detector values, so differing readings
are never treated as a conflict here.

## Design and accessibility

- Semantic `<section>` with a heading, `<dl>` rows, native `<details>` for returned
  evidence and limits, and real `<button>` controls.
- Scoped `.evidence-status-*` classes only; current semantic tokens, shared
  `ui-button`/`ui-badge` components; no global resets, fixed positioning, animation or
  galaxy work.
- Control targets are at least 44 px (shared `--target` via `ui-button` and the
  details summary), focus is visible through the existing ` :focus-visible` rule, and
  state meaning is written in words as well as colour.
- No `aria-live` region wraps the panel, so a re-render does not re-announce the whole
  section. Loading uses a normal status message.
- Absent observation references are reported, never replaced with invented values.

## Verification

Run at PR head `9ef4390` and re-run on the review-amendment head (2026-11-14, UTC),
Node 24.22.1, npm 11.19.1, Python 3.14.9. See the PR for the exact amendment SHA:

| Command | Result |
|---|---|
| `cd frontend && npx vitest run src/evidence-status/EvidenceStatusPanel.test.tsx` | **22 passed** (1 file) |
| `npm --prefix frontend test` | **83 Vitest passed** in 8 files, plus **41 Node tests passed** (baseline was 61 Vitest + 41 Node; this change adds 22 Vitest tests) |
| `npm --prefix frontend run build` | **passed**: `tsc --noEmit` + Vite, 45 modules |
| `python3 -m unittest discover -s tests/engine -q` | **43 passed** (engine untouched) |

The tests import the canonical gallery states read-only: Example B missing reaction
(state-8), 09:01 watch (state-9), observed 270 ms (state-10), incomparable browser-keyboard
(state-11), disabled reaction resource (state-12), RadLab stale (state-1), recovery (state-4),
missing/invalid detector readings (state-5/6) and the hand-edited conflict edge fixture
(state-7). The review amendment adds one actual engine response for an invalid sleep
reading (canonical fixture with `sleep-09` value `-1`, evaluated at `2026-01-10T09:01:00Z`).
Edge variants used for unknown identifiers and sleep-baseline gaps are explicit clones
inside the test file; canonical fixture bytes are unchanged.

### Review amendment (PR #17 review at `9ef4390`)

- **P2 fixed:** an invalid sleep observation is no longer summarised as absent. The
  meaning now reads the returned `crew_sleep_log` invalid state/reason and says
  "A returned sleep reading is invalid, so the comparison cannot be completed."; the
  requirement row still says "A required sleep log is invalid." Genuinely missing nights
  and incomplete baselines keep their own messages. The new DOM regression embeds the
  actual engine response and fails on the pre-amendment presenter.
- **P3 fixed:** Fadoua's live walkthrough now captures the keyboard result at mission
  `09:00` and shows the incomparable state there; seeking `09:01` is labelled as the
  separate canonical synthetic watch story. Gallery state-11 is explicitly a rendering
  fixture. No evaluator change was needed.
- No backend, rules, canonical fixtures, API types, dashboard or other shared files were
  changed by the amendment.

Not done here: integration into the dashboard (Claude owns that commit), a real API/browser
acceptance run for this panel, and the full X01 offline rehearsal. The module was not
mounted in the app during verification; the component tests above are the executed proof.

## Fadoua: three key states to demonstrate

The panel is not visible in the app until Claude integrates it. Gallery states state-8,
state-9 and state-11 are **component/rendering fixtures**, not checkpoint instructions.
For the live walkthrough, use a fresh seeded crew run and keep the replay clock at
mission `09:00` for the measured result:

1. **Missing evidence** — start a **Fresh run** in "Sleep and vigilance". The initial
   checkpoint is `09:00` (same returned state as canonical Example B / gallery state-8).
   Expected: **Vigilance data missing** / **insufficient data**; requirement
   **"Reaction result missing."**; action **Run reaction check**. The sleep evidence is
   shown as a separate returned row; the baseline reactions are not claimed as a current
   result. With `local_reaction_task` disabled, **Run reaction check** stays visible but
   disabled with **"Reaction check unavailable"**, and the returned fallback
   **Review available inputs** remains available.
2. **Recorded but not comparable (live keyboard result)** — stay at mission `09:00` and
   complete the keyboard reaction check from the check-in form. The submission stores
   `observed_at` `2026-01-10T09:00:00Z` with `metadata.captured_at` kept separately.
   When the state reloads at `09:00`, the latest current-session result is the
   browser-keyboard observation (`input_profile: "browser-keyboard"`), whose source is
   `current` with reason `incomparable_reaction_result`.
   Expected: **Comparison incomplete** / **insufficient data**; requirement
   **"Reaction result recorded; comparison with the demo baseline is unavailable."**;
   the recorded value/provenance/ID (for example "320 ms", "Recorded on this device",
   `browser-1`) stay visible.
3. **Seeded watch story at `09:01` (optional, separate)** — after the keyboard result,
   seek to `09:01`. The canonical seeded synthetic `reaction-10` (310 ms) is the later
   current-session result, so the state becomes **Sleep and vigilance change** /
   **watch**. Meaning: "The configured sleep and reaction conditions matched. The cause is
   not established."; returned evidence: "Current reaction time is 310 ms against the
   250 ms demo baseline (+24.0%)". The engine's action list at this checkpoint is
   **Review available inputs**; it does not offer starting a new reaction check. Return to
   `09:00` to show the recorded-but-incomparable browser result again.

With an actual live browser result, the incomparable state appears at mission `09:00`;
seeking `09:01` selects the later canonical synthetic sample instead. Gallery state-11
(`09:01 · Current but incomparable browser result`) is a rendering fixture produced by
running the engine on a browser-keyboard input, not a live capture instruction.

Useful extras: RadLab `23:20` shows **DosTel1 stale** with
"Last reading 7 min 35 s ago." beside **DosTel2 current** and the limitation "A detector
reading is old. The cause of the gap is unknown."; the conflict statement is always
"No conflicting evidence returned." for engine output.

## Known limitations / future work

- Automatic conflict detection is reserved in the contract but not implemented for the two
  demo rules. The panel renders a returned conflict but does not compare detectors itself;
  empty means "none returned", not "sources agree".
- The panel supports multiple assessments but the current engine returns one per scenario.
- No backend field is missing for this first version. A future conflict encoding or a
  calibrated confidence field would require an explicit contract/policy change and must
  not be invented in the UI.
- The component is ready for Claude's dashboard placement; acceptance in the redesigned
  layout and against a real seeded run remains a joint integration step.
