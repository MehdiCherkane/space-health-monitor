/**
 * Pure view helpers: read reaction availability and fallback straight from the engine
 * action list. The check-in never computes availability itself (contract "UI handoff").
 */

import {
  REVIEW_AVAILABLE_INPUTS_ACTION_ID,
  START_REACTION_CHECK_ACTION_ID,
  CHECK_IN_SCENARIO_ID,
} from "./constants.ts";
import type { Action } from "./types.ts";

/** Find one action by id; null when the engine did not return it. */
export function findAction(
  actions: Action[] | undefined,
  actionId: string,
): Action | null {
  if (!actions) {
    return null;
  }
  return actions.find((action) => action.id === actionId) ?? null;
}

export interface ReactionAvailability {
  /** The engine's `start_reaction_check` action, or null when it was not returned. */
  action: Action | null;
  available: boolean;
  /** Engine-provided unavailable reason text, rendered exactly; null when available. */
  unavailableReason: string | null;
  /** The fallback action returned with an unavailable reaction resource. */
  reviewAction: Action | null;
}

export function reactionAvailability(actions: Action[] | undefined): ReactionAvailability {
  const action = findAction(actions, START_REACTION_CHECK_ACTION_ID);
  return {
    action,
    available: action?.available === true,
    unavailableReason: action && !action.available ? action.unavailable_reason : null,
    reviewAction: findAction(actions, REVIEW_AVAILABLE_INPUTS_ACTION_ID),
  };
}

/** The check-in component only serves the behavioral scenario. */
export function checkInSupported(scenarioId: string): boolean {
  return scenarioId === CHECK_IN_SCENARIO_ID;
}