# Demo claims and sources

Source review refreshed November 14, 2026 against the sources below. Engineering status is based on [main 9c4a29e](acceptance-baseline-2026-11-14.md). The [PR #10 validation](crew-fixture-validation.md) remains a historical record.

Use the claim IDs in the [pitch](../demo/two-minute-pitch.md). Verification here names the material actually checked. Use the [acceptance checklist](../acceptance/manual-checklist.md) for the integrated build.

| ID | Claim text | Where | Type | Source | Status |
| --- | --- | --- | --- | --- | --- |
| C01 | NASA RadLab lists both DosTel instruments in the ISS Columbus module and describes absorbed dose rate as a detector measurement. | App, pitch, submission | Measured data provenance | [RadLab overview][radlab], [DosTel1][d1], [DosTel2][d2], [data dictionary][radlabapi] | **Pass** for instrument location and field units. Pinned archive verification is separate. |
| C02 | The demo uses historical detector readings from the pinned RadLab CSV. | App, pitch, submission | Measured | [Raw CSV named in the team plan][csv], [A01](../acceptance/manual-checklist.md) | **Blocked** on verified archive bytes and importer. Pinned CSV was unavailable in the reviewed source snapshot. No checksum was measured in this review. |
| C03 | At 23:20 UTC, the example shows DosTel1 stale at 455 seconds and DosTel2 current at zero seconds. The cause of the archive gap is unknown. | App, pitch | Rule output from detector readings | [Example A](../contracts/examples/radlab-stale.json), [cross-check](kickoff-cross-check.md) | **Pass** — exact Example A engine regression; historical replay remains Blocked. |
| C04 | At 23:30 UTC, the planned replay shows both sources current and retains the resolved DosTel1 incident. | App, pitch | Rule output from detector readings | [Team plan, A04](../plans/space-apps-two-day-team-plan.md#7-acceptance-checks), [recovery and rewind test](../tests/engine/test_engine.py) | **Blocked** — archive recovery unverified. Engine test uses synthetic recovery. |
| C05 | The crew history is synthetic. The sleep baseline is 450 minutes, the reaction baseline is 250 ms and the seeded result is 310 ms. | App, pitch, submission | Simulated | [Example B](../contracts/examples/sleep-vigilance-missing.json), [rule calculations](../rules/README.md), [canonical fixture](../fixtures/crew/sleep-vigilance.json), [fixture checks](../tests/fixtures/test_crew_fixture.py) | **Pass** — canonical input and medians checked against D2/D3 and team plan; see validation record. |
| C06 | At 09:00 UTC the crew assessment is pending because the current reaction result is missing. At 09:01 UTC the synthetic result is 24% above baseline and two nights meet the short-sleep condition, producing **Sleep and vigilance change**. | App, pitch | Rule output | [Example B](../contracts/examples/sleep-vigilance-missing.json), [engine tests](../tests/engine/test_engine.py), [versioned policy](../rules/demo-v1.json) | **Pass** — canonical fixture through the engine at both clocks; B01/B02 API remains Blocked on reviewed main (both requested clocks returned fixed preview, zero history). |
| C07 | A completed browser reaction check measures response time in that device session and carries **Recorded on this device**. The browser input profile differs from the seeded baseline profile, so the result remains visible with the comparison unresolved. | App | Measured device input and rule output | [Contract](../contracts/v1.md), [engine tests](../tests/engine/test_engine.py) | **Pass** — contract and engine comparability only. Actual capture/rendered UI label Not run. |
| C08 | The 300-second freshness window, 60-minute and 20% cutoffs, three recent sleep slots and five records per baseline are versioned prototype settings. | App, pitch, submission | Rule configuration | [Policy](../rules/demo-v1.json), [rule calculations](../rules/README.md) | **Pass** — merged policy inspected; prototype choices, not validated clinical cutoffs. |
| C09 | The **Why?** panel is designed to show the rule and the readings and timestamps behind the assessment. | App, pitch, submission | Rule output and display | [Contract](../contracts/v1.md), [team plan](../plans/space-apps-two-day-team-plan.md) | **Not run** — rendered display. Contract and engine references checked; dashboard/UI source labels reviewed. |
| C10 | The prepared app is designed to run through a local server with bundled assets and data. | Pitch, submission | Local build behavior | [Contract](../contracts/v1.md), [X01](../acceptance/manual-checklist.md) | **Blocked** on a frozen seeded candidate and verified historical replay. X01 requires a disconnected launch and repeat browser walkthrough. |
| C11 | In Van Dongen et al.’s laboratory study, 4 or 6 hours in bed nightly for 14 days produced cumulative performance deficits. Sleepiness ratings rose initially and increased little on later days. | Pitch background, submission | Published research | [NASA HRP sleep report][hrp], p. 7 and pp. 25–27, [Van Dongen et al.][vd] | **Pass** for the primary study abstract, checked November 14. Scope is the studied laboratory conditions. |
| C12 | NASA’s sleep report describes psychomotor vigilance tasks as a research method for measuring how sleep loss affects vigilance. | Pitch background, submission | Published research | [NASA HRP sleep report][hrp], pp. 24–26 and Appendix A, p. 82 | **Pass** for report section IV.B.1.a, checked November 14. Scope is the research method. |
| C13 | NASA’s Sleep on Station article discusses sleep and attention and describes ESA sleep investigations aboard the ISS. | Pitch background, submission | Published research context | [NASA, Sleep on Station][station] | **Pass** for the NASA article, checked November 14. Context only, unused in the spoken script. |

## Registry source review

These are the exact `fact` fields from the repository’s [registry](registry.yaml), with YAML folded line breaks rendered as spaces. Both records cite NASA’s April 11, 2016 Human Research Program sleep evidence report.

### EVID_SLEEP_003

> In controlled laboratory studies cited by the NASA sleep evidence report, healthy adults restricted to 4, 6, or 8 hours of time in bed per night showed steadily degrading performance, while their subjective feeling of sleepiness increased only modestly and then reached a plateau (Belenky et al. 2003; Van Dongen et al. 2003). The report concludes that most people cannot accurately gauge how much sleep loss affects their performance.

The record points to “Chronic Sleep Loss,” p. 7. That summary groups the citations together. The report’s laboratory section and the original studies distinguish the schedules. Van Dongen used 4, 6 and 8 hours in bed for 14 nights and reported cumulative deficits at 4 and 6 hours, with relatively small subsequent increases in subjective sleepiness. Belenky used 3, 5, 7 and 9 hours for seven nights and reported different performance trajectories across groups. The primary study summaries and the NASA report’s detailed section were rechecked on November 14. Use C11 in the pitch. [NASA HRP report][hrp] · [Van Dongen et al.][vd] · [Belenky et al.][b]

**Registry correction for El Mahdi’s review:** `EVID_SLEEP_003.fact` groups the dose schedules and performance trajectories. Attribute the 4/6/8-hour schedule and the subjective-sleepiness result specifically to Van Dongen, with a separate sentence for Belenky’s 3/5/7/9-hour study.

### EVID_COG_001

> The NASA sleep evidence report states that vigilance is the component of cognition most consistently and significantly affected by sleep loss, and that the Psychomotor Vigilance Task (PVT) has emerged as the dominant means of evaluation. The PVT has been used in hundreds of studies and is sensitive and reliable for sleepiness arising from sleep loss and circadian desynchrony. It captures mean reaction time, lapses (errors of omission), and false starts (errors of commission).

The record points to the PVT and laboratory evaluations sections. The report discusses response slowing and lapses there, and Appendix A lists reaction time, lapses and false starts. Use C12 for research context. Describe the prototype’s browser task as a local reaction check that measures the median of valid trials. The cited research concerns the PVT methods studied in the report. [NASA HRP report][hrp] · [Runtime contract](../contracts/v1.md)

**Sleep on Station** supports C13. Use the HRP report for laboratory-performance and PVT claims. The research pipeline’s planted association is a synthetic pipeline check. [Sleep on Station][station] · [Research validation](../research/VALIDATION.md)

### Claim boundaries for release

C01 verifies instrument provenance and field meaning. C02 and C04 require the pinned CSV and actual replay. The team has no established cause for the gap. The instrument numbers describe detector readings. C11 and C12 support the choice to explore sleep and response time. The fixture’s values, windows and thresholds come solely from the contract and policy. Clinical assessment and personal exposure estimation are outside the evaluated scope. See the [submission copy](../demo/submission-draft.md).

[radlabapi]: https://visualization.osdr.nasa.gov/radlab/gui/data-api/
[radlab]: https://visualization.osdr.nasa.gov/radlab/gui/overview/
[d1]: https://visualization.osdr.nasa.gov/radlab/gui/knowledgebase/dostel1
[d2]: https://visualization.osdr.nasa.gov/radlab/gui/knowledgebase/dostel2
[csv]: https://chatgpt.com/library?file_id=libfile_e4dafb8215d0819180a1439721735543&account_id=personal
[hrp]: https://humanresearchroadmap.nasa.gov/Evidence/reports/Sleep.pdf
[vd]: https://pubmed.ncbi.nlm.nih.gov/12683469/
[b]: https://doi.org/10.1046/j.1365-2869.2003.00337.x
[station]: https://www.nasa.gov/humans-in-space/science-in-space-week-of-sept-15-2023-sleep-on-station/
