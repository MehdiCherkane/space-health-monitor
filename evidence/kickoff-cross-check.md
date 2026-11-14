# Contract example cross-check

**For El Mahdi · FD-02 · Reviewed build `fd1da9690a5d3b28af5c7353a87114be977a6589`**

**Pass.** No discrepancies found between the two [contract examples](../contracts/examples/) and the matching JSON blocks and applicable demo instructions in the [team plan](../plans/space-apps-two-day-team-plan.md). This review covers the example envelopes and arithmetic.

| Check | Observed result |
| --- | --- |
| Example A at `2022-04-01T23:20:00Z` | DosTel1 is stale at `455 s` from `23:12:25Z`. DosTel2 is current at `0 s` from `23:20:00Z`. Both readings have null subjects and historical provenance. |
| Example A incident | `23:12:25Z + 300 s = 23:17:25Z`, still current. Adding one second gives `23:17:26Z`, the opening time. The incident is open with no closure, and both supporting observations resolve by ID. |
| Example B at `2026-01-10T09:00:00Z` | Median of 450, 440, 450, 460 and 445 is `450 min`. The 380, 370 and 420 min readings are `70`, `80` and `30 min` below it. Two slots meet the 60-minute setting. All eight evidence references resolve. The current reaction is missing, the state is `insufficient_data`, and **Run reaction check** is available. |
| Planned sample at `2026-01-10T09:01:00Z` | Median of 245, 250, 255, 248 and 252 is `250 ms`. The seeded `310 ms` result is `(310 − 250) / 250 × 100 = 24%` above it. Both prototype conditions are true and the engine test returns `watch`. Example B is the earlier 09:00 snapshot and contains the eight sleep observations referenced there. |

Verification from the repo root used the script in [Kickoff handoff → Verification](../contracts/kickoff-handoff.md#verification) with explicit UTF-8 reads on Windows. It compared the examples byte for byte and checked evidence IDs, ages, the incident boundary and the baseline arithmetic. `python -B -m unittest discover -s tests/engine -q` passed all 43 tests, including the seeded result, boundary and rewind cases.

| Blocked check | Exact dependency | Owner | Needed to proceed |
| --- | --- | --- | --- |
| A01 and archive-backed A02–A04 | The linked `iss-radlab-dostel-2022-04-01.csv` returns file not found. It is absent from the reviewed tree. | Hamza | Provide the pinned raw CSV and importer verification. Use the file to derive the actual recovery time. |
| Integrated B02 | `fixtures/crew/sleep-vigilance.json` is absent from the reviewed tree. The current engine test uses test-only reaction rows. | Fadoua + Hamza | D2 is settled: Fadoua writes the canonical 14-row fixture, Hamza loads it (HZ-11). |
| Exact click paths, wording, B05 and X01 | The reviewed tree contains the evaluator and policy. The app launch command, API/persistence and integrated dashboard and check-in are pending. | Hamza, Amine and Mohsine | Provide the merged app, launch command and control labels. |
