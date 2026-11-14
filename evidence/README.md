# Evidence Registry — NASA Astronaut Health Monitoring

A traceable scientific knowledge base for a **deterministic, safety-oriented** astronaut health
monitoring system. The system detects **evidence states and concerns**, not diagnoses, and it never
prescribes treatment.

This directory is self-contained. It does **not** modify or depend on changes to `../research/`; it
only reuses that project's metric names where they exist.

---

## Demo acceptance handoff

For the November 14, 2026 canonical crew fixture, start with the
[executed validation record](crew-fixture-validation.md), [claim table](demo-claims.md),
[integrated acceptance checklist](../acceptance/manual-checklist.md) and
[recording procedure](../demo/recording-checklist.md). The fixture passes engine
checks; fresh API runs still need Hamza's seed loader. Keep engine results, fixed
previews, and observed integrated runs distinct. The [kickoff cross-check](kickoff-cross-check.md)
is a historical record of its named older build.

## 1. What is here

```text
evidence/
├── README.md                      # this file: method, policy, limitations
├── registry.yaml                  # 60 evidence records
├── hypothesis_evidence_map.yaml   # 9 hypotheses with supporting/contradicting/missing evidence
├── rule_candidates.yaml           # 16 qualitative rule candidates (human review required)
├── mvp_matrix.md                  # 20 relationships: 12 MVP, 4 context-only, 4 rejected
└── source_catalog.md              # 33 agency/peer sources + 7 listed-not-used
```

Counts are generated from the YAML files and are not hand-maintained claims:

| Item | Count |
|---|---|
| Evidence records | 60 |
| Hypotheses | 9 (H01–H09) |
| Rule candidates | 16 |
| MVP matrix rows | 20 |
| Source catalog entries (agency/peer-reviewed / listed-not-used) | 33 / 7 |

Of the 33 agency and peer-reviewed entries, 31 are cited by a record or used as a cross-check.
OSDR and NLSP/LSDA were reviewed as potential data sources only; they are not used for any rule.
| Evidence strength: VERY_STRONG | 8 |
| Evidence strength: STRONG | 27 |
| Evidence strength: MODERATE | 22 |
| Evidence strength: WEAK | 2 |
| Evidence strength: INSUFFICIENT | 1 |

The registry covers all 20 requested domains and all 9 hypotheses. Records are deliberately
concentrated on relationships that can survive review; this is not a bulk literature dump.

---

## 2. Reasoning architecture

```text
Observation
  -> Validation
  -> Derived Feature
  -> Evidence (registry.yaml)
  -> Hypothesis (hypothesis_evidence_map.yaml)
  -> Confidence (qualitative)
  -> Recommended Action (rule_candidates.yaml)
```

Two separations are non-negotiable:

1. **Data quality vs health state.** A missing, stale, invalid, or disagreeing sensor is a
   data-quality state (`H08`, `H09`). It is never evidence that the astronaut is healthy or unwell.
2. **Evidence state vs diagnosis.** `H01`–`H07` are questions, not conclusions. `H05` in particular
   may only raise a behavioral health *concern*.

---

## 3. FACT / INTERPRETATION / PROTOTYPE RULE

Every record contains three distinct fields.

| Field | Meaning | Example |
|---|---|---|
| `fact` | What the source actually establishes, with its population and context | NASA reports that 19 of 49 astronauts reported headaches, and that a 7-day average CO2 below 2.5 mmHg was associated with <1% headache risk |
| `interpretation` | How the fact may be useful to the system, including its limits | CO2 plus headache is meaningful converging evidence; the association is not proof of causation |
| `prototype_rule_note` | What we might implement, always qualitative and human-reviewed | Combine a headache report with the 7-day average ppCO2 and request environmental review; do not diagnose CO2 toxicity |

The registry never collapses these into a single "NASA says" sentence.

---

## 4. Evidence strength model

| Level | Definition | Typical basis |
|---|---|---|
| `VERY_STRONG` | NASA or established medical standard, or multiple strong converging sources; direct operational requirement or consensus definition | NASA-STD-3001 limits, orthostatic hypotension consensus |
| `STRONG` | NASA human-spaceflight evidence or a repeated high-quality finding with good support; minor limitations | HRP evidence reports, large actigraphy cohort |
| `MODERATE` | Plausible and supported, but limited sample, indirect analog, mixed findings, or uncertain generalizability | Small flight cohorts, standard rationale, single mechanism study |
| `WEAK` | Suggestive only; single small study, historical report, or anecdote; not sufficient alone | Historical CO2 symptom list, mood alone |
| `INSUFFICIENT` | Cannot support encoding into production reasoning | HRV-based stress rules |

Rules for using this scale:

- Do not inflate. A NASA mention is not automatically `STRONG`; the strength reflects the design and
  consistency of the underlying evidence.
- `VERY_STRONG` is reserved for standards and consensus definitions, not for dramatic findings.
- `INSUFFICIENT` records are kept deliberately so that rejected relationships are visible.

