# Preview API (HZ-04 stub)

FastAPI stub for the four contract endpoints. State and history come from
`contracts/examples/`; nothing is persisted yet. HZ-08/HZ-09/HZ-12 replace the
source, the evaluator call and the submission store.

## Run

From the repository root:

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r backend/requirements.txt
.venv/Scripts/python -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8000
```

On POSIX use `.venv/bin/python`. Test with
`.venv/Scripts/python -m pytest tests -q`.

## Endpoints

| Request | Stub behavior |
|---|---|
| `POST /api/v1/runs` | `201` with `run_id`, `scenario_id`, `initial_as_of`, `range_start`, `range_end`; unknown scenario `422`; in-memory run registry |
| `GET /api/v1/runs/{run_id}/state?as_of=` | `200` with the scenario's contract example, `run_id`/`as_of` replaced; unknown run `404`; malformed or out-of-range clock `422` |
| `GET /api/v1/runs/{run_id}/observations?as_of=&source_id=&metric=&limit=180` | matching example rows up to `as_of`, newest `limit` rows returned chronologically |
| `POST /api/v1/runs/{run_id}/observations` | behavioral runs only; validates source/metric/unit/timestamp and returns fresh IDs; not stored, so `200`/`409` retries are still HZ-12 |

## Fixture preview label

Every response carries:

```
X-Data-Mode: fixture-preview
X-Data-Source: contracts/examples
```

This is what makes a preview run distinguishable from an integrated one. The
label must disappear when the engine is wired; an integration check that still
sees it is a preview, not an accepted run.

## Known stub limits

- `state` ignores the seek time inside the range and returns the example
  envelope, so ages/incidents are only correct at the example's `as_of`.
- `limit` is capped at 180 and rejects larger values, which the contract does
  not currently require.
- Submissions are not stored and never return `200`/`409`.
