import test from "node:test";
import assert from "node:assert/strict";
import { checkInSupported, findAction, reactionAvailability } from "./viewModel.ts";

const available = {
  id: "start_reaction_check",
  label: "Run reaction check",
  required_resource_ids: ["local_reaction_task"],
  available: true,
  unavailable_reason: null,
};

const unavailable = {
  ...available,
  available: false,
  unavailable_reason: "Reaction check unavailable",
};

const fallback = {
  id: "review_available_inputs",
  label: "Review available inputs",
  required_resource_ids: [],
  available: true,
  unavailable_reason: null,
};

test("the reaction action and unavailable reason come straight from the engine actions", () => {
  const result = reactionAvailability([unavailable, fallback]);
  assert.equal(result.available, false);
  assert.equal(result.unavailableReason, "Reaction check unavailable");
  assert.equal(result.reviewAction.id, "review_available_inputs");
});

test("an available reaction action has no unavailable reason", () => {
  const result = reactionAvailability([available]);
  assert.equal(result.available, true);
  assert.equal(result.unavailableReason, null);
  assert.equal(result.reviewAction, null);
});

test("a missing action list is treated as no offered reaction check", () => {
  const result = reactionAvailability(undefined);
  assert.equal(result.action, null);
  assert.equal(result.available, false);
  assert.equal(result.unavailableReason, null);
});

test("findAction returns null for unknown ids", () => {
  assert.equal(findAction([available], "nope"), null);
  assert.equal(findAction(undefined, "start_reaction_check"), null);
});

test("the check-in only serves the sleep and vigilance scenario", () => {
  assert.equal(checkInSupported("sleep_vigilance"), true);
  assert.equal(checkInSupported("radlab_stale"), false);
});
