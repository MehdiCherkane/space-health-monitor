# Astro Vital · two-minute pitch

Choose the version that matches the recorded build. The full version needs
A01–A04, B01–B02 and X01 evidence on the frozen SHA. The preview version
describes the merged baseline and can be rehearsed while runtime is pending.
Bracketed IDs are presenter notes. [Claims and sources](../evidence/demo-claims.md) ·
[Recording sheet](recording-checklist.md).

## Full walkthrough

| Time | Screen | Narration |
| --- | --- | --- |
| 0:00–0:20 | Build SHA and dashboard. | “Astro Vital helps a crew member see when an assessment has missing or stale evidence. Open **Why?** to see the rule, the readings it used, and what still needs checking.” [C09] |
| 0:20–0:52 | **Detector gap (RadLab)** → **23:20:00** → **Why?**. Close → **23:30:00** → **Incident history**. | “These two detector streams come from NASA RadLab. At 23:20 UTC, DosTel1’s latest reading is 455 seconds old. DosTel2 has just reported. The gap’s cause is unknown. At 23:30, both streams are current, and the resolved incident stays in history.” [C01–C04] |
| 0:52–1:33 | **Sleep and vigilance** → **Fresh run** → **09:00** → **Why?**. Close → **09:01** → **Why?**. | “This crew history is synthetic. At 09:00 the reaction result is missing, so the assessment stays pending. At 09:01 the synthetic sample is 310 milliseconds, 24 percent above the 250-millisecond baseline. Two nights were also at least an hour below the 450-minute sleep baseline. With both conditions present, the rule shows **Sleep and vigilance change**.” [C05–C08] |
| 1:33–2:00 | Hold on rule and provenance. Briefly show recorded offline proof. | “We rehearsed this build with the laptop disconnected. NASA’s sleep evidence report describes how researchers study vigilance under sleep loss. Here, the thresholds are prototype settings, and the local task measures response time. The assessment helps a crew member decide what to check next.” [C08–C12] |

Use a fresh synthetic run for B01/B02 without check-ins. The optional device
take belongs to a separate run. Display **Recorded on this device** on its
result and let the measured value stand. [C07]

## Reduced walkthrough for review

If the historical archive remains unavailable, El Mahdi reviews the reduced
claims before use. If the seed path passes browser acceptance, show the crew
sequence above and describe RadLab as a fixed preview. If the seed path still
returns a preview, use the narration below and show actual test evidence for
the change at 09:01. Keep **Fixture preview** visible.

| Time | Screen | Narration |
| --- | --- | --- |
| 0:00–0:18 | Title and visible build mode. | “Astro Vital is a prototype for reviewing the evidence behind a crew health check. I’ll show two fixed previews, then the synthetic example we ran through the evaluator.” [C09] |
| 0:18–0:48 | **Detector gap (RadLab)** → **Why?** at the fixed clock. | “This contract example shows what a detector gap looks like. At 23:20 UTC the example has one stale reading and one current reading. The gap’s cause is unknown. The pinned archive and recovery replay are pending verification.” [C01–C04] |
| 0:48–1:30 | **Sleep and vigilance** → **Why?**, then cut to test evidence labeled **Engine validation**. | “At 09:00, sleep history is available and the reaction result is missing. In our engine test, the 09:01 synthetic sample is 310 milliseconds against 250, an increase of 24 percent. The evaluator changes to watch under the demo rule. The seeded application check is still pending.” [C05–C06] |
| 1:30–2:00 | Hold on source and limitation card. | “NASA’s sleep report describes vigilance testing in sleep research. Our local response-time task and thresholds are prototype choices. The detector panel shows source readings. The crew scenario uses synthetic records. We’re preparing the integrated offline rehearsal.” [C01, C07–C12] |

The two-minute recording is the team backup. Use the organizer’s confirmed
format for the submission demo. [Submission draft](submission-draft.md).
