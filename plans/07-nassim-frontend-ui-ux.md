# Nassim · Frontend UI/UX, design system and visual acceptance

> **Current ownership:** Read [the team update](team-update.md) first. You own the shared
> frontend presentation layer. Amine owns dashboard logic and composition; Mohsine owns
> check-in behavior; Hamza owns the shell, API and launch; El Mahdi owns the contract and
> engine. Fadoua owns evidence, acceptance and the recording.

**Base:** `origin/main` at `6eaaed8`. **Branch:** `build/frontend-ui`.
**Tools:** Claude, Codex and your UI/UX setup are for exploration, variants and review.
Every label, state and value you render must come from `contracts/v1.md` or the supplied
props — never invent health text, thresholds or data.

## 0. Quick card

| Item | Value |
|---|---|
| You own | Shared UI kit and design tokens, visual state gallery, dashboard/check-in presentation, accessibility, responsive and offline visual QA |
| Write only in | `frontend/src/ui/` and colocated tests |
| Read-only | `frontend/src/dashboard/` (Amine), `frontend/src/checkin/` (Mohsine), `frontend/src/api/`, `frontend/src/shell/`, `frontend/src/App.tsx`, `frontend/src/main.tsx` (Hamza); `contracts/`, `backend/` (El Mahdi/Hamza) |
| Day 1 target | Tokens plus the core component kit and a static gallery covering the contract states |
| Day 2 target | Integrate with Amine/Mohsine, finish responsive/accessibility/offline checks, hand Fadoua the visual matrix |
| Checks you support | A03, A04, B01, B04, X01 (visual); no backend or data check |
| You unblock | Amine and Mohsine (shared components), Fadoua (screenshots and visual acceptance) |

## 1. Operating rules

1. **Present, do not infer.** Status text, assessment titles, evidence details, missing
   inputs, action labels and unavailable reasons arrive in props. Never compute a health
   state, choose a threshold or rewrite a contract label.
2. **One visual system.** Tokens and primitives live in `frontend/src/ui/`. Do not fork
   them inside the dashboard or check-in; hand the component or a PR note to its owner.
3. **Respect the boundary.** No edits to API, storage, engine, contract, shell, App entry
   points, or feature logic. If a shared file must change, send Hamza/Amine the path and
   the smallest intended diff.
4. **No invented assets or dependencies.** No CDN, remote fonts, icon packs or new npm
   packages without Hamza and El Mahdi. Everything ships locally.
5. **Status words:** **Pass**, **Fail**, **Blocked**, **Not run**, with the exact command,
   viewport and observed result.
6. **Claims discipline.** The UI must keep **Historical NASA telemetry**, **Synthetic crew
   scenario** and **Recorded on this device** distinct. Detector readings are not crew
   exposure; the gap cause is unknown; thresholds are prototype settings.

## 2. Task list

| ID | Task | Depends on | Deliverable |
|---|---|---|---|
| NS-01 | Audit the current shell and check-in against the two contract examples | — | Gap list: missing states, labels, spacing, accessibility |
| NS-02 | Define design tokens: type scale, spacing, color, focus, status/provenance/evidence colors | NS-01 | `frontend/src/ui/tokens.css` |
| NS-03 | Build the core presentational kit (badges, source card, assessment panel, evidence list, action button, incident row, drawer, empty/error states) | NS-02 | `frontend/src/ui/` + tests |
| NS-04 | Build a static state gallery covering every contract state and edge case | NS-03 | Gallery route or test-only page, no live data |
| NS-05 | Pair with Amine on dashboard visuals; he keeps the feature logic and applies changes | NS-03, Amine scaffold | Components + reviewed PR notes |
| NS-06 | Pair with Mohsine on check-in visuals | NS-03, Mohsine scaffold | Components + reviewed PR notes |
| NS-07 | Accessibility pass: semantic structure, labels, focus order, drawer focus trap/return, contrast, reduced motion | NS-03 | Fix list + verified keyboard walkthrough |
| NS-08 | Responsive and offline pass at 320, 768 and 1440 px with all assets local | NS-05, NS-06 | Screenshot/notes matrix |
| NS-09 | Visual acceptance support for Fadoua: A03/A04/B01/B04/X01 screens and exact labels | NS-05, NS-06 | Screenshot set with build SHA and checkpoint |
| NS-10 | Final frontend verification: `npm test`, `npm run build`, browser walkthrough | NS-07–NS-09 | Pass/Fail report |

## 3. Task details

### NS-01 · Audit before designing
1. Read `contracts/v1.md`, both example JSON files and `plans/03-amine-mission-dashboard.md`.
2. Inventory what exists today in `App.tsx`, `styles.css` and `checkin/`. Do not rewrite
   their logic; list gaps against the required states.
3. Capture the current labels and compare them with D5 vocabulary. Report mismatches;
   do not silently rename contract text.
