# Team update — six active members

**As of:** November 14, 2026. **Base:** `origin/main` at `6eaaed8`.
This file overrides owner names, branch suggestions and path restrictions in the role
briefs and in `space-apps-two-day-team-plan.md`. Technical requirements, the runtime
contract, rule settings, examples, acceptance criteria and the deadline are unchanged.

## What changed

- **Hajar is not available.** Fadoua owns the synthetic crew fixture.
- **Amine is back.** The dashboard returns to Amine; Hamza no longer owns it.
- **Nassim joins as the frontend lead.** He owns the shared UI/UX layer, the visual
  state gallery and frontend integration/QA. Hamza keeps the RadLab importer and the
  end-to-end harness. See [Nassim's brief](07-nassim-frontend-ui-ux.md).
- The active team is **El Mahdi, Hamza, Amine, Mohsine, Fadoua and Nassim**.

## Current ownership

| Owner | Responsibilities | Owned paths |
|---|---|---|
| El Mahdi | Contract, engine, policy, independent fixture checks, PR review, all merges | `contracts/`, `backend/engine/`, `rules/`, `tests/engine/` |
| Hamza | API routes, SQLite persistence, fixture loader, RadLab archive/importer, E2E harness, shell/adapter, launch wiring, manifests | `backend/api/`, `backend/storage/`, `backend/replay/`, `fixtures/radlab/`, `tests/api/`, `tests/replay/`, `tests/e2e/`, `frontend/src/api/`, `frontend/src/shell/`, `frontend/src/App.tsx`, `frontend/src/main.tsx`, shared build/launch files |
| Amine | Dashboard logic, readings, replay controls, **Why?** drawer behavior, incident list | `frontend/src/dashboard/` and colocated tests |
| Mohsine | Crew check-in and local reaction task | `frontend/src/checkin/` and colocated tests |
| Fadoua | Crew fixture and checks, evidence, acceptance, pitch, recording | `fixtures/crew/`, `tests/fixtures/`, `evidence/`, `acceptance/`, `demo/` |
| Nassim | Shared UI kit and design tokens, visual state gallery, dashboard/check-in presentation, accessibility, responsive/offline visual QA | `frontend/src/ui/` and colocated tests |

Only El Mahdi merges. Branch from `origin/main` (`6eaaed8`), never from this docs branch.
Keep existing work on `build/replay-api`, `build/checkin` and `build/demo-qa`; Amine uses
`build/dashboard`; Nassim uses `build/frontend-ui`.

## Verified status on `main` (`6eaaed8`)

Checks re-run on a clean worktree of `origin/main`:

| Area | Status | Evidence |
|---|---|---|
| Contract and examples | **Pass** | `contracts/v1.md` merged; D1, D3–D6 settled; D2 settled by this update |
| Deterministic engine | **Pass** | 43 engine tests inside the merged suite; A02–A04/B01–B04 at engine level |
| API, runs, submissions, persistence | **Pass** | PR #6 merged; `backend/storage/store.py`, unique `(run_id, submission_id)` |
| Replay shell and clock | **Pass** | PR #6 merged; `frontend/src/shell/` |
| Crew check-in component | **Pass** | PR #5 merged; 41 `node --test` checks |
| Build and test commands | **Pass** | `pytest tests -q` → 66 passed + 26 subtests; `npm test` → 11 Vitest + 41 node; `npm run build` → exit 0 |
| Dashboard | **Blocked** | No `frontend/src/dashboard/`; Amine starts now |
| Shared UI kit | **Blocked** | No `frontend/src/ui/`; Nassim starts now |
| Canonical crew fixture | **Blocked** | No `fixtures/crew/`; D2 now unblocked |
| RadLab archive and importer | **Blocked** | CSV absent; no `backend/replay/`; A01 blocked |
| Integrated A02–A04, B01–B04 | **Blocked** | No seed loader, no dashboard |
| B05 / X01 offline demo | **Blocked** | No integrated app or documented launch |
| End-to-end harness | **Not run** | Does not exist yet; Hamza owns it |

Empty behavioral runs still return a contract example labeled **Fixture preview**. That is
not a seeded or integrated pass.

## Decisions closed in this update

- **D2 is settled** in `contracts/v1.md`: the fixture is one object
  `{schema_version, fixture_id, scenario_id, subject_id, observations}`; reaction rows are
  `base-reaction-1`…`base-reaction-5` and `reaction-10`. Fadoua writes it; Hamza loads it.
- **D1 is settled**: importer IDs are `{source_id}:{normalized UTC timestamp}`; Hamza
  implements the importer.
- D3–D6 are confirmed; D8 is implemented in persistence but its retry status codes are
  confirmed at integration. **D7 and D11 remain pending** (history transport, final UI
  labels).

## Allocation and order

1. **Fadoua:** write `fixtures/crew/sleep-vigilance.json` to the published D2 shape with
   the 14 canonical rows and variant checks. Hand the path and command to Hamza and El
   Mahdi, then continue evidence/acceptance/pitch work.
2. **Hamza:** implement HZ-11 and finish the API state path; then obtain/verify the RadLab
   archive, implement the importer and A01–A04, and build the one-command E2E harness.
   Publish dashboard props and keep the offline launch working. If the archive is
   unreachable or its hash differs, report **Blocked** with the exact observed hash.
3. **Amine:** build the minimal dashboard from the two contract examples against labeled
   stub props, then wire Hamza's shell. Compose Nassim's shared components rather than
   duplicating their CSS or markup.
4. **Mohsine:** finish check-in/reaction wiring against the published callback; use the
   shared UI components; publish control labels for D11.
5. **Nassim:** build `frontend/src/ui/` (tokens, provenance/status/evidence/action
   primitives, accessible drawer), the static state gallery and the responsive/offline
   visual pass. Pair with Amine and Mohsine; do not edit their feature logic or the API.
6. **El Mahdi:** independently verify Fadoua's fixture with the engine, review and merge
   small PRs, keep the contract stable, and run the first integrated A/B flow with Hamza.

Parallelism: fixture, frontend UI kit/dashboard and RadLab import are independent. The
first integration gate is a RadLab run at `23:20:00` plus a seeded crew run at `09:01:00`.

## Acceptance ownership

| Check | Owners |
|---|---|
| A01 | Hamza, Fadoua |
| A02 | El Mahdi, Hamza |
| A03, A04 | El Mahdi, Amine, Hamza, Nassim (visual) |
| B01, B04 | El Mahdi, Mohsine, Amine, Hamza |
| B02 | El Mahdi, Fadoua, Hamza |
| B03 | El Mahdi, Fadoua, Mohsine |
| B05 | El Mahdi, Hamza, Mohsine |
| X01 | Hamza, Amine, Fadoua, Nassim |

Record each check as exactly **Pass**, **Fail**, **Blocked** or **Not run** with the build
SHA, scenario timestamp, command/click path and observed result.

## Next checkpoint

- Fadoua: fixture and variants ready for El Mahdi's independent engine check.
- Hamza: loader merged; behavioral run returns seeded state, not preview; A01 status explicit.
- Amine: both example states render; recovery and missing-input flows clickable.
- Mohsine: check-in submits through the real route with 201/200/409 behavior.
- Nassim: UI kit and state gallery ready for Amine/Mohsine; visual QA matrix started.

Deadline: **November 15, 2026, 23:59 Morocco local time**. Internal feature freeze
**20:59**, offline acceptance and recording target **21:59**, submission target **22:59**.
