# Runtime API

FastAPI + SQLite for the two demo scenarios. Runs, submitted observations and
submission IDs live in `backend/storage/astro-vital.db` (override with
`ASTRO_VITAL_DB`). Seed data is still missing, so a run with no observations returns
its contract example as **Fixture preview**; the header changes to
`X-Data-Mode: integrated` as soon as the run holds observations and the merged engine
evaluates them.

## Run

From the repository root:

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r backend/requirements.txt
```

One command for the offline demo (build once, then serve shell + API on loopback):

```bash
npm --prefix frontend run build && .venv/Scripts/python -m uvicorn backend.api.main:create_app --factory --host 127.0.0.1 --port 8000
```

On POSIX use `.venv/bin/python`. Open `http://127.0.0.1:8000/`. Expected shell screen:
**Astro Vital**, a data-mode badge, two scenario buttons, the checkpoint buttons
(`23:12:25`, `23:20:00`, `23:30:00` for RadLab; `09:00`, `09:01` for behavioral), the
current clock, the returned source lines and the assessment title. A run with no
observations shows **Fixture preview**. Tests: `.venv/Scripts/python -m pytest tests -q`.

## Behaviour

| Request | Behavior |
|---|---|
| `POST /api/v1/runs` | `201` and the run record; every run gets its own ID and an empty observation set (reset = new run) |
| `GET /api/v1/runs/{run_id}/state?as_of=` | `200`; with observations, calls `backend.engine.evaluate` on the observations visible at `as_of` and returns its envelope unchanged. Empty run: the scenario's contract example, marked preview. Unknown run `404`; malformed/out-of-range clock `422` |
| `GET /api/v1/runs/{run_id}/observations?as_of=&source_id=&metric=&limit=180` | newest matching rows up to `limit`, then chronological |
| `POST /api/v1/runs/{run_id}/observations` | behavioral runs only; validates source/metric/unit/timestamp, derives subject `crew-demo-1` and provenance (`SYNTHETIC` for sleep/self-report, `LIVE_MEASURED` for `reaction_task`), stores the batch in one transaction. First insert `201`, identical retry `200` with the same IDs, changed payload under the same `submission_id` `409` |

Every submission observation ID is `{submission_id}:{position}`; the format is not fixed
by `contracts/v1.md` and needs confirmation with El Mahdi.

## Data modes

```
X-Data-Mode: fixture-preview      empty run, contract example
X-Data-Mode: integrated           engine output from stored observations
X-Data-Source: contracts/examples only in preview mode
```

An evaluator failure is a server error; it never falls back to the example. Integration
checks must fail on it.

## Not wired yet

- `backend/replay/` RadLab importer: blocked on the archive hash (computed
  `2d1c5d96…` vs the plan's `be735636…`), so A01 and the RadLab checkpoints are Blocked.
- `fixtures/crew/sleep-vigilance.json` (Hajar): blocked, so behavioral runs start empty
  and report missing baselines instead of inventing them.
- `backend/engine` and `rules/demo-v1.json` are read-only here; the API calls them.
