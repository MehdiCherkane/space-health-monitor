/**
 * Pure state machine and arithmetic for the short local reaction check.
 *
 * Rules from the plan (MO-08/MO-09/MO-11): measure elapsed time with the caller's
 * monotonic clock (`performance.now()` in the browser); an early key press is a false
 * start and not a valid trial; ignore held-key repeats; practice trials are never part of
 * the submitted result; the result is the median of completed valid measured trials; a
 * cancelled or interrupted task produces no result. This file holds no timers and no DOM.
 */

import {
  MEASURED_TRIAL_COUNT,
  PRACTICE_TRIAL_COUNT,
  STIMULUS_DELAY_MAX_MS,
  STIMULUS_DELAY_MIN_MS,
} from "./constants.ts";

export type ReactionPhase = "instructions" | "practice" | "measured" | "complete" | "cancelled";

export type ReactionFeedback = "none" | "false_start" | "recorded";

export interface ReactionResult {
  /** Median of the completed valid measured trials, rounded to whole milliseconds. */
  medianMs: number;
  /** Number of completed valid measured trials (practice excluded). */
  trialCount: number;
  falseStarts: number;
  /** Real browser capture time in UTC ISO text (contract D4, metadata.captured_at). */
  capturedAt: string;
}

export interface ReactionState {
  phase: ReactionPhase;
  /** Index of the current trial inside the current phase (0-based). */
  trialIndex: number;
  practiceTimes: number[];
  measuredTimes: number[];
  falseStarts: number;
  /** Monotonic time at which the current stimulus appeared; null while waiting. */
  stimulusShownAt: number | null;
  feedback: ReactionFeedback;
  result: ReactionResult | null;
}

export const INITIAL_REACTION_STATE: ReactionState = {
  phase: "instructions",
  trialIndex: 0,
  practiceTimes: [],
  measuredTimes: [],
  falseStarts: 0,
  stimulusShownAt: null,
  feedback: "none",
  result: null,
};

export type ReactionEvent =
  | { type: "start_practice" }
  | { type: "start_measured" }
  | { type: "stimulus"; shownAt: number }
  | { type: "press"; at: number; repeat: boolean; capturedAt: string }
  | { type: "cancel" };

/** Randomized wait before a stimulus; exported so the component and tests share one rule. */
export function nextStimulusDelay(random: () => number): number {
  const raw = random();
  const fraction = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), 0.999999) : 0;
  return (
    STIMULUS_DELAY_MIN_MS +
    Math.floor(fraction * (STIMULUS_DELAY_MAX_MS - STIMULUS_DELAY_MIN_MS + 1))
  );
}

/** Median of finite positive numbers; null for an empty (or unusable) set. */
export function medianOf(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  if (!values.every((value) => Number.isFinite(value) && value > 0)) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Build the submitted result from completed measured trials; null when there is no valid result. */
export function buildReactionResult(
  measuredTimes: number[],
  falseStarts: number,
  capturedAt: string,
): ReactionResult | null {
  const median = medianOf(measuredTimes);
  if (median === null) {
    return null;
  }
  return {
    medianMs: Math.round(median),
    trialCount: measuredTimes.length,
    falseStarts,
    capturedAt,
  };
}

/** True when the practice step has all required practice trials. */
export function practiceComplete(state: ReactionState): boolean {
  return state.phase === "practice" && state.practiceTimes.length >= PRACTICE_TRIAL_COUNT;
}

export function reduceReaction(state: ReactionState, event: ReactionEvent): ReactionState {
  switch (event.type) {
    case "start_practice": {
      if (state.phase !== "instructions") {
        return state;
      }
      return {
        ...INITIAL_REACTION_STATE,
        phase: "practice",
      };
    }
    case "start_measured": {
      if (!practiceComplete(state)) {
        return state;
      }
      return {
        ...state,
        phase: "measured",
        trialIndex: 0,
        stimulusShownAt: null,
        feedback: "none",
        result: null,
      };
    }
    case "stimulus": {
      if (state.phase !== "practice" && state.phase !== "measured") {
        return state;
      }
      if (state.stimulusShownAt !== null) {
        return state;
      }
      if (!Number.isFinite(event.shownAt)) {
        return state;
      }
      return { ...state, stimulusShownAt: event.shownAt, feedback: "none" };
    }
    case "press": {
      if (event.repeat) {
        return state;
      }
      if (state.phase !== "practice" && state.phase !== "measured") {
        return state;
      }
      if (state.phase === "practice" && state.practiceTimes.length >= PRACTICE_TRIAL_COUNT) {
        // The practice-complete screen has no stimulus; a stray press is not a false start.
        return state;
      }
      if (state.stimulusShownAt === null) {
        // Early key press: counted as a false start, never as a valid trial.
        return {
          ...state,
          falseStarts: state.falseStarts + 1,
          feedback: "false_start",
        };
      }
      const elapsed = event.at - state.stimulusShownAt;
      if (!Number.isFinite(elapsed) || elapsed <= 0) {
        // Ignore unusable timing (for example a duplicate event at the same instant).
        return state;
      }
      if (state.phase === "practice") {
        return {
          ...state,
          practiceTimes: [...state.practiceTimes, elapsed],
          trialIndex: state.trialIndex + 1,
          stimulusShownAt: null,
          feedback: "recorded",
        };
      }
      const measuredTimes = [...state.measuredTimes, elapsed];
      if (measuredTimes.length >= MEASURED_TRIAL_COUNT) {
        return {
          ...state,
          phase: "complete",
          measuredTimes,
          trialIndex: state.trialIndex + 1,
          stimulusShownAt: null,
          feedback: "none",
          result: buildReactionResult(measuredTimes, state.falseStarts, event.capturedAt),
        };
      }
      return {
        ...state,
        measuredTimes,
        trialIndex: state.trialIndex + 1,
        stimulusShownAt: null,
        feedback: "recorded",
      };
    }
    case "cancel": {
      if (state.phase === "complete" || state.phase === "cancelled") {
        return state;
      }
      return {
        ...INITIAL_REACTION_STATE,
        phase: "cancelled",
      };
    }
    default:
      return state;
  }
}
