# Agent 3 — Amine: prove dashboard behavior on the integrated candidate

## Mission, scope and budget

The dashboard already exists on main. Finish its correctness/acceptance proof and fix
demonstrated feature defects. Budget 1–2.5 hours. Read common start/audit, contract,
`frontend/src/dashboard/Dashboard.tsx`, shared API types, UI primitives, App tests and
`acceptance/manual-checklist.md` from PR10. Use `finish/dashboard-verification` from
latest main, updating after the integration gate.

Own only `frontend/src/dashboard/` and colocated tests. You are not alone: preserve
other agents' changes. Hamza owns shell/App/HTTP/clock/props; Nassim owns shared kit/CSS.
Report a shared bug with reproduction and smallest required change. Never move status
inference or baseline computation into the dashboard. Do not redesign or add charts.

## AM-R1 — immediate, before backend finishes

1. Inventory existing feature. Render contract examples using the current shared
   components and types. Do not duplicate App.test.tsx's existing stale-response/reset
   regressions; focus this agent on dashboard output and interactions.
2. Add `Dashboard.test.tsx` under the shared Vitest/jsdom runner. Use the actual
   component export and a callback spy, not a reimplementation of rendering logic.
3. Assert RadLab example: DosTel1 stale, age 455; DosTel2 current, age 0; exact values,
   units and timestamp/provenance labeling. `0` must stay visible; null age means no
   reading and no fabricated zero. Why resolves IDs to observations.
4. Assert behavioral example: pending assessment, 380/370/420 vs 450 baseline evidence,
   missing reaction, matching baseline IDs and run-check callback.
5. Assert distinct supporting/conflicting/missing evidence presentation with an explicitly
   labeled artificial edge state. An absent referenced ID says Evidence unavailable.
   It must not invent a measurement. This is a rendering test, not a new conflict rule.
6. Assert one stable incident row changes open→resolved; returning to earlier props
   removes closure/future readings. Assert action unavailable remains visible with
   supplied reason and available fallback calls the parent with the correct ID.
7. Assert checkpoint/scenario/reset controls invoke parent callbacks. Do not fetch
   inside dashboard or maintain a competing clock. Test basic empty/loading/error
   feature states only where owned by this component.

## AM-R2 — integrated candidate after #10/#11 fixes

Ask Hamza for SHA, launch command, resource-disabled recipe and data-mode expectations.
Use a fresh run; screenshot with build SHA and exact replay time.

| Check | Click path / observation |
|---|---|
| B01 | Crew scenario → 09:00 → Why: pending, recent sleep + baseline, reaction missing |
| B02 | Seek 09:01 → Why: watch, 310 vs 250 (+24%), both baseline references |
| B04 | Resource-disabled app → crew 09:00: disabled reaction action and reason; Review available inputs opens Why |
| A03 | Verified archive only → 23:20: ages 455/0, last values remain, one open incident |
| A04 | 23:30: both current and one resolved incident; rewind 23:20 returns open with no future closure |
| History | Review source history: chronological newest-limited data for chosen source and active clock; source and provenance readable |
| Reset | Fresh run resets incident/history/state to this run; late old responses never replace it |

Without actual archive, execute RadLab rendering tests on clearly marked preview, but
leave real A03/A04 Blocked. Do not mark a screenshot of the gallery as integrated proof.

## AM-R3 — defect triage and handoff

Fix only dashboard-owned failures with a regression first. For stale data from the shell,
send Hamza run/time/request evidence. For focus/kit/mobile problems send Nassim the DOM
state and viewport. Publish stable visible control labels to Fadoua for the click path.
Do not edit her acceptance ledger; provide observed results for her to record.

Run `npm --prefix frontend test` (or focused Vitest while developing) and production
build after relevant code changes. Record focused/full command distinction. Handoff:
branch/SHA, changed paths, test result, integrated screenshot references, exact blocked
data checks and any shared-owner request. Done means required evidence/actions/incidents
render correctly and the actual seeded/browser flows are verified on a pinned candidate.
