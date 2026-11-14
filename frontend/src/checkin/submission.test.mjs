import test from "node:test";
import assert from "node:assert/strict";
import {
  SubmissionSession,
  createSubmissionId,
  displayableErrorMessage,
} from "./submission.ts";

function makeSession(ids) {
  const sequence = [...ids];
  const calls = { build: 0 };
  const session = new SubmissionSession({
    build: (input, submissionId) => {
      calls.build += 1;
      return {
        submission_id: submissionId,
        observed_at: input.observedAt,
        entries: [{ source_id: "crew_sleep_log", metric: "sleep_duration", value: input.sleep, unit: "min" }],
      };
    },
    snapshot: (input) => JSON.stringify([input.sleep]),
    createId: () => sequence.shift(),
  });
  return { session, calls };
}

test("a successful submit resolves once and clears the pending payload", async () => {
  const { session } = makeSession(["id-1"]);
  const seen = [];
  const outcome = await session.submit({ sleep: 420, observedAt: "t1" }, async (payload) => {
    seen.push(payload);
  });
  assert.deepEqual(outcome, { status: "submitted" });
  assert.equal(seen.length, 1);
  assert.equal(session.pending, null);
});

test("a retry after rejection reuses the same id, payload and mission timestamp", async () => {
  const { session, calls } = makeSession(["id-1"]);
  const seen = [];
  const reject = async () => {
    throw new Error("Server unavailable");
  };
  const first = await session.submit({ sleep: 420, observedAt: "09:00:00Z" }, reject);
  assert.equal(first.status, "rejected");
  const second = await session.submit({ sleep: 420, observedAt: "09:05:00Z" }, async (payload) => {
    seen.push(payload);
  });
  assert.equal(second.status, "submitted");
  assert.equal(seen.length, 1);
  assert.equal(seen[0].submission_id, "id-1");
  assert.equal(seen[0].observed_at, "09:00:00Z", "retry keeps the original mission timestamp");
  assert.equal(calls.build, 1, "the payload is not rebuilt on retry");
});

test("changing the input after a rejection starts a new submission with a new id", async () => {
  const { session, calls } = makeSession(["id-1", "id-2"]);
  const seen = [];
  const reject = async () => {
    throw new Error("Server unavailable");
  };
  await session.submit({ sleep: 420, observedAt: "t1" }, reject);
  const outcome = await session.submit({ sleep: 430, observedAt: "t1" }, async (payload) => {
    seen.push(payload);
  });
  assert.equal(outcome.status, "submitted");
  assert.equal(seen[0].submission_id, "id-2");
  assert.equal(calls.build, 2);
});

test("a duplicate submit while one is in flight is ignored", async () => {
  const { session } = makeSession(["id-1"]);
  const seen = [];
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const first = session.submit({ sleep: 420, observedAt: "t1" }, async (payload) => {
    seen.push(payload);
    await gate;
  });
  const duplicate = await session.submit({ sleep: 420, observedAt: "t1" }, async (payload) => {
    seen.push(payload);
  });
  assert.deepEqual(duplicate, { status: "ignored" });
  assert.equal(seen.length, 1);
  release();
  assert.equal((await first).status, "submitted");
});

test("rejections keep their displayable message", async () => {
  const { session } = makeSession(["id-1"]);
  const outcome = await session.submit({ sleep: 420, observedAt: "t1" }, async () => {
    throw new Error("Invalid sleep value");
  });
  assert.deepEqual(outcome, { status: "rejected", message: "Invalid sleep value" });
});

test("submission ids are non-empty opaque strings", () => {
  const first = createSubmissionId();
  const second = createSubmissionId();
  assert.equal(typeof first, "string");
  assert.ok(first.length > 0);
  assert.notEqual(first, second);
});

test("non-Error rejections still produce displayable text", () => {
  assert.equal(displayableErrorMessage(new Error("422 message")), "422 message");
  assert.equal(displayableErrorMessage("plain text"), "plain text");
  assert.ok(displayableErrorMessage(undefined).length > 0);
});