**Done when:** Amine and Mohsine can see exactly which visual pieces are missing.

### NS-02 · Tokens
Define a small, documented set: background/surface/border, text hierarchy, accent,
success/watch/incomplete states, provenance colors, spacing scale, radius, shadow and
focus ring. Use system fonts only. Ensure text contrast meets WCAG AA.
**Done when:** a component can be built without ad-hoc hex values.

### NS-03 · Core kit
Build presentational components with explicit props and no data fetching:
- provenance badge (three labels, visually distinct);
- source/status chip that handles `current`, `stale`, `missing`, `invalid`, `conflicting`;
- source card that shows **No reading** and no age when null, and displays age `0`;
- assessment panel with separate supporting, conflicting and missing evidence;
- evidence list that joins by observation ID and shows **Evidence unavailable** for a
  missing reference;
- action button that stays visible when unavailable and shows the supplied reason;
- incident row keyed by the supplied incident ID;
- accessible drawer primitive for **Why?**;
- empty, loading, network-error and retry states.
Keep all user-visible strings as props or contract constants. Add colocated tests for
null/zero age, unavailable actions, evidence joining and provenance labels.
**Done when:** `npm test` covers the primitives and no component invents text.

### NS-04 · State gallery
Create a static gallery that renders, without the API:
- RadLab: both current; DosTel1 stale at 455 s; DosTel2 current at 0 s; one open incident;
  one resolved incident.
- Crew: `insufficient_data` at 09:00; `watch` **Sleep and vigilance change** at 09:01;
  `observed` **Demo pattern not observed**; `insufficient_data` **Comparison incomplete**;
  reaction action unavailable with **Reaction check unavailable** and the available
  fallback.
- Edge cases: missing reading, age `0`, invalid source, conflicting evidence placeholder,
  no incidents, long evidence text.
Use the contract examples and explicit test props only. Label the page **Fixture preview**.
**Done when:** every visual state can be reviewed in one place without a backend.

### NS-05 / NS-06 · Pair with Amine and Mohsine
1. Agree the component API with each owner before they import it.
2. Provide components, layout guidance and PR notes. Amine and Mohsine apply changes in
their feature folders and keep state selection, callbacks and feature tests.
3. Review their integration for label drift, duplicated CSS and inaccessible markup.
**Done when:** dashboard and check-in both consume `frontend/src/ui/` and no visual
constant is duplicated.

### NS-07 · Accessibility
Keyboard-check the full flow: scenario selector, checkpoints, source cards, **Why?**,
evidence, action buttons, check-in fields and submit. The drawer must move focus in,
trap it, close on Escape and return focus to its trigger. Check visible focus, headings,
form labels, error text and reduced motion.
**Done when:** the walkthrough is recorded with any remaining issues and owners.

### NS-08 · Responsive and offline
Check 320 px, 768 px and 1440 px. No horizontal scroll at 320; evidence and incident
lists remain readable; controls reachable. Build once, serve from FastAPI, and confirm in
the browser Network panel that assets and API calls are loopback-only.
**Done when:** the matrix is attached and no remote asset request appears.

### NS-09 · Visual acceptance support
Give Fadoua a labelled screenshot set for A03, A04, B01, B04 and X01 with the build SHA
and checkpoint times. Mark preview versus integrated explicitly. Do not claim a check
passed from a static gallery.
**Done when:** Fadoua can attach the images to the corresponding checklist rows.

### NS-10 · Final verification
Run `npm test` and `npm run build` from the merged frontend, then repeat the browser
walkthrough. Report each check as Pass/Fail/Blocked/Not run with the command and viewport.
**Done when:** the final report is in the PR and shared with El Mahdi.

## 4. Definition of done

- `frontend/src/ui/` is the single source of visual tokens and primitives.
- Every contract state and edge case is visible in the static gallery.
- Dashboard and check-in compose the kit without duplicated visual constants.
- Keyboard, contrast, 320/768/1440 px and offline asset checks are recorded.
- No backend, contract, shell or feature-logic edits; no new dependencies.
- Fadoua has the labelled screenshot set and knows which checks remain **Blocked**.

## 5. Report format

```
Check — status — exact command/viewport — observed result
Kit tests — Pass — npm test — 14 files, N tests
Build — Pass — npm run build — exit 0
A03 visual — Blocked — browser at 23:20:00 — archive replay not merged
Open question: file/field → observed → owner → smallest decision
```

## 6. Guardrails for AI-assisted design

Claude and Codex are useful for layout variants, accessibility review and test
scaffolding. They are not a source of contract text or data. Treat generated labels,
colors and states as proposals until checked against `contracts/v1.md`, the supplied
props and the D5 vocabulary. Never invent a health interpretation, a threshold or a
measurement to make a screen look complete.
