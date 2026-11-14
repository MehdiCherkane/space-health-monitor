/**
 * Client-side validation for the sample check-in form.
 *
 * Rules come from contracts/v1.md: sleep_duration is numeric 0–1440 minutes, and
 * fatigue/mood/stress are integers 0–10 under unit score_0_10. Blank optional scores are
 * omitted from the payload; 0 is a real value and is kept. The server re-validates and its
 * 422 message is displayed by the submit flow.
 */

import {
  SELF_REPORT_MAXIMUM_SCORE,
  SELF_REPORT_MINIMUM_SCORE,
  SLEEP_MAXIMUM_MINUTES,
  SLEEP_MINIMUM_MINUTES,
} from "./constants.ts";

/** Raw text values exactly as typed in the form. */
export interface RawCheckInForm {
  sleep: string;
  fatigue: string;
  mood: string;
  stress: string;
}

/** Parsed, validated values; null means the field was left blank. */
export interface CheckInFormValues {
  sleepMinutes: number | null;
  fatigue: number | null;
  mood: number | null;
  stress: number | null;
}

export type CheckInField = keyof RawCheckInForm;

export type CheckInFormErrors = Partial<Record<CheckInField, string>>;

export const CHECK_IN_FIELD_LABELS: Record<CheckInField, string> = {
  sleep: "Sleep duration",
  fatigue: "Fatigue",
  mood: "Mood",
  stress: "Stress",
};

export const SLEEP_INVALID_MESSAGE =
  `Enter sleep duration as a number from ${SLEEP_MINIMUM_MINUTES} to ${SLEEP_MAXIMUM_MINUTES} minutes, or leave it blank.`;

export const SCORE_INVALID_MESSAGE =
  `Enter a whole number from ${SELF_REPORT_MINIMUM_SCORE} to ${SELF_REPORT_MAXIMUM_SCORE}, or leave it blank.`;

export const NO_ENTRIES_MESSAGE = "Enter at least one value before submitting.";

interface ParsedField {
  ok: boolean;
  value: number | null;
}

function parseBlankableNumber(raw: string, isAccepted: (value: number) => boolean): ParsedField {
  const text = raw.trim();
  if (text === "") {
    return { ok: true, value: null };
  }
  const value = Number(text);
  if (!Number.isFinite(value) || !isAccepted(value)) {
    return { ok: false, value: null };
  }
  return { ok: true, value };
}

/** Sleep in minutes: blank allowed, otherwise any finite number inside 0–1440. */
export function parseSleepMinutes(raw: string): ParsedField {
  return parseBlankableNumber(
    raw,
    (value) => value >= SLEEP_MINIMUM_MINUTES && value <= SLEEP_MAXIMUM_MINUTES,
  );
}

/** Optional self-report score: blank allowed, otherwise an integer inside 0–10. */
export function parseScore(raw: string): ParsedField {
  return parseBlankableNumber(
    raw,
    (value) =>
      Number.isInteger(value) &&
      value >= SELF_REPORT_MINIMUM_SCORE &&
      value <= SELF_REPORT_MAXIMUM_SCORE,
  );
}

/**
 * Validate every raw field. Returns the parsed values and any visible field errors.
 * Callers must submit only when `Object.keys(errors).length === 0`.
 */
export function validateCheckInForm(raw: RawCheckInForm): {
  values: CheckInFormValues;
  errors: CheckInFormErrors;
} {
  const sleep = parseSleepMinutes(raw.sleep);
  const fatigue = parseScore(raw.fatigue);
  const mood = parseScore(raw.mood);
  const stress = parseScore(raw.stress);
  const errors: CheckInFormErrors = {};
  if (!sleep.ok) errors.sleep = SLEEP_INVALID_MESSAGE;
  if (!fatigue.ok) errors.fatigue = SCORE_INVALID_MESSAGE;
  if (!mood.ok) errors.mood = SCORE_INVALID_MESSAGE;
  if (!stress.ok) errors.stress = SCORE_INVALID_MESSAGE;
  return {
    values: {
      sleepMinutes: sleep.value,
      fatigue: fatigue.value,
      mood: mood.value,
      stress: stress.value,
    },
    errors,
  };
}

/** True when at least one field has a value (baseline numeric check; see payload builder). */
export function hasCheckInEntries(values: CheckInFormValues): boolean {
  return (
    values.sleepMinutes !== null ||
    values.fatigue !== null ||
    values.mood !== null ||
    values.stress !== null
  );
}

/** Stable snapshot used to decide whether a retry reuses the pending submission. */
export function checkInSnapshot(values: CheckInFormValues): string {
  return JSON.stringify([
    values.sleepMinutes,
    values.fatigue,
    values.mood,
    values.stress,
  ]);
}
