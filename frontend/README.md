# Astro Vital frontend shell

Shell/API adapter: Hamza. Dashboard: Amine. Check-in: Mohsine. Shared UI kit, state
gallery and frontend integration/QA: Nassim.

| Path | Role |
|---|---|
| `src/api/` | Shared types (`types.ts`) and the only `fetch` layer (`client.ts`) |
| `src/shell/` | Replay clock, run lifecycle, stale-response discard, source history (D7) |
| `src/ui/` | Design tokens and presentational primitives (badges, source card, assessment, evidence, actions, incidents, drawer, messages) |
| `src/dashboard/` | Composes the kit from `DashboardProps`; never fetches |
| `src/checkin/` | Crew check-in and local reaction task; mounted per run (`key={run.run_id}`) |
| `src/gallery/` | Static **Fixture preview** state gallery at `/?gallery` |

## Commands

From `frontend/`:

```bash
npm install
npm run dev     # Vite on loopback, proxies /api to 127.0.0.1:8000
npm run build   # tsc --noEmit && vite build
npm test        # Vitest (src/**/*.test.{ts,tsx}, jsdom per file) + node --test (check-in)
```

DOM tests use `jsdom` (the only added dev dependency) with a small helper in
`src/test/dom.tsx`; files opt in with `// @vitest-environment jsdom`. jsdom has no
`<dialog>` modal API, so the helper stubs `showModal`/`close`; real focus containment and
Escape are checked in a browser.

Static state gallery (no API needed): `npm run dev`, then open `/?gallery`. States come from
the contract examples and from `src/gallery/generate_states.py`, which runs the real engine
on the engine tests' synthetic inputs (`python frontend/src/gallery/generate_states.py`).

## Adapter contract

- `src/api/types.ts` publishes `StateEnvelope`, `Observation`, `SourceStatus`,
  `Evidence`, `Assessment`, `Action`, `Incident`, `Run`, `SubmissionRequest`,
  `SubmissionResponse`, `DashboardProps` and `CheckInProps`. Import from here;
  do not redeclare shapes in feature folders.
- `src/api/client.ts` is the only layer that calls `fetch`. It owns run creation,
  state reads, history reads and submissions, and surfaces `422`/`404` messages
  through `ApiError`.
- `src/actions.ts` routes `view_source_history` → `history`,
  `start_reaction_check` → `checkin`, `review_available_inputs` → `evidence`.

### D7 — history reaches the dashboard as a prop

The shell owns HTTP. `useSourceHistory` reads the selected source (default: the first in
`state.sources`), calls `getObservations(runId, { asOf: clock, sourceId, metric, limit })`
and passes `history`, `historyStatus` and `historyError` to the dashboard. A response for an
older run, clock or source is discarded. The dashboard never fetches and never filters by
time.

### Visible state

`useReplay().state` is only ever the envelope for the active run, scenario and clock
(`stateForView`). During a seek it is withheld; after a failed request it is cleared and the
error names the clock that has no state. A superseded request's failure is ignored.

### D8 — `submission_id` format

Caller-generated, opaque, `1–128` characters from `[A-Za-z0-9._:-]`, first
character alphanumeric. Use `crypto.randomUUID()`. The feature that owns the retry
(the check-in form) mints the ID and reuses it with the same `observed_at` and entry
payload after a network error; the shell forwards the payload unchanged instead of
minting a new ID. The server treats a changed payload under the same ID as a conflict.

### Action fallback

`CheckInProps.onAction` is required: the check-in calls it with
`review_available_inputs` when `local_reaction_task` is disabled, and the shell routes
it to the evidence drawer.

## Fixture preview and seeded runs

A run reports `X-Data-Mode: integrated` only when the backend actually loaded seed rows:
the canonical crew fixture (`fixtures/crew/sleep-vigilance.json`, 14 synthetic rows) for
`sleep_vigilance`, or the verified RadLab archive for `radlab_stale`. With those inputs the
state is real engine output and replay works.

An empty run instead returns its contract example labeled `X-Data-Mode: fixture-preview`,
with the example's own `as_of` (a fixed snapshot, not the requested clock). The shell moves
the clock to that snapshot time, keeps the **Fixture preview** badge and a snapshot note
visible, and disables checkpoints, because the example cannot be replayed.

To run the whole app on one loopback origin, build once and launch from the repository
root: `npm --prefix frontend run build && python run.py --no-build`.

To exercise B04 (reaction resource disabled) start the API with
`ASTRO_VITAL_RESOURCES='{"local_reaction_task": false}'`; tests pass
`create_app(resources={...})`. Unknown resources or non-boolean values are rejected.
