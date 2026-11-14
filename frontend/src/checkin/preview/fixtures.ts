/**
 * Fixture-preview props for the standalone harness.
 * Labeled preview data only: synthetic sample entries and a fake submit callback.
 * This is not an integrated run and does not call the API.
 *
 * Shapes mirror the published shell contract (HZ-03) for the preview mount.
 */

import type { Action, Run } from "../../api/types.ts";

export const PREVIEW_RUN: Run = {
  run_id: "fixture-preview-run",
  scenario_id: "sleep_vigilance",
  initial_as_of: "2026-01-10T09:00:00Z",
  range_start: "2026-01-10T09:00:00Z",
  range_end: "2026-01-10T10:00:00Z",
};

export const PREVIEW_MISSION_TIME = "2026-01-10T09:00:00Z";

const START_ACTION: Action = {
  id: "start_reaction_check",
  label: "Run reaction check",
  required_resource_ids: ["local_reaction_task"],
  available: true,
  unavailable_reason: null,
};

const UNAVAILABLE_ACTION: Action = {
  ...START_ACTION,
  available: false,
  unavailable_reason: "Reaction check unavailable",
};

const REVIEW_INPUTS_ACTION: Action = {
  id: "review_available_inputs",
  label: "Review available inputs",
  required_resource_ids: [],
  available: true,
  unavailable_reason: null,
};

/** Engine-shaped action lists for the two preview states (available / disabled resource). */
export function previewActions(reactionAvailable: boolean): Action[] {
  if (reactionAvailable) {
    return [START_ACTION];
  }
  return [UNAVAILABLE_ACTION, REVIEW_INPUTS_ACTION];
}
