/**
 * Fixture-preview props for the standalone harness.
 * Labeled preview data only: synthetic sample entries and a fake submit callback.
 * This is not an integrated run and does not call the API.
 */

import type { CheckInAction } from "../types.ts";

export const PREVIEW_RUN_ID = "fixture-preview-run";
export const PREVIEW_SCENARIO_ID = "sleep_vigilance";
export const PREVIEW_AS_OF = "2026-01-10T09:00:00Z";

const START_ACTION: CheckInAction = {
  id: "start_reaction_check",
  label: "Run reaction check",
  required_resource_ids: ["local_reaction_task"],
  available: true,
  unavailable_reason: null,
};

const UNAVAILABLE_ACTION: CheckInAction = {
  ...START_ACTION,
  available: false,
  unavailable_reason: "Reaction check unavailable",
};

const REVIEW_INPUTS_ACTION: CheckInAction = {
  id: "review_available_inputs",
  label: "Review available inputs",
  required_resource_ids: [],
  available: true,
  unavailable_reason: null,
};

/** Engine-shaped action lists for the two preview states (available / disabled resource). */
export function previewActions(reactionAvailable: boolean): CheckInAction[] {
  if (reactionAvailable) {
    return [START_ACTION];
  }
  return [UNAVAILABLE_ACTION, REVIEW_INPUTS_ACTION];
}