---

## 5. Threshold policy

Every numeric threshold carries:

```yaml
value: 3
unit: mmHg
averaging_window: 1_hour
context: average ppCO2 in the habitable volume
population: crewmembers in pressurized habitats
source: NASA-STD-3001 Vol 2 Rev D [V2 6004]
```

A value without its window, context, population, and source is invalid. The registry contains four
kinds of numbers, and they are not interchangeable:

1. **Environmental standards** — for example 1-hour ppCO2 <= 3 mmHg, PIO2 145–155 mmHg, cabin
   18–27 °C / 25–75% RH. These are habitat requirements.
2. **Clinical definitions** — for example orthostatic hypotension (SBP fall >= 20 mmHg or DBP fall
   >= 10 mmHg within 3 min of standing/tilt >= 60°). These require a controlled measurement.
3. **Normative ranges** — for example site-specific body-temperature ranges. These are context, not
   alarm thresholds.
4. **Design and surveillance limits** — for example the career effective dose < 600 mSv and the
   organ-dose table. These are mission-planning and surveillance limits, not wearable alarms.

No numeric threshold in this registry is an individual wearable alarm threshold unless the source
explicitly says so. None of the sources does.

---

## 6. Behavioral health policy

The system may detect:

- behavioral health concern
- performance degradation
- fatigue-related changes
- stress-related patterns
- sleep/circadian disruption
- team/social deterioration

The system must **not** output:

- depression
- anxiety disorder
- PTSD
- psychiatric disorder
- personality judgment
- fitness-for-duty determination

This follows NASA's own distinction: an adverse behavioral change is any decrement in mood,
cognition, morale, or interpersonal interaction that adversely affects operational readiness or
performance; a psychiatric disorder meets DSM criteria and requires clinical evaluation
(`EVID_BMED_001`). Behavioral emergencies are rare in LEO (`EVID_BMED_002`), mood alone is
nonspecific (`EVID_MOOD_001`), and team measures are not individual health rules (`EVID_TEAM_001`).

---

## 7. Radiation policy

Radiation is treated as **exposure and limit tracking**, not as a diagnosis:

- Career effective dose limit: < 600 mSv, universal, corresponding to 3% mean REID
  (`EVID_RAD_001`).
- Organ-specific limits exist for lens, skin, BFO, circulatory, and CNS (`EVID_RAD_002`).
- Dose and risk estimates carry substantial model uncertainty (`EVID_RAD_005`).
- A solar particle event is a **hazard**, not a confirmed astronaut dose (`EVID_RAD_004`). Dose
  requires dosimetry or a validated exposure model.

The system must never output an individual cancer risk or a radiation injury diagnosis.

---

## 8. Data quality policy

Adapted from NASA fault-management practice (`EVID_DATA_001`–`EVID_DATA_004`):

- Data quality is a separate layer with explicit states: `valid`, `suspect`, `stale`, `missing`,
  `disagreeing`.
- Health hypotheses consume only validated observations.
- Missing or stale data produce `H09 insufficient_data_for_assessment` and a measurement request,
  not a silent confidence reduction and not a default to "normal."
- Redundant sensor disagreement produces `H08 sensor_fault_likely` and a request for a third
  measurement or manual check.
- A sensor fault and a real physiological change can coexist. Mark the observation unusable; do not
  close the health question.

This is also why a single low SpO2 is handled as a data-quality event first
(`RULE_CANDIDATE_007`), before the hypoxia pattern rule (`RULE_CANDIDATE_006`).

---

## 9. How the evidence was selected

Source priority, highest first:

1. NASA standards and technical briefs
2. NASA Human Research Program evidence reports
3. NASA datasets and experiment descriptions
4. NASA peer-reviewed publications
5. ESA / space-agency research
6. High-quality peer-reviewed medical literature

The registry avoids blogs, generic health sites, and unsourced summaries. Where a fact depends on a
paper cited inside a NASA report, the NASA report is the traceable source and the paper is named in
the record.

Deliberate exclusions:

- No invented sample sizes, thresholds, correlations, mission findings, or NASA standards.
- No claim that a solar particle event equals an astronaut dose.
- No claim that spacecraft-level CO2 causes cognitive impairment.
- No claim that HRV can stand alone as a stress or cardiovascular marker.
- No claim that a wearable sensor can detect SANS or jugular thrombosis.

---

## 10. Known limitations

1. **No validated astronaut-specific alarm thresholds for continuous wearable monitoring.** The
   standards are environmental or clinical; the flight evidence is group-level. The system must use
   personal baselines and context, and must request confirmation.
2. **Sleep measurement is imperfect.** Historical survey data (about 6 h vs 7.9 h) and recent
   actigraphy (about 19–20 min less than preflight) tell different stories. Actigraphy can
   misclassify quiet wake; sleep logs are subjective.
