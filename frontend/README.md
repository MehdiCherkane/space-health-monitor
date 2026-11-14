# Astro Vital frontend shell

Owner: Hamza. The shell, `src/api/types.ts` and `src/api/client.ts` are shared;
`src/dashboard/` (Amine) and `src/checkin/` (Mohsine) mount into it.

## Commands

From `frontend/`:

```bash
npm install
npm run dev     # Vite on loopback, proxies /api to 127.0.0.1:8000
npm run build   # tsc --noEmit && vite build
npx vitest run  # adapter and action-routing tests
```

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

The shell owns HTTP. It reads the selected source from `state.sources`, calls
`getObservations(runId, { asOf: clock, sourceId, metric, limit })` and passes the
result to the dashboard as `history: Observation[]` (already chronological and
visible at `clock`). The dashboard never fetches and never filters by time.
`props.history` may be empty before the first history request.

### D8 — `submission_id` format

Caller-generated, opaque, `1–128` characters from `[A-Za-z0-9._:-]`, first
character alphanumeric. Use `crypto.randomUUID()`. The feature that owns the retry
(the check-in form) mints the ID and reuses it with the same `observed_at` and entry
payload after a network error; the shell forwards the payload unchanged instead of
minting a new ID. The server treats a changed payload under the same ID as a conflict.

### Action fallback

`CheckInProps.onAction` is optional: the check-in calls it with
`review_available_inputs` when `local_reaction_task` is disabled, and the shell routes
it to the evidence drawer.

## Fixture preview

The preview API labels every response `X-Data-Mode: fixture-preview`. The shell
must keep a **Fixture preview** label visible until the evaluator replaces the
example source in HZ-08; only then may it show an integrated run.
