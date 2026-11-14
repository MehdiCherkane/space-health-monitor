import { useEffect, useRef } from "react";
import { DEVICE_MEASUREMENT_BADGE } from "./constants.ts";
import type { ReactionResult } from "./reactionMachine.ts";
import type { RequestStatus } from "./status.ts";

export interface ReactionResultPanelProps {
  result: ReactionResult;
  status: RequestStatus;
  onRetry: () => void;
  onRunAgain: () => void;
  /** Latest engine availability. False keeps the measured result but blocks a restart. */
  actionAvailable: boolean;
}

export function ReactionResultPanel(props: ReactionResultPanelProps) {
  const { result, status, onRetry, onRunAgain, actionAvailable } = props;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pending = status.kind === "pending";
  const success = status.kind === "success";
  const failed = status.kind === "error";
  const canRunAgain = actionAvailable && !pending && !failed;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className="crew-checkin__reaction-result" aria-labelledby="reaction-result-title">
      <h3 id="reaction-result-title" ref={headingRef} tabIndex={-1}>
        Reaction check complete
      </h3>
      <p className="crew-checkin__badge">{DEVICE_MEASUREMENT_BADGE}</p>
      <p className="crew-checkin__hint">
        The completed result is submitted automatically, once. A failed submission can be retried
        without repeating the task.
      </p>
      <dl className="crew-checkin__result-list">
        <div>
          <dt>Median response time</dt>
          <dd>{result.medianMs} ms</dd>
        </div>
        <div>
          <dt>Valid trials</dt>
          <dd>{result.trialCount}</dd>
        </div>
        <div>
          <dt>False starts</dt>
          <dd>{result.falseStarts}</dd>
        </div>
      </dl>
      <p className="crew-checkin__hint">
        This short check measures response time for the demo. It has no clinical cutoff and gives
        no diagnosis.
      </p>
      <div className="crew-checkin__actions">
        <button
          className="crew-checkin__button crew-checkin__button--secondary"
          type="button"
          onClick={() => {
            if (canRunAgain) {
              onRunAgain();
            }
          }}
          disabled={!canRunAgain}
        >
          Run reaction check again
        </button>
      </div>
      <div className="crew-checkin__status" role="status" aria-live="polite">
        {pending && <p>Submitting reaction result…</p>}
        {success && <p className="crew-checkin__success">Reaction result submitted.</p>}
      </div>
      {failed && (
        <div className="crew-checkin__request-error" role="alert">
          <p>{status.message}</p>
          <button
            className="crew-checkin__button crew-checkin__button--secondary"
            type="button"
            onClick={onRetry}
            disabled={pending}
          >
            Retry submission
          </button>
        </div>
      )}
    </section>
  );
}
