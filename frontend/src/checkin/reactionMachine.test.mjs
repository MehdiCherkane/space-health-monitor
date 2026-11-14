import test from "node:test";
import assert from "node:assert/strict";
import {
  INITIAL_REACTION_STATE,
  buildReactionResult,
  medianOf,
  practiceComplete,
  reduceReaction,
} from "./reactionMachine.ts";

const CAPTURED_AT = "2026-01-10T09:00:30Z";

function press(state, at, options = {}) {
  return reduceReaction(state, {
    type: "press",
    at,
    repeat: options.repeat ?? false,
    capturedAt: options.capturedAt ?? CAPTURED_AT,
  });
}

function completePractice(startAt = 1000, times = [200, 210, 220]) {
  let state = reduceReaction(INITIAL_REACTION_STATE, { type: "start_practice" });
  let cursor = startAt;
  for (const time of times) {
    state = reduceReaction(state, { type: "stimulus", shownAt: cursor });
    state = press(state, cursor + time);
    cursor += 5000;
  }
  return state;
}

function completeMeasured(state, startAt = 20000, times) {
  let current = state;
  let cursor = startAt;
  for (const time of times) {
    current = reduceReaction(current, { type: "stimulus", shownAt: cursor });
    current = press(current, cursor + time);
    cursor += 5000;
  }
  return current;
}

test("medianOf handles odd and even counts and rejects bad input", () => {
  assert.equal(medianOf([300]), 300);
  assert.equal(medianOf([300, 100, 200]), 200);
  assert.equal(medianOf([100, 200]), 150);
  assert.equal(medianOf([100, 200, 300, 400]), 250);
  assert.equal(medianOf([]), null);
  assert.equal(medianOf([100, Number.NaN]), null);
  assert.equal(medianOf([100, 0]), null);
  assert.equal(medianOf([100, -5]), null);
});

test("buildReactionResult rounds the median and counts valid trials", () => {
  const result = buildReactionResult([300, 301, 302, 303, 304, 305], 2, CAPTURED_AT);
  assert.deepEqual(result, {
    medianMs: 303,
    trialCount: 6,
    falseStarts: 2,
    capturedAt: CAPTURED_AT,
  });
  assert.equal(buildReactionResult([], 0, CAPTURED_AT), null);
});

test("practice runs three trials before measured trials unlock", () => {
  let state = completePractice();
  assert.equal(state.phase, "practice");
  assert.equal(state.practiceTimes.length, 3);
  assert.equal(practiceComplete(state), true);
  state = reduceReaction(state, { type: "start_measured" });
  assert.equal(state.phase, "measured");
  assert.equal(state.trialIndex, 0);
  assert.equal(state.measuredTimes.length, 0);
  assert.equal(practiceComplete(state), false);
});

test("start_measured is ignored until practice is complete", () => {
  const state = reduceReaction(INITIAL_REACTION_STATE, { type: "start_measured" });
  assert.equal(state.phase, "instructions");
});

test("an early key press is a false start, not a trial", () => {
  let state = reduceReaction(INITIAL_REACTION_STATE, { type: "start_practice" });
  state = press(state, 500);
  assert.equal(state.falseStarts, 1);
  assert.equal(state.practiceTimes.length, 0);
  assert.equal(state.feedback, "false_start");
});

test("held-key repeats are ignored", () => {
  let state = reduceReaction(INITIAL_REACTION_STATE, { type: "start_practice" });
  state = reduceReaction(state, { type: "stimulus", shownAt: 1000 });
  const unchanged = press(state, 1300, { repeat: true });
  assert.equal(unchanged, state);
});

test("key presses outside a trial phase are ignored", () => {
  const state = press(INITIAL_REACTION_STATE, 100);
  assert.equal(state, INITIAL_REACTION_STATE);
});

test("unusable timing (same instant or non-finite) does not count as a trial", () => {
  let state = reduceReaction(INITIAL_REACTION_STATE, { type: "start_practice" });
  state = reduceReaction(state, { type: "stimulus", shownAt: 1000 });
  const sameInstant = press(state, 1000);
  assert.equal(sameInstant, state);
  const nonFinite = press(state, Number.NaN);
  assert.equal(nonFinite, state);
});

test("a duplicate stimulus event does not move the start time", () => {
  let state = reduceReaction(INITIAL_REACTION_STATE, { type: "start_practice" });
  state = reduceReaction(state, { type: "stimulus", shownAt: 1000 });
  const afterSecond = reduceReaction(state, { type: "stimulus", shownAt: 1500 });
  assert.equal(afterSecond.stimulusShownAt, 1000);
});

test("a completed measured run uses only measured trials and returns the median", () => {
  const practiceTimes = [100, 110, 120];
  let state = completePractice(1000, practiceTimes);
  state = reduceReaction(state, { type: "start_measured" });
  const measured = [300, 301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311];
  state = completeMeasured(state, 20000, measured);
  assert.equal(state.phase, "complete");
  assert.equal(state.result.trialCount, measured.length);
  assert.equal(state.result.medianMs, 306);
  assert.equal(state.result.capturedAt, CAPTURED_AT);
  assert.equal(state.result.falseStarts, 0);
  for (const value of practiceTimes) {
    assert.equal(state.measuredTimes.includes(value), false, "practice times are not submitted");
  }
});

test("false starts during measured trials are reported in the result", () => {
  let state = completePractice();
  state = reduceReaction(state, { type: "start_measured" });
  state = press(state, 9000);
  assert.equal(state.falseStarts, 1);
  state = completeMeasured(state, 20000, Array.from({ length: 12 }, (_, index) => 300 + index));
  assert.equal(state.falseStarts, 1);
  assert.equal(state.result.falseStarts, 1);
});

test("cancel clears the task and produces no result", () => {
  let state = completePractice();
  state = reduceReaction(state, { type: "start_measured" });
  state = reduceReaction(state, { type: "cancel" });
  assert.equal(state.phase, "cancelled");
  assert.equal(state.result, null);
  assert.equal(press(state, 30000).phase, "cancelled");
  assert.deepEqual(buildReactionResult([], state.falseStarts, CAPTURED_AT), null);
});

test("completion requires all twelve measured trials", () => {
  let state = completePractice();
  state = reduceReaction(state, { type: "start_measured" });
  state = completeMeasured(state, 20000, Array.from({ length: 11 }, () => 300));
  assert.equal(state.phase, "measured");
  assert.equal(state.measuredTimes.length, 11);
  assert.equal(state.result, null);
});

test("result is null when no completed valid trial exists", () => {
  let state = reduceReaction(INITIAL_REACTION_STATE, { type: "start_practice" });
  state = press(state, 100);
  state = press(state, 200);
  assert.equal(state.result, null);
  assert.equal(state.phase, "practice");
});
