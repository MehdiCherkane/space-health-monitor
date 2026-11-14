# Engine handoff — El Mahdi

Branch: `build/engine`. Kickoff base: `533309242e58985dfa919225b9c2d515c7585872`.
El Mahdi confirmed the interface after PR #1 was merged. EM-07–EM-16 are implemented
within `backend/engine/`, `rules/`, `tests/engine/` and `contracts/`.

## Hamza: evaluator integration

From the repository root:

```python
import json
from pathlib import Path
from backend.engine import evaluate

policy = json.loads(Path('rules/demo-v1.json').read_text(encoding='utf-8'))
example = json.loads(Path('contracts/examples/radlab-stale.json').read_text(encoding='utf-8'))
state = evaluate(
    example['scenario_id'], example['run_id'], example['as_of'],
    example['observations'], policy['resources'], policy,
)
assert state == example
```

This is an example-state check, not a real CSV replay. For integration, pass the full
visible run/scenario history, explicit clock, resource map and loaded policy. Never
truncate evaluator input to the chart endpoint's history limit. Required fields and
submission shape are validated by the API; invalid evaluator calls must surface as
errors rather than silently returning a preview fixture.

Use `resources={"local_reaction_task": False}` to exercise B04 at 09:00. Omitting a
resource also means unavailable. A later browser-keyboard capture is incomparable
with the seeded baseline; keep it in history and expect `insufficient_data`.

## Verification

```bash
python3 -m unittest discover -s tests/engine -v
```

Result: **Pass — 43 tests** on Python 3.14.9. Tests use standard-library `unittest`
and remain discoverable by pytest once the shared environment is installed. No
dependencies or manifests changed. The existing research suite was not run: pytest
and that pipeline's dependencies are not installed in this checkout.

| Check | Engine status | Coverage and integration limit |
|---|---|---|
| A02 | Pass | 300/301-second boundary and new reading on the transition second |
| A03 | Pass | Exact Example A, ages, evidence, one incident per gap, stable IDs |
| A04 | Pass | Synthetic recovery, repeated evaluation and rewind with no future closure |
| B01 | Pass | Exact Example B from full test input, missing current reaction, baseline evidence |
| B02 | Pass | Synthetic 310 ms sample versus 250 ms; two qualifying sleep nights; both baseline references |
| B03 | Pass | 270 ms observed, missing night/baseline and incomparable task/profile insufficient |
| B04 | Pass | Disabled/missing resource, unavailable reason and available input-review fallback |
| A01 | Blocked | Real RadLab CSV is absent; Hamza owns acquisition, checksum/count verification and import |
| A02–A04 / B01–B04 integrated | Blocked | API/UI wiring and Fadoua's canonical crew fixture remain external dependencies |
| B05 / X01 | Blocked | Persistence, local app build and offline walkthrough belong to the integration phase |

Additional checks cover input/output isolation, input permutation, timestamp/ID
selection, nonfinite data rejection, empty input, wrong units/subject, fixed baselines,
inclusive session limits, incomplete tasks, invalid trial metadata, latest-result
selection and policy changes. Both contract example files remain unchanged.

## Fadoua: fixture first, then evidence/demo work

Follow the [team update](../plans/team-update.md). Use both
`plans/05-fadoua-synthetic-fixture.md` and `plans/06-fadoua-evidence-demo-acceptance.md`
on `build/demo-qa`. D2 and D3 are settled in `contracts/v1.md`; write the canonical
14-row fixture to that shape and checks; El Mahdi independently verifies the engine results. You now own
`fixtures/crew/`, `tests/fixtures/`, `evidence/`, `acceptance/` and `demo/`.
Then continue the evidence/demo tasks below.

1. Cross-check examples and demo arithmetic (FD-02).
2. Build the claim/source table and verify `EVID_SLEEP_003` / `EVID_COG_001` against
   their actual cited sources (FD-03/FD-04); registry inclusion alone is not verification.
3. Draft A01–A04, B01–B05 and X01 acceptance steps (FD-05). Mark integrated execution
   **Blocked** until the application exists; confirm final control names with UI owners.
4. Prepare the two-minute pitch from verified or explicitly synthetic claims (FD-07).

Screenshots, final wording checks, offline acceptance and the backup recording need
the merged integrated app. For each actual run record the build SHA, scenario time,
command/click path and Pass/Fail/Blocked/Not run. Do not report the engine test suite
as historical archive verification or a passing end-to-end demo.

## Remaining handoffs

- Fadoua writes the canonical fixture to the settled D2 shape; Hamza loads it in HZ-11.
  `tests/engine/` still uses explicitly test-only IDs until the loader lands.
- Nassim owns the shared frontend UI kit and visual QA; see
  `plans/07-nassim-frontend-ui-ux.md`.
- Hamza owns shell/API/storage/launch wiring and the shared toolchain. UI/history and
  submission ID details D7/D8 remain with their owners.
- Hamza/Mohsine publish control names for Fadoua (D11).
- Hamza reviews this engine change before merge. El Mahdi owns merges and later
  submission-build approval; no final acceptance or teammate review is claimed here.
- See `rules/README.md` for calculations reproducible by hand.
