/**
 * LOCAL PROP/TYPE STUB — temporary.
 *
 * Hamza's shared frontend shell and published prop types (task HZ-03) are not in this
 * repository yet. The check-in feature keeps a local, explicitly labeled copy of the
 * contract shapes it consumes so the form and reaction task can be built and tested
 * standalone. Replace these imports with the shell's published types when they land and
 * report the prop-type gap to Hamza.
 *
 * Shapes follow contracts/v1.md and plans/04-mohsine-crew-checkin.md.
 */

/** Primitive metadata values accepted by an observation entry. */
export type SubmissionMetadataValue = string | number | boolean;

/** One entry of a check-in batch: metric, value and unit plus provenance ids chosen by the contract. */
export interface ObservationEntry {
  metric: string;
  value: number;
  unit: string;
  source_id: string;
  metadata?: Record<string, SubmissionMetadataValue>;
}

/**
 * Request body for POST /api/v1/runs/{run_id}/observations.
 * The server adds observation ids, subject and provenance; the client must not send them.
 */
export interface ObservationSubmission {
  submission_id: string;
  observed_at: string;
  entries: ObservationEntry[];
}

/** Action shape from the state envelope in contracts/v1.md. */
export interface CheckInAction {
  id: string;
  label: string;
  required_resource_ids: string[];
  available: boolean;
  unavailable_reason: string | null;
}

/**
 * Props for the crew check-in (local stub; pending HZ-03).
 *
 * The shell owns the mission clock and the API adapter. It passes the current mission
 * time, the engine actions that control reaction-task availability, and an async submit
 * callback scoped to {@link runId}.
 */
export interface CrewCheckInProps {
  /** Opaque run identifier the submission is scoped to; the shell's callback enforces it. */
  runId: string;
  /** Scenario id from the contract. The check-in only serves `sleep_vigilance`. */
  scenarioId: string;
  /** Current mission clock as a UTC ISO whole-second timestamp, supplied by the shell. */
  asOf: string;
  /**
   * Engine actions for the current state. The check-in reads the reaction action
   * (`start_reaction_check`) and the input-review fallback (`review_available_inputs`)
   * from this list; it never computes availability itself.
   */
  actions?: CheckInAction[];
  /**
   * Async submit callback wired by Hamza to POST /api/v1/runs/{run_id}/observations.
   * Resolve on 200/201. Reject with an Error whose message is safe to display
   * (for example a 422 validation message).
   */
  onSubmit: (payload: ObservationSubmission) => Promise<void>;
  /** Shell-owned action router, e.g. `review_available_inputs` opens the evidence drawer. */
  onAction?: (actionId: string) => void;
}
