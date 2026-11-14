# Six-agent finish plan — start here

Audit base: `main` at `60898075b5508a9d9e5b46da15e1637aefa67ee2`.
Open candidates: PR #10 `f83a260285286dbdaeda9481a84bc1ec2ca33e5f` and
PR #11 `d99c549bb281aaedc8676c5a8793c1b784067158`.
Prepared November 14, 2026 after source review and independent agent audits.

Follow-up: [PR10 independent review](PR10-INDEPENDENT-REVIEW.md) now records a fresh
full backend pass for main + PR10 and the reproduced combined-candidate failures.
[Hamza's exact session prompt](HAMZA-COPY-PASTE-PROMPT.md) is ready to paste.

This is the current execution assignment for **six agents**, one session per member.
It supersedes the old build-from-scratch task order and overlapping ownership in
`plans/team-update.md` and the original role briefs. Use those documents for domain
reference; use `contracts/v1.md` and `rules/demo-v1.json` for runtime behavior.
Do not rebuild the already merged dashboard, UI kit, check-in, engine or persistence.

## Dispatch

Give each agent the repository path, this file and exactly its named plan:

| Session | Plan | Exclusive implementation responsibility | First delivery |
|---|---|---|---|
| El Mahdi's agent | [01](01-el-mahdi-archive-and-release.md) | Actual RadLab archive, importer/replay proof, engine defects, contract decisions and merge coordination | Archive status + PR10 independent gate |
| Hamza's agent | [02](02-hamza-runtime-integration.md) | PR11 API/storage/loader, launcher/E2E, shared shell/adapter/manifests | Combined PR10+11 test isolation and truthful harness |
| Amine's agent | [03](03-amine-dashboard-verification.md) | Dashboard behavior and dashboard tests | Focused dashboard regression coverage |
| Mohsine's agent | [04](04-mohsine-checkin-verification.md) | Check-in/reaction component behavior and tests | Completed-result restart availability fix |
| Fadoua's agent | [05](05-fadoua-fixture-evidence-submission.md) | PR10 fixture, fixture tests, evidence/acceptance/pitch/recording | PR10 fixture handoff, final acceptance ledger draft |
| Nassim's agent | [06](06-nassim-browser-quality.md) | Shared UI/gallery, real-browser accessibility/visual verification | Browser verification matrix and actual UI defects |

**Ownership change for this finish:** El Mahdi's agent takes `backend/replay/importer.py`,
`fixtures/radlab/`, `tests/replay/test_importer.py`, `tests/replay/test_radlab_run.py`.
Hamza keeps `backend/replay/loader.py` and `backend/replay/__init__.py` plus integration.
They must coordinate imports through Hamza. This divides the two critical work streams.
Other agents report shared-shell/API defects to Hamza; they do not patch his files.

## Workspace and execution rules for every session

1. Read the audit report, assigned plan, current contract and relevant actual code.
   Inspect branch, status and existing work before editing. You are not alone in this
   repository: preserve other people's changes and accommodate their interfaces.
2. Use a separate clone/worktree per agent. Never switch another running agent's branch.
   Fetch the real current `main`; record its SHA. If an open PR moved after this audit,
   inspect that diff before applying old findings. Do not overwrite updated work.
3. PR10 and PR11 remain unmerged at the audit snapshot. Only El Mahdi's release session
   merges. Inspect the combined candidate on an isolated checkout; a pass on an old
   branch does not prove the combined build. Never force-push over another owner.
4. Use existing dependencies and runners. Coordinate shared manifest/lockfile changes
   with Hamza. A blocked environment is reported with command, error and owner; it does
   not license skipping checks or claiming they passed.
5. No new scenarios, charts, body figure, wearable/live feeds, AI paraphrase or redesign.
   Existing Why, source history, provenance, unavailable fallback, reset and rewind are
   required. Only fix defects that affect those flows or the final demo.
6. Keep fixture-preview, synthetic integrated data, real historical imports and live
   device capture visibly distinct. Never change provenance or thresholds to obtain
   an attractive outcome. A live browser result need not trigger watch.
7. Report every check as Pass / Fail / Blocked / Not run, with SHA, command or exact
   click path, scenario time and observed result. If only a preflight ran, name it a
   preflight. X01 requires actual offline browser rehearsal before a Pass.
8. Send the coordinator a short progress packet every 30–45 minutes or on a dependency
   change: done / next / blocker and owner / next verifiable delivery / estimate.
   At completion provide branch+SHA, changed paths, commands/results, screenshots or
   logs, remaining dependencies and a focused PR. Do not merge your own feature PR.

## Parallel waves and merge gates

Times are working-time estimates from dispatch, not promises or event times.

| Window | Work | Gate |
|---|---|---|
| T+0–30 min | All agents inspect; El Mahdi checks PR10; Hamza combines #10/#11; frontend agents begin focused tests; Fadoua finalizes fixture handoff; Nassim verifies current UI | Actual SHAs pinned; archive availability explicitly known |
| T+30–120 min | Hamza fixes PR11 blockers; El Mahdi obtains/validates archive and corrects importer; Amine/Mohsine fix bounded defects; Fadoua works evidence/pitch; Nassim browser checks | PR10 merged first; PR11 candidate has truthful checks and both seeds loading |
| T+120–240 min | Merge passing backend, importer and component fixes; run full combined tests/build; browser crew scenario then real RadLab scenario | Release candidate with seeded API and real historical replay or an explicitly recorded archive blocker |
| T+240–360 min | Shared offline walkthrough, repeat launch/reset, evidence capture and recording; fix only release blockers | Final SHA, acceptance ledger, recording and submission package |

Estimated remaining effort: **16–24 agent-hours**, normally **4–6 elapsed working hours
with six sessions**, plus an unknown delay if the pinned archive cannot be recovered.
Do not confuse these with the earlier 15-hour total team work budget; elapsed/used
hours were not tracked here. Component work can finish while archive work is blocked.
Keep the final two working hours protected for rehearsal, recording and submission.

Deadline supplied by El Mahdi: **Nov 15, 2026, 23:59 Morocco local time**. Existing
internal checkpoints: feature freeze 20:59, offline/recording target 21:59, submission
target 22:59. Aim to finish substantially before those latest checkpoints.

## Release acceptance

- PR10 canonical fixture passes 13 checks and the engine suite; exact B01/B02 states.
- PR11 plus fixture passes the complete backend suite, including older empty-run tests
  with explicit isolated inputs; frontend default test command and production build pass.
- Actual archive verifies pinned SHA and 84/96 records. Real A02–A04 run without mocking
  the verifier; recovery time comes from the file, and rewind reveals no future closure.
- Browser B01/B02/B04 and submission/retry/reset flows work on the same candidate SHA.
- Keyboard reaction capture keeps mission time and actual capture metadata separate;
  incomparable data stays pending; unavailable resource cannot start/restart a task.
- Native drawer keyboard/focus, small-screen readability, no console failures and
  loopback requests are checked on the production build.
- Wi-Fi/network disabled before prepared launch; both scenarios and fresh reset repeat
  successfully. Record X01 separately from API tests and asset scans.
- Claims, screenshots, two-minute recording and submission copy match this exact build.

If the archive remains missing, the behavioral scenario can still become a complete
integrated demo. RadLab remains an explicit preview with A01/A02–A04 Blocked; the pitch
must not present that preview as verified historical replay. Escalate the data decision
early instead of using the final rehearsal window to search for the file.
