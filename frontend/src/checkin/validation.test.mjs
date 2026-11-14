import test from "node:test";
import assert from "node:assert/strict";
import {
  NO_ENTRIES_MESSAGE,
  SCORE_INVALID_MESSAGE,
  SLEEP_INVALID_MESSAGE,
  checkInSnapshot,
  hasCheckInEntries,
  parseScore,
  parseSleepMinutes,
  validateCheckInForm,
} from "./validation.ts";

const BLANKS = { sleep: "", fatigue: "", mood: "", stress: "" };

test("blank fields are valid and become null values", () => {
  const { values, errors } = validateCheckInForm(BLANKS);
  assert.deepEqual(errors, {});
  assert.deepEqual(values, { sleepMinutes: null, fatigue: null, mood: null, stress: null });
});

test("sleep accepts numeric values inside 0-1440 and rejects the rest", () => {
  for (const raw of ["0", "420", "1440", "420.5"]) {
    const parsed = parseSleepMinutes(raw);
    assert.equal(parsed.ok, true, raw);
  }
  assert.equal(parseSleepMinutes("0").value, 0);
  assert.equal(parseSleepMinutes("420.5").value, 420.5);
  for (const raw of ["-1", "1441", "abc", "NaN", "Infinity"]) {
    const parsed = parseSleepMinutes(raw);
    assert.equal(parsed.ok, false, raw);
    assert.equal(parsed.value, null);
  }
});

test("optional scores require integers from 0 to 10 and keep 0", () => {
  assert.deepEqual(parseScore(""), { ok: true, value: null });
  assert.deepEqual(parseScore("0"), { ok: true, value: 0 });
  assert.deepEqual(parseScore("10"), { ok: true, value: 10 });
  for (const raw of ["4.5", "11", "-1", "abc"]) {
    assert.equal(parseScore(raw).ok, false, raw);
  }
});

test("invalid field errors use the contract-derived messages", () => {
  const { errors } = validateCheckInForm({ sleep: "2000", fatigue: "3.5", mood: "11", stress: "" });
  assert.equal(errors.sleep, SLEEP_INVALID_MESSAGE);
  assert.equal(errors.fatigue, SCORE_INVALID_MESSAGE);
  assert.equal(errors.mood, SCORE_INVALID_MESSAGE);
  assert.equal(errors.stress, undefined);
});

test("hasCheckInEntries treats zero as a value", () => {
  assert.equal(hasCheckInEntries({ sleepMinutes: null, fatigue: null, mood: null, stress: null }), false);
  assert.equal(hasCheckInEntries({ sleepMinutes: 0, fatigue: null, mood: null, stress: null }), true);
  assert.equal(hasCheckInEntries({ sleepMinutes: null, fatigue: 0, mood: null, stress: null }), true);
});

test("the entry hint is available for the empty form", () => {
  assert.equal(typeof NO_ENTRIES_MESSAGE, "string");
  assert.ok(NO_ENTRIES_MESSAGE.length > 0);
});

test("snapshot ignores nothing and separates distinct inputs", () => {
  const one = { sleepMinutes: 420, fatigue: 0, mood: null, stress: null };
  const two = { sleepMinutes: 420, fatigue: null, mood: 0, stress: null };
  assert.equal(checkInSnapshot(one), checkInSnapshot({ ...one }));
  assert.notEqual(checkInSnapshot(one), checkInSnapshot(two));
});
