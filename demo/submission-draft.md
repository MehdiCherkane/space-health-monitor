# Astro Vital · submission draft

For El Mahdi’s review. This draft describes merged code and engine evidence
available on November 14, 2026. Select the final scope after reviewing the
[acceptance ledger](../acceptance/manual-checklist.md).
[Code repository](https://github.com/MehdiCherkane/space-health-monitor) ·
[Official challenge](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/).

## Copy for the Project tab

**Astro Vital**

Astro Vital is a crew health monitoring prototype that shows when a reading is
stale or when a check lacks enough information. Its **Why?** panel connects an
assessment to the rule and the readings behind it, including missing inputs.
[C03, C06, C09]

We built two examples. A RadLab detector contract preview illustrates how one
source can become stale while another remains current. The sleep and vigilance
example uses synthetic records. At 09:00 the reaction result is missing. In
engine tests, at 09:01 a seeded 310 ms result arrives against a 250 ms baseline.
The prototype rule reports watch because the reaction and sleep comparison
conditions are both met. [C01, C03, C05–C06, C08]

The prototype uses a React interface, a FastAPI runtime and SQLite, with a versioned
deterministic evaluator. It is designed for a locally served workflow. NASA’s
Human Research Program sleep evidence report provides scientific context for
looking at sleep and vigilance together. The thresholds are prototype settings.
The browser task measures response time on the device, and the detector numbers
represent instrument readings. Diagnostic use, personal exposure estimation,
and the cause of the historical gap are outside the demonstrated scope.
[C01, C07–C12]

Release verification is in progress. The merged fixture passes the engine tests.
The fixed detector preview illustrates a contract example while verification of
the pinned archive is pending. The seeded browser run and disconnected launch
are pending acceptance. [C02, C04, C06, C09–C10]

## NASA resources and evidence

- NASA Human Research Program’s 2016 sleep evidence report provides scientific
  context for the synthetic sleep/vigilance example. Sections IV.B.1.a–b discuss
  ground-based vigilance studies. [NASA report](https://humanresearchroadmap.nasa.gov/Evidence/reports/Sleep.pdf).
- Van Dongen et al. (2003) supports the laboratory background on prolonged
  sleep restriction and performance. [PubMed abstract](https://pubmed.ncbi.nlm.nih.gov/12683469/).
- NASA OSDR RadLab identifies the two detector streams in the preview. It
  documents absorbed dose rate as an instrument measurement. Cite the pinned
  dataset itself only after its bytes and replay are verified.
  [DosTel1](https://visualization.osdr.nasa.gov/radlab/gui/knowledgebase/dostel1) ·
  [DosTel2](https://visualization.osdr.nasa.gov/radlab/gui/knowledgebase/dostel2) ·
  [RadLab data dictionary](https://visualization.osdr.nasa.gov/radlab/gui/data-api/).
- Demo inputs and exact values are traceable to the repository.
  [Canonical synthetic fixture](../fixtures/crew/sleep-vigilance.json) ·
  [Contract](../contracts/v1.md) · [Policy](../rules/demo-v1.json) ·
  [Source review and claim IDs](../evidence/demo-claims.md).

## Conditional edits after acceptance

| New evidence | Copy to use |
| --- | --- |
| B01/B02 seeded API and browser pass on frozen SHA | “The synthetic crew replay shows a pending assessment at 09:00 and a watch result at 09:01. The evidence drawer links to both baselines and the labeled seeded sample.” |
| A01–A04 real replay passes on that SHA | “The RadLab replay uses the verified NASA archive of DosTel1 and DosTel2 instrument readings. It shows stale data, then recovery while retaining the incident. The cause of the gap is unknown.” |
| X01 passes on that SHA | “We rehearsed the bundled build with external networking disconnected, including a fresh launch and repeat walkthrough.” |
| Archive unresolved at freeze | Keep the preview and research-context wording above. Ask El Mahdi to approve the reduced claims and confirm with the Local Lead whether the shown use of NASA resources meets eligibility. |

Remove editorial claim IDs when pasting. Retain sources and demonstrated
limitations. Add the final release SHA link and verified setup instructions
from [Hamza’s runtime README](../backend/README.md) or the frozen launcher.
The top-level project README still describes earlier scope on the reviewed
baseline, so use the runtime instructions for this demo.

## Submission requirements checked November 14, 2026

- The organizer’s 2026 page confirms the **Project** tab on the team page and
  a closing time of **November 15, 2026 at 23:59 local time**. The Global
  Organizing Team says the team owner’s registered event supplies the timezone.
  Confirm it matches **Africa/Casablanca** and check any earlier local step.
  [2026 event](https://www.spaceappschallenge.org/2026/) ·
  [Organizer guidance](https://github.com/nasa/spaceapps/discussions/1916).
- The Global Organizing Team linked the current submission guide. The guide
  itself returned HTTP 502 during verification and the authenticated team form
  was unavailable to this review. Exact field names, required uploads, local
  requirements and the global-judging control therefore need a final portal
  check by the team owner. [Current Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide) ·
  [Organizer resource announcement](https://github.com/nasa/spaceapps/discussions/2028).
- A current community answer describes an accessible 30-second video or up to
  seven slides, English copy and AI disclosure. A 2026 local event page also
  lists the short video/slides formats. Use a short cut or seven-slide maximum
  as a planning target and verify the applicable requirements in the real form.
  The two-minute recording is the backup walkthrough. [2026 community guidance](https://github.com/nasa/spaceapps/discussions/1973) ·
  [Organizer-hosted local example](https://www.spaceappschallenge.org/2026/local-events/poznan/).

Suggested short cut, pending format confirmation and frozen footage: show the
pending crew check and **Why?** (0–10 s); move to the labeled 09:01 sample or
show the verified engine result as such (10–23 s); end with sources and the
scope the build demonstrated (23–30 s). If the historical replay passes, use
a brief shot of its stale-to-resolved transition. Keep mode and provenance
readable in all cuts.

## Owner handoff and assets

| Item | Current state / next action |
| --- | --- |
| Frozen build and setup | Pending. El Mahdi pins SHA, Hamza provides commands, Nassim confirms rendered build. |
| Acceptance results | Engine evidence attached. Seeded runtime, archive, browser and X01 rows tracked in the ledger. |
| Screenshots and two-minute backup | Pending capture. Use [shot list and filenames](recording-checklist.md). Record local paths and checksums. |
| Demo link | Pending approval and media; verify reviewer access to the final link if requested by the form. |
| Project link and team details | Team owner confirms the authenticated Project tab, selected challenge, local event, member names and exact access. |
| AI disclosure | Proposed entry for this workstream: “OpenAI Codex assisted with fixture tests, source review, and preparation of acceptance and submission material.” Team owner consolidates any other tools or uses. |
| Final action | El Mahdi approves scope, validates the current form and local rules, enters reviewed copy and links, accepts applicable terms, and checks submission confirmation before the deadline. External posting requires explicit authorization. |

Internal targets on November 15, Morocco time: freeze 20:59, offline rehearsal
and backup by 21:59, submission target 22:59. Reserve the final two working hours
for rehearsal, recording and submission. [Team schedule](../contracts/v1.md).
