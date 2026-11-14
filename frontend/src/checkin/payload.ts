/**
 * Pure payload builders for the crew check-in.
 *
 * The submission shape comes from contracts/v1.md: `{submission_id, observed_at, entries}`
 * with entries `{metric, value, unit, source_id, metadata?}`. Clients do not send
 * observation ids, subject or provenance — the server derives those.
 */

import {
  REACTION_INPUT_PROFILE,
  REACTION_METRIC,
  REACTION_SOURCE_ID,
  REACTION_TASK_VERSION,
  REACTION_UNIT,
  SELF_REPORT_SOURCE_ID,
  SELF_REPORT_UNIT,
  SLEEP_METRIC,
  SLEEP_SOURCE_ID,
  SLEEP_UNIT,
} from "./constants.ts";
import type { ReactionResult } from "./reactionMachine.ts";
import type { SubmissionEntry, SubmissionRequest } from "./types.ts";
import type { CheckInFormValues } from "./validation.ts";

/** Build the observation entries for the sample sleep/self-report form (blanks omitted, 0 kept). */
export function buildCheckInEntries(values: CheckInFormValues): SubmissionEntry[] {
  const entries: SubmissionEntry[] = [];
  if (values.sleepMinutes !== null) {
    entries.push({
      source_id: SLEEP_SOURCE_ID,
      metric: SLEEP_METRIC,
      value: values.sleepMinutes,
      unit: SLEEP_UNIT,
    });
  }
  if (values.fatigue !== null) {
    entries.push({
      source_id: SELF_REPORT_SOURCE_ID,
      metric: "fatigue",
      value: values.fatigue,
      unit: SELF_REPORT_UNIT,
    });
  }
  if (values.mood !== null) {
    entries.push({
      source_id: SELF_REPORT_SOURCE_ID,
      metric: "mood",
      value: values.mood,
      unit: SELF_REPORT_UNIT,
    });
  }
  if (values.stress !== null) {
    entries.push({
      source_id: SELF_REPORT_SOURCE_ID,
      metric: "stress",
      value: values.stress,
      unit: SELF_REPORT_UNIT,
    });
  }
  return entries;
}

/** Build one check-in batch; `observed_at` is the mission clock supplied by the shell. */
export function buildCheckInSubmission(
  values: CheckInFormValues,
  submissionId: string,
  observedAt: string,
): SubmissionRequest {
  return {
    submission_id: submissionId,
    observed_at: observedAt,
    entries: buildCheckInEntries(values),
  };
}

/**
 * Build the reaction-result batch. Mission time goes in `observed_at`; the real browser
 * capture time goes in `metadata.captured_at` (contract D4).
 */
export function buildReactionSubmission(
  submissionId: string,
  observedAt: string,
  result: ReactionResult,
): SubmissionRequest {
  return {
    submission_id: submissionId,
    observed_at: observedAt,
    entries: [
      {
        source_id: REACTION_SOURCE_ID,
        metric: REACTION_METRIC,
        value: result.medianMs,
        unit: REACTION_UNIT,
        metadata: {
          task_version: REACTION_TASK_VERSION,
          input_profile: REACTION_INPUT_PROFILE,
          trial_count: result.trialCount,
          false_starts: result.falseStarts,
          completed: true,
          captured_at: result.capturedAt,
        },
      },
    ],
  };
}