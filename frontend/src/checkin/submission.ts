/**
 * Submission lifecycle with a stable submission id.
 *
 * Retry rules from the plan (MO-07/MO-10): disable duplicate sends while a request is in
 * flight; on failure reuse the original payload, mission timestamp and submission id; if
 * the user changes the input, the next send starts a new submission with a new id.
 * File-local logic only — no fetch and no shell dependency.
 */

/** Result of one submit attempt through {@link SubmissionSession}. */
export type SubmitOutcome =
  | { status: "submitted" }
  | { status: "rejected"; message: string }
  | { status: "ignored" };

export interface SubmissionSessionOptions<TInput, TPayload> {
  /** Build the payload for a new submission (called once per distinct input). */
  build: (input: TInput, submissionId: string) => TPayload;
  /** Stable snapshot of the user-visible input; retries with the same snapshot reuse the pending payload. */
  snapshot: (input: TInput) => string;
  /** Opaque unique id factory; defaults to {@link createSubmissionId}. */
  createId?: () => string;
}

/** Non-empty opaque submission id (contract D8: any unique opaque string). */
export function createSubmissionId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return `submission-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

/** Turn a rejection into text the UI can display (server 422 messages pass through). */
export function displayableErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  if (typeof error === "string" && error.trim() !== "") {
    return error;
  }
  return "Submission failed. Please retry.";
}

export class SubmissionSession<TInput, TPayload> {
  private readonly build: (input: TInput, submissionId: string) => TPayload;

  private readonly snapshot: (input: TInput) => string;

  private readonly createId: () => string;

  private pendingPayload: TPayload | null = null;

  private pendingSnapshot: string | null = null;

  private inFlight = false;

  constructor(options: SubmissionSessionOptions<TInput, TPayload>) {
    this.build = options.build;
    this.snapshot = options.snapshot;
    this.createId = options.createId ?? createSubmissionId;
  }

  /** The payload that a retry would reuse; null when there is no pending submission. */
  get pending(): TPayload | null {
    return this.pendingPayload;
  }

  /** Forget the pending submission; call when the user edits the input. */
  reset(): void {
    this.pendingPayload = null;
    this.pendingSnapshot = null;
  }

  /**
   * Send at most once at a time. A second call while the first is in flight is ignored.
   * On rejection the pending payload/id are kept for an identical retry.
   */
  async submit(input: TInput, send: (payload: TPayload) => Promise<void>): Promise<SubmitOutcome> {
    if (this.inFlight) {
      return { status: "ignored" };
    }
    const snapshot = this.snapshot(input);
    let payload = this.pendingPayload;
    if (payload === null || this.pendingSnapshot !== snapshot) {
      payload = this.build(input, this.createId());
      this.pendingPayload = payload;
      this.pendingSnapshot = snapshot;
    }
    this.inFlight = true;
    try {
      await send(payload);
      this.reset();
      return { status: "submitted" };
    } catch (error) {
      return { status: "rejected", message: displayableErrorMessage(error) };
    } finally {
      this.inFlight = false;
    }
  }
}
