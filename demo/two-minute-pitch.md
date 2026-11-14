# Astro Vital · two-minute pitch

**Walkthrough draft.** Use on the integrated build after A01, B02 and X01 pass. The bracketed IDs link the script to the [claim/source table](../evidence/demo-claims.md) and are presenter notes.

## 0:00–0:20 · Opening

- “On a long mission, the crew needs to see when the evidence behind a health check is incomplete.” [C09]
- “Astro Vital shows the readings behind each assessment and which inputs are still missing.” [C06, C09]
- “We’ll look at an ISS detector replay and then a simulated crew check-in.” [C02, C05]

## 0:20–0:55 · Detector replay

*Select the RadLab scenario, seek to 23:20 UTC and open **Why?**. Point to the two source timestamps. Advance to 23:30 UTC and show the incident history.*

- “These are archived readings from two detectors in the ISS Columbus module.” [C01, C02]
- “At 23:20 UTC, DosTel1’s last reading is seven minutes and thirty-five seconds old, while DosTel2 has just reported.” [C03]
- “The cause of the gap is unknown.” [C03]
- “By 23:30, both sources are current again, and the resolved incident stays in the history.” [C04]

## 0:55–1:35 · Crew check-in

*Switch to the crew scenario at 09:00 UTC. Show the missing result, then seek to 09:01 for the labeled sample. Open **Why?** and point to the baseline rows and timestamps.*

- “At nine o’clock, the synthetic sleep history is present and the current reaction result is missing, so the assessment stays pending.” [C05, C06]
- “One minute later, the seeded sample is 310 milliseconds against a 250-millisecond baseline, a 24 percent increase.” [C05, C06]
- “Two recent nights were also at least an hour below the 450-minute demo baseline.” [C05, C06]
- “Both conditions are now met, so the rule shows ‘Sleep and vigilance change.’” [C06]

## 1:35–2:00 · Offline and evidence

*Show the locally served build with Wi-Fi off and point to the rule reference.*

- “Both scenarios run locally with the data and interface bundled on this laptop.” [C10]
- “The detector readings come from the NASA archive, and the crew example uses synthetic data informed by published sleep and vigilance research.” [C02, C05, C11, C12]
- “The windows and thresholds are prototype settings, and **Why?** shows the evidence behind the comparison.” [C08, C09]

### Fixture preview opening

If the integrated checks are blocked, label the screen **Fixture preview** and use the two checked contract snapshots.

- “This is a preview of two contract examples: the detector state at 23:20 and the synthetic crew state at 09:00.” [C03, C05, C06]
- “The planned sample result and recovery are later checkpoints in the team’s walkthrough.” [C04, C06]
