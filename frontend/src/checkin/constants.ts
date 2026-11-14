/**
 * Contract ids, units, bounds and labels for the crew check-in.
 *
 * Sources: contracts/v1.md ("Form entry names and units", "D5 vocabulary"), rules/demo-v1.json
 * and plans/04-mohsine-crew-checkin.md. Prototype task settings are marked as such; they are
 * not clinical cutoffs.
 */

/** The check-in is part of the behavioral demo scenario only. */
export const CHECK_IN_SCENARIO_ID = "sleep_vigilance";

// crew_sleep_log / sleep_duration / min, numeric 0–1440 (contract).
export const SLEEP_SOURCE_ID = "crew_sleep_log";
export const SLEEP_METRIC = "sleep_duration";
export const SLEEP_UNIT = "min";
export const SLEEP_MINIMUM_MINUTES = 0;
export const SLEEP_MAXIMUM_MINUTES = 1440;

// crew_self_report: fatigue, mood, stress / score_0_10, integers 0–10 (contract).
export const SELF_REPORT_SOURCE_ID = "crew_self_report";
export const SELF_REPORT_UNIT = "score_0_10";
export const SELF_REPORT_METRICS = ["fatigue", "mood", "stress"] as const;
export const SELF_REPORT_MINIMUM_SCORE = 0;
export const SELF_REPORT_MAXIMUM_SCORE = 10;

// reaction_task / reaction_time / ms (contract).
export const REACTION_SOURCE_ID = "reaction_task";
export const REACTION_METRIC = "reaction_time";
export const REACTION_UNIT = "ms";

// Fixed reaction metadata values from contracts/v1.md ("D4", "Reaction metadata").
export const REACTION_TASK_VERSION = "demo-rt-v1";
export const REACTION_INPUT_PROFILE = "browser-keyboard";

// Action ids from contracts/v1.md.
export const START_REACTION_CHECK_ACTION_ID = "start_reaction_check";
export const REVIEW_AVAILABLE_INPUTS_ACTION_ID = "review_available_inputs";

// Labels fixed by contracts/v1.md D5 / the demo plan. Engine-provided text wins at render time.
export const REACTION_UNAVAILABLE_TEXT = "Reaction check unavailable";
export const REVIEW_AVAILABLE_INPUTS_LABEL = "Review available inputs";

// Provenance display labels from the team plan (contract provenance values).
export const SAMPLE_ENTRY_BADGE = "Sample entry (synthetic)";
export const DEVICE_MEASUREMENT_BADGE = "Recorded on this device";
export const FIXTURE_PREVIEW_BADGE = "Fixture preview";

/**
 * Reaction-check settings. The plan does not fix a trial count; this choice fits the
 * requested 30–60 second local check (3 practice + 12 measured trials with 1.5–3 s waits).
 * Practice trials are never submitted. There is no clinical cutoff for this task.
 */
export const PRACTICE_TRIAL_COUNT = 3;
export const MEASURED_TRIAL_COUNT = 12;
export const STIMULUS_DELAY_MIN_MS = 1500;
export const STIMULUS_DELAY_MAX_MS = 3000;
export const RESPONSE_FEEDBACK_MS = 500;

/** The single response key: the space bar. */
export const RESPONSE_KEY_CODE = "Space";