/**
 * Contract types mirrored from Hamza's published shell contract (HZ-03).
 *
 * Source: `frontend/src/api/types.ts` on `origin/build/replay-api` at commit
 * `bd2f71bd6f9724c2559c9a48517cf71300e0e883` (the shared shell is not merged into this
 * branch yet). Names and shapes below are copied from that published contract. When the
 * shell lands, replace these declarations with imports from `../api/types.ts`; call sites
 * keep the same type names.
 *
 * Local deltas and open decisions are recorded in README.md:
 * - `CrewCheckInProps` adds required `onAction` because MO-12/B04 needs a clickable
 *   `review_available_inputs` fallback; it is not in the published `CheckInProps` yet.
 * - The component generates and reuses `submission_id` to preserve MO-07 retry semantics;
 *   Hamza's D8 note says the shell generates it. See README open item 1.
 */

export type ScenarioId = "radlab_stale" | "sleep_vigilance";

/** State-envelope action shape from contracts/v1.md and the published shell types. */
export interface Action {
  id: string;
  label: string;
  required_resource_ids: string[];
  available: boolean;
  unavailable_reason: string | null;
}

/** Run metadata returned by `POST /api/v1/runs`. */
export interface Run {
  run_id: string;
  scenario_id: ScenarioId;
  initial_as_of: string;
  range_start: string;
  range_end: string;
}

/** One entry of a check-in submission batch. */
export interface SubmissionEntry {
  metric: string;
  value: number;
  unit: string;
  source_id: string;
  metadata?: Record<string, unknown>;
}

/** Request body for `POST /api/v1/runs/{run_id}/observations`. */
export interface SubmissionRequest {
  submission_id: string;
  observed_at: string;
  entries: SubmissionEntry[];
}

/** Response from `POST /api/v1/runs/{run_id}/observations`. */
export interface SubmissionResponse {
  submission_id: string;
  observation_ids: string[];
}

/** Props published by Hamza's shell (HZ-03) for the crew check-in. */
export interface CheckInProps {
  run: Run;
  scenarioId: ScenarioId;
  missionTime: string;
  actions: Action[];
  onSubmit(submission: SubmissionRequest): Promise<SubmissionResponse>;
}

/**
 * Props used by this component: the published contract plus the action router needed for
 * the unavailable-reaction fallback (MO-12/B04). Ask Hamza to add `onAction` to the
 * published `CheckInProps` when he mounts this export.
 */
export interface CrewCheckInProps extends CheckInProps {
  /** Shell-owned route for `review_available_inputs` (evidence drawer). */
  onAction: (actionId: string) => void;
}