3. **In-flight cognitive findings are inconsistent.** Small samples and heterogeneous measures make
   it unclear how sleep loss translates into operational performance (`EVID_COG_004`).
4. **Short PVT is less sensitive than the 10-min PVT.** A negative 3-min test is weak evidence of
   fitness (`EVID_COG_002`).
5. **CO2 → cognition is unresolved.** CO2 → headache is much better supported (`EVID_CO2_002`,
   `EVID_CO2_003`).
6. **HRV is not usable as a standalone rule.** LF/HF is contested and no astronaut-specific
   threshold exists (`EVID_HRV_001`, `EVID_HRV_002`).
7. **Behavioral health base rates are low and data access is limited.** The system should expect
   false positives and require human review (`EVID_BMED_002`, `EVID_BMED_004`).
8. **SANS and jugular thrombosis are not sensor-detectable** with the proposed wearable set
   (`EVID_FLUID_002`, `EVID_FLUID_003`).
9. **Individual variability and sex differences are understudied.** Population ranges can hide
   clinically important individual change (`EVID_BASELINE_003`).
10. **Device-specific accuracy in spaceflight is not established.** The SpO2 accuracy statement is
    from clinical guidance, not from a flight validation of the specific sensor (`EVID_SPO2_001`).

---

## 11. Unresolved scientific questions

1. What is the correct in-flight sleep-duration baseline: preflight training, postflight recovery, or
   a mission-specific stable period?
2. How much of the in-flight cognitive change is attributable to sleep loss versus circadian phase,
   workload, medication, or motivation?
3. Does spacecraft-level CO2 contribute to fatigue or headache through a causal pathway, or is the
   association confounded by cabin conditions and reporting?
4. Which CO2 averaging window best predicts individual headache: 1-hour, 24-hour, or 7-day?
5. Is a persistent resting-HR change in flight a marker of cardiovascular adaptation, illness,
   medication, or simply deconditioning?
6. Can HRV be used at all in a deterministic rule, or only as a trend visualisation?
7. What is the minimal validated behavioral health check that is feasible in flight and does not
   overdiagnose?
8. How should personal baselines be defined when preflight data are sparse or collected under
   different conditions?
9. How should sensor disagreement be resolved when both sensors are plausible and no third sensor
   exists?
10. What is the right escalation threshold for radiation: a fixed percentage of the career limit, a
    remaining-margin rule, or a mission-phase rule?

---

## 12. Relationship to `research/`

- `research/` owns the statistical/data-mining pipeline. This directory does not modify it.
- Metric names follow `research/config/metrics.yaml` where a canonical name exists
  (`sleep_duration`, `reaction_time`, `reaction_lapses`, `heart_rate`, `systolic_bp`,
  `diastolic_bp`, `spo2`, `body_temperature`, `hrv`, `cabin_co2`, `cabin_temperature`,
  `relative_humidity`, `radiation_dose_rate`, `cumulative_radiation_dose`, `activity_level`,
  `exercise_duration`, `fatigue`, `stress`, `mood`, `workload`).
- Non-canonical context features are listed under `context_features` in each record (for example
  `time_since_wake`, `posture`, `sleep_medication_use`, `perfusion_index`, `sensor_agreement`).
  Organ-dose threshold submetrics (`lens_dose`, `skin_dose`, `bfo_dose`, `circulatory_dose`,
  `cns_dose`, `cns_dose_z10`) are registry-local labels under
  `cumulative_radiation_dose`; they are not new canonical metrics.
- The intended intersection is: a pattern discovered in `research/` is only eligible for system use
  if it maps to an evidence record here and respects that record's strength, context, and
  prohibitions. A data-mined association with no registry support is not promoted.

---

## 13. Maintenance

- Every record has a `source.url` and a `source.location`.
- Records synthesized from multiple documents list the secondary links under
  `source.additional_urls`; the strengths and thresholds still cite one document at a time.
- Re-verify URLs when a source is updated; NASA HRP reports are periodically revised.
- Do not change a strength level without recording the reason in `evidence_strength.rationale`.
- Do not add a numeric threshold without value, unit, context, population, window, and source.
- Keep `registry.yaml`, `hypothesis_evidence_map.yaml`, `rule_candidates.yaml`, and `mvp_matrix.md`
  cross-referenced. The validation script checks IDs but not scientific consistency; that remains a
  human review task.

---

## 14. One-paragraph summary

This registry supports a monitoring system that observes, validates, derives features, cites
evidence, raises a hypothesis, assigns a qualitative confidence, and recommends a low-risk action.
Its strongest relationships are sleep/fatigue and reaction-time degradation, CO2 and headache,
postflight orthostatic intolerance, SpO2 measurement uncertainty, cumulative radiation dose
tracking, and data-quality separation. Its deliberate silences are equally important: no
CO2-induced cognitive impairment, no HRV stress rule, no mood-based diagnosis, no solar-event dose,
and no wearable detection of SANS or thrombosis.
