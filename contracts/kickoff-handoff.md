# El Mahdi kickoff handoff

Update after kickoff: PR #1 is merged at `533309242e58985dfa919225b9c2d515c7585872`.
El Mahdi confirmed the interface in the working session. The initial statuses below
describe the kickoff review; see [engine handoff](engine-handoff.md) for current progress.

Branch: `build/engine`

Upstream base: `c7d389c5fa6152e3936024335c6b52724b30b40c`

Scope: EM-01–EM-05 preparation and the concrete agreement required by EM-06.

This handoff publishes a **proposed** contract and the plan's unchanged preview states.
Hamza has not started yet; no evaluator/API agreement or teammate review is claimed.
The branch commit is a review candidate, not an approved shared base or submission build.

## Files

- `contracts/v1.md`: runtime requirements, proposed evaluator boundary, decisions,
  ownership, schedule and outstanding confirmations.
- `contracts/examples/radlab-stale.json`: exact Example A from the team plan.
- `contracts/examples/sleep-vigilance-missing.json`: exact Example B from the team plan.
- This handoff: verification and next steps.

No dependencies, shared app files, production fixtures or engine implementation are
included. The original source snapshot has been restored to an exact shallow Git
checkout at the upstream base; `git fsck --full` checks its object integrity.

## Smallest review needed from Hamza

Review the proposed evaluator section of `contracts/v1.md` and confirm or amend:

1. `backend.engine.evaluate(scenario_id, run_id, as_of, observations, resources, policy)`
   with plain JSON-compatible dictionaries/lists and a State dictionary result.
2. Complete visible input history, boolean resource map, and externally loaded policy
   from the proposed `rules/demo-v1.json` location.
3. D1 stable importer IDs, D4 `metadata.captured_at`, and D6 `422` scope/time errors.
4. The Example B input/output distinction and the disabled-resource interpretation.

Hamza also supplies frontend props/types and chooses the test/dependency setup in his
owned paths. Hajar and Hamza still own the crew seed shape and reaction observation IDs.
Fadoua cross-checks the examples and arithmetic independently.

After agreement, record who confirmed which decisions, update the contract status and
publish the accepted commit SHA. Do not treat the pending proposals as approved merely
because they are committed.

## Verification

From the repository root, this dependency-free check verifies the two exact source
blocks, referenced observation IDs and the plan's demo arithmetic:

```bash
python3 - <<'PY'
import json
import re
from datetime import datetime
from pathlib import Path
from statistics import median

plan = Path('plans/space-apps-two-day-team-plan.md').read_text()
blocks = re.findall(r'```json\n(.*?)```', plan, re.S)
names = ('radlab-stale.json', 'sleep-vigilance-missing.json')
assert len(blocks) == len(names)
states = []
for name, block in zip(names, blocks):
    path = Path('contracts/examples') / name
    assert path.read_bytes() == block.encode(), f'{name}: differs from plan'
    state = json.loads(block)
    ids = [row['id'] for row in state['observations']]
    assert len(ids) == len(set(ids)), f'{name}: duplicate IDs'
    for assessment in state['assessments']:
        for evidence in assessment['supporting_evidence'] + assessment['conflicting_evidence']:
            assert set(evidence['observation_ids']) <= set(ids)
    states.append(state)
radlab, crew = states
parse = datetime.fromisoformat
for source in radlab['sources']:
    row = next(r for r in radlab['observations'] if r['id'] == source['last_observation_id'])
    assert (parse(radlab['as_of']) - parse(row['observed_at'])).total_seconds() == source['age_seconds']
gap = radlab['incidents'][0]
last = next(r for r in radlab['observations'] if r['id'] == gap['last_observation_id'])
assert (parse(gap['opened_at']) - parse(last['observed_at'])).total_seconds() == 301
assert median([450, 440, 450, 460, 445]) == 450
assert median([245, 250, 255, 248, 252]) == 250
assert sum(450 - value >= 60 for value in [380, 370, 420]) == 2
assert (310 - 250) * 100 / 250 == 24
assert crew['assessments'][0]['missing_inputs'] == ['reaction_time']
print('Pass: 2 exact examples, evidence references, source ages, gap boundary and baseline arithmetic')
PY
```

Also run `git diff --check` and inspect the branch diff against the upstream base.
These are contract checks. They do not verify the engine, API or historical archive.

| Check | Status at kickoff | Result / dependency |
|---|---|---|
| EM-01 checkout and scope | Pass | Exact upstream shallow checkout; branch `build/engine`; owned implementation folders did not exist |
| EM-02 deadline | Pass | User confirmed Nov 15, 2026 at 23:59 Morocco time; 15 working hours total |
| Internal checkpoints | Pass | Contract records 20:59 freeze, 21:59 offline/recording target, 22:59 internal submission |
| EM-03 / EM-04 examples | Pass | Verification above passed: exact source blocks, JSON parsing, evidence references, ages, gap boundary and baseline arithmetic |
| EM-05 contract review | Blocked | Concrete document prepared; joint decisions await Hamza, example cross-check awaits Fadoua |
| EM-06 accepted shared base | Blocked | Hamza has not started; evaluator/API agreement pending |
| A01 real archive import | Blocked | Required RadLab CSV is absent from the repository; Hamza obtains and verifies it |
| A02–A04, B01–B04 engine | Not run | EM-07 onward follows the interface agreement |
| B05 persistence / X01 offline app | Blocked | Hamza's app and teammate components are not yet implemented |
| Existing research pytest suite | Not run | `python3 -m pytest --version` reports `No module named pytest`; no dependencies installed |

## Work after the agreement

- **El Mahdi:** EM-07 policy → EM-08 selection → EM-09–EM-11 freshness/incidents →
  EM-12–EM-14 behavioral/missing/comparability paths → EM-15 tests and EM-16 explanation.
- **Hamza:** shared shell/types and preview endpoints; obtain the actual RadLab CSV
  immediately, then importer, SQLite and evaluator wiring.
- **Amine / Mohsine:** work in their respective feature folders from the examples,
  agreed props and labeled stub callbacks.
- **Hajar:** finalize the 14-row fixture after D2/D3 and seed shape are settled.
- **Fadoua:** evidence review and acceptance/pitch preparation; final verification
  must use the merged build with Wi-Fi disabled before launch.

Use the first integrated checkpoint for the real RadLab flow. Preserve the seeded
behavioral walkthrough before live reaction-task polish. Reserve the last two working
hours for integration fixes, offline checks, recording and submission; defer charts,
continuous playback and local AI if they threaten that window.
