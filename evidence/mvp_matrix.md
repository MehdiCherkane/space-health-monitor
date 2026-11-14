# MVP Evidence Matrix

Scope: the smallest set of evidence relationships that can support a defensible MVP. This is not a
complete literature review; it is the subset that is strong or moderate enough to reason with, plus
explicitly rejected relationships so they are not reintroduced by accident.

Strength is qualitative: **VERY_STRONG | STRONG | MODERATE | WEAK | INSUFFICIENT**. No numeric
confidence weights are used.

MVP? **YES** = usable as an MVP evidence feature. **CONTEXT** = usable only as context, never as a
standalone trigger. **NO** = do not encode.

| # | Relationship | Evidence | Strength | MVP? | Notes |
|---|---|---|---|---|---|
| 1 | Chronic sleep deficit -> worse vigilance / reaction time | EVID_SLEEP_003, EVID_COG_001 | STRONG | YES | Controlled dose-response studies; subjective sleepiness underestimates impairment |
| 2 | Extended wakefulness -> reaction-time degradation | EVID_SLEEP_004, EVID_COG_001 | STRONG | YES | 19 h and 24 h laboratory equivalents to alcohol; analogy, not a diagnosis |
| 3 | Circadian misalignment -> sleep and performance change | EVID_SLEEP_005, EVID_SLEEP_007 | MODERATE | YES | Time-of-day and schedule shift required context |
| 4 | Sleep inertia -> transient post-wake performance decrement | EVID_SLEEP_007 | MODERATE | CONTEXT | Not systematically studied in flight; repeat after the inertia window |
| 5 | PVT lapses and false starts -> fatigue-related vigilance instability | EVID_COG_001, EVID_COG_002, EVID_FATIGUE_002 | STRONG | YES | Short PVT is less sensitive than 10-min PVT; use trend plus repeat |
| 6 | Elevated cabin CO2 -> headache | EVID_CO2_002, EVID_CO2_001 | STRONG | YES | 19/49 astronauts; 7-day average <2.5 mmHg for <1% risk; observational |
| 7 | Elevated cabin CO2 -> cognitive impairment | EVID_CO2_003 | MODERATE | NO | Recent controlled studies show no cognitive reduction at spacecraft levels; do not encode |
| 8 | Cabin outside thermal performance zone -> discomfort / performance decrement | EVID_TEMP_001, EVID_TEMP_002 | MODERATE | CONTEXT | Standard rationale, not a controlled trial |
| 9 | Body temperature depends on measurement site and age | EVID_BODYTEMP_001 | STRONG | CONTEXT | No universal fever cutoff; site and personal baseline required |
| 10 | Low SpO2 + low PIO2 or compatible symptoms -> possible hypoxia pattern | EVID_SPO2_002, EVID_HYPOXIA_001, EVID_HYPOXIA_002 | MODERATE | YES | Requires confirmation; 127 mmHg is a permitted mild-hypoxia condition with monitoring |
| 11 | Single low SpO2 -> data-quality event first | EVID_SPO2_001, EVID_SENSOR_001 | STRONG | YES | ~2% accuracy vs ABG; motion, cold hands, nail polish, skin pigment, smoking |
| 12 | Persistent resting HR change vs personal baseline -> cardiovascular concern | EVID_HR_001, EVID_HR_002 | MODERATE | YES | Excludes exercise HR; no validated astronaut-specific resting-HR cutoff |
| 13 | Postflight orthostatic intolerance | EVID_HR_003, EVID_BP_001 | STRONG | YES | >80% after 4-6 month Mir; 66% ISS vs 20% Shuttle failed 10-min tilt; transient |
| 14 | HRV change -> stress or cardiovascular concern | EVID_HRV_001, EVID_HRV_002 | INSUFFICIENT | NO | LF/HF contested; no astronaut-specific threshold; context only at most |
| 15 | Isolation / confinement -> behavioral and team risk context | EVID_STRESS_001, EVID_TEAM_001 | STRONG | CONTEXT | Raises scrutiny, not pathology; team measures under development |
| 16 | Mood change alone -> behavioral health concern | EVID_MOOD_001 | WEAK | NO | Nonspecific; requires sustained change, functional impact, and corroboration |
| 17 | Cumulative radiation dose approaching limit -> radiation exposure concern | EVID_RAD_001, EVID_RAD_002, EVID_RAD_005 | STRONG | YES | Career 600 mSv / 3% mean REID; organ limits; model uncertainty |
| 18 | Solar particle event -> confirmed astronaut dose | EVID_RAD_004, EVID_SPACEWEATHER_001 | INSUFFICIENT | NO | Event is hazard context; dose requires dosimetry |
| 19 | Missing / stale / invalid data -> insufficient data for assessment | EVID_DATA_003, EVID_BASELINE_004 | STRONG | YES | Request the missing measurement; do not default to normal |
| 20 | Redundant sensor disagreement -> sensor fault likely | EVID_DATA_004, EVID_DATA_001 | STRONG | YES | Mark observation suspect; isolate the likely faulty source |

## MVP boundary

- **14 candidate rules** in `rule_candidates.yaml` are eligible for MVP implementation; they map
  onto the relationships above, sometimes combining several rows.
- **2 rules are explicitly rejected**: HRV-based concern (RULE_CANDIDATE_010) and CO2 -> cognitive
  impairment as a trigger (part of RULE_CANDIDATE_005, which is context-only).
- **4 relationships are context-only**: sleep inertia, thermal zone, body-temperature site
  dependence, and isolation/confinement. They may change the level of scrutiny but may not trigger
  a concern alone.
- **Behavioral health is concern-level only.** The MVP must never output a psychiatric diagnosis.
- **Radiation is limit-tracking only.** The MVP must never output an individual cancer risk.

## What is deliberately absent

| Relationship | Why it is absent |
|---|---|
| Mood decline -> depression | Diagnostic label; outside system scope |
| Stress -> HRV reduction | HRV evidence insufficient and confounded |
| CO2 -> cognitive impairment | Conflicting evidence at spacecraft levels |
| Solar particle event -> radiation injury | Event is not a dose; no confirmed exposure |
| Cabin temperature -> core-temperature diagnosis | No validated individual threshold |
| Single SpO2 -> hypoxia alarm | Measurement artifact risk; requires confirmation |
| Sleep <6 h -> impaired | Population heuristic, not a validated individual threshold |
| Team conflict -> individual diagnosis | Team-level signal; not an individual health measure |
