import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCheckInEntries,
  buildCheckInSubmission,
  buildReactionSubmission,
} from "./payload.ts";

const capturedAt = "2026-01-10T09:02:03Z";

test("blank optional values are omitted from the entries", () => {
  const entries = buildCheckInEntries({ sleepMinutes: null, fatigue: null, mood: null, stress: null });
  assert.deepEqual(entries, []);
});

test("sleep and self-report entries use the fixed source, metric and unit names", () => {
  const entries = buildCheckInEntries({ sleepMinutes: 420, fatigue: 3, mood: 0, stress: 7 });
  assert.deepEqual(entries, [
    { source_id: "crew_sleep_log", metric: "sleep_duration", value: 420, unit: "min" },
    { source_id: "crew_self_report", metric: "fatigue", value: 3, unit: "score_0_10" },
    { source_id: "crew_self_report", metric: "mood", value: 0, unit: "score_0_10" },
    { source_id: "crew_self_report", metric: "stress", value: 7, unit: "score_0_10" },
  ]);
});

test("zero is retained while blank fields stay absent", () => {
  const entries = buildCheckInEntries({ sleepMinutes: null, fatigue: 0, mood: null, stress: 0 });
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((entry) => entry.value), [0, 0]);
});

test("submission payload has exactly submission_id, observed_at and entries", () => {
  const payload = buildCheckInSubmission(
    { sleepMinutes: 420, fatigue: null, mood: null, stress: null },
    "opaque-id-1",
    "2026-01-10T09:00:00Z",
  );
  assert.deepEqual(Object.keys(payload).sort(), ["entries", "observed_at", "submission_id"]);
  assert.equal(payload.submission_id, "opaque-id-1");
  assert.equal(payload.observed_at, "2026-01-10T09:00:00Z");
});

test("the client never sends provenance or subject", () => {
  const payload = buildCheckInSubmission(
    { sleepMinutes: 420, fatigue: 2, mood: 5, stress: 1 },
    "opaque-id-2",
    "2026-01-10T09:00:00Z",
  );
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes("provenance"), false);
  assert.equal(serialized.includes("subject"), false);
});

test("reaction payload carries the contract metadata and capture time", () => {
  const payload = buildReactionSubmission("opaque-id-3", "2026-01-10T09:00:00Z", {
    medianMs: 312,
    trialCount: 12,
    falseStarts: 1,
    capturedAt,
  });
  assert.equal(payload.entries.length, 1);
  const [entry] = payload.entries;
  assert.equal(entry.source_id, "reaction_task");
  assert.equal(entry.metric, "reaction_time");
  assert.equal(entry.unit, "ms");
  assert.equal(entry.value, 312);
  assert.deepEqual(entry.metadata, {
    task_version: "demo-rt-v1",
    input_profile: "browser-keyboard",
    trial_count: 12,
    false_starts: 1,
    completed: true,
    captured_at: capturedAt,
  });
  assert.equal(payload.observed_at, "2026-01-10T09:00:00Z");
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes("provenance"), false);
  assert.equal(serialized.includes("subject"), false);
});
