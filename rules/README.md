# Demo rule calculations

The runtime policy is `demo-v1.json`. Hamza loads it and passes the parsed dictionary
to `backend.engine.evaluate`; the evaluator performs no I/O. Settings here are prototype
choices, not clinical thresholds. Rule outputs identify neither a diagnosis nor a cause.

## SOURCE_FRESHNESS@1

1. Keep only observations at or before the explicit `as_of`. For each configured
   detector/metric, use the greatest `(observed_at, id)` tuple. IDs break time ties
   lexicographically. Detectors have `subject_id: null`.
2. Subtract the latest valid reading time from `as_of`. With the bundled policy,
   age through 300 seconds is current; 301 seconds or more is stale. No observation
   means missing, with null ID/age. An invalid latest reading is shown as unusable.
3. Walk the valid reading history. A gap opens at preceding reading + 301 seconds,
   unless a new valid reading arrives by that instant. Close it on the first later
   valid reading. Keep the same incident ID, scoped by run. Rewinding sees only earlier
   readings and transitions, so it cannot reveal a future closure.
4. Include every observation referenced by statuses, evidence and incident history.

Example A: `23:20:00 - 23:12:25 = 455 s = 7 min 35 s`. The gap opens at `23:17:26`.
DosTel2's reading at `23:20:00` has age zero. The assessment is `watch`; the gap's cause
is unknown. These numbers come from the contract example. The historical CSV itself
still needs Hamza's checksum/count verification; test variants are synthetic.

## SLEEP_VIGILANCE@1

1. Select the fixed synthetic baseline observations at the configured five sleep
   and five reaction timestamps. Require the correct subject, source, unit and valid
   values. Reaction baselines also require matching task version/profile and completed
   valid trials. Later daily inputs do not move the baseline.
2. Select the latest valid sleep observation in each configured recent UTC day
   (Jan 8–10). Require all three slots. Select the latest completed reaction in the
   current session, through `as_of`; do not replace an incomparable latest result with
   an older comparable one.
3. Compute the medians. Sleep: `median(450, 440, 450, 460, 445) = 450 min`.
   Reaction: `median(245, 250, 255, 248, 252) = 250 ms`.
4. Recent sleep differences are `70`, `80`, `30` minutes below baseline; two of three
   meet the inclusive 60-minute cutoff. At 09:00 the current reaction is absent, so
   the result is `insufficient_data`. At 09:01 the seeded sample is
   `(310 - 250) / 250 × 100 = 24%` slower and meets the inclusive 20% cutoff.
   Both conditions true means `watch`, titled **Sleep and vigilance change**.
5. A comparable 270 ms result is only 8% slower, so a complete comparison is `observed`.
   A missing slot/baseline or an incomparable result remains `insufficient_data`.
   The comparison uses decimal cross-multiplication at the percent boundary to avoid
   rounding 19.9% up to 20%.
6. Unavailable reaction equipment disables the check and supplies the input-review
   fallback while evidence is missing. Availability does not erase an already completed
   comparable result. A `browser-keyboard` capture stays visible as current measured data
   but is not comparable with a `seeded-demo` baseline.

The returned evidence names the current and baseline observation IDs. Optional
fatigue/mood/stress remain context in caller-owned history/check-in data and do not
affect these calculations. Conflicting-evidence fields remain distinct, but no numeric
conflict detector is defined or inferred for these two demos.
