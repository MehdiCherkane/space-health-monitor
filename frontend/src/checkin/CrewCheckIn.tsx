import { useEffect, useMemo, useRef, useState } from "react";
import { CheckInForm } from "./CheckInForm.tsx";
import { ReactionResultPanel } from "./ReactionResultPanel.tsx";
import { ReactionTask } from "./ReactionTask.tsx";
import { ReactionUnavailable } from "./ReactionUnavailable.tsx";
import {
  REVIEW_AVAILABLE_INPUTS_ACTION_ID,
  REVIEW_AVAILABLE_INPUTS_LABEL,
} from "./constants.ts";
import { buildCheckInSubmission, buildReactionSubmission } from "./payload.ts";
import type { ReactionResult } from "./reactionMachine.ts";
import { SubmissionSession } from "./submission.ts";
import type { CheckInProps, SubmissionRequest } from "../api/types.ts";
import type { RequestStatus } from "./status.ts";
import type { CheckInField, CheckInFormValues, RawCheckInForm } from "./validation.ts";
import { checkInSnapshot, hasCheckInEntries, validateCheckInForm } from "./validation.ts";
import { checkInSupported, reactionAvailability } from "./viewModel.ts";
import { formatUtc } from "../ui/format.ts";
import "./checkin.css";

const EMPTY_FORM: RawCheckInForm = { sleep: "", fatigue: "", mood: "", stress: "" };

interface CheckInSubmitInput {
  values: CheckInFormValues;
  observedAt: string;
}

interface ReactionSubmitInput {
  result: ReactionResult;
  observedAt: string;
}

function CheckInUnsupported() {
  return (
    <section className="crew-checkin" aria-labelledby="crew-checkin-title">
      <h2 id="crew-checkin-title">Crew check-in</h2>
      <p className="crew-checkin__hint">
        The crew check-in is available in the sleep and vigilance scenario.
      </p>
    </section>
  );
}

export function CrewCheckIn(props: CheckInProps) {
  const { scenarioId, missionTime, actions, onSubmit, onAction } = props;
  const [raw, setRaw] = useState<RawCheckInForm>(EMPTY_FORM);
  const [hasEdited, setHasEdited] = useState(false);
  const [status, setStatus] = useState<RequestStatus>({ kind: "idle" });
  const [reactionStatus, setReactionStatus] = useState<RequestStatus>({ kind: "idle" });
  const [reactionView, setReactionView] = useState<"form" | "task">("form");
  const [reactionResult, setReactionResult] = useState<ReactionResult | null>(null);

  const formSessionRef = useRef<SubmissionSession<CheckInSubmitInput, SubmissionRequest> | null>(
    null,
  );
  if (formSessionRef.current === null) {
    formSessionRef.current = new SubmissionSession<CheckInSubmitInput, SubmissionRequest>({
      build: (input, submissionId) =>
        buildCheckInSubmission(input.values, submissionId, input.observedAt),
      snapshot: (input) => checkInSnapshot(input.values),
    });
  }

  const reactionSessionRef = useRef<SubmissionSession<ReactionSubmitInput, SubmissionRequest> | null>(
    null,
  );
  if (reactionSessionRef.current === null) {
    reactionSessionRef.current = new SubmissionSession<
      ReactionSubmitInput,
      SubmissionRequest
    >({
      build: (input, submissionId) =>
        buildReactionSubmission(submissionId, input.observedAt, input.result),
      snapshot: (input) => JSON.stringify(input.result),
    });
  }

  const { values, errors } = useMemo(() => validateCheckInForm(raw), [raw]);
  const availability = useMemo(() => reactionAvailability(actions), [actions]);

  // Keep the newest availability reachable from callbacks. React events normally use the
  // latest handler, but a retained/stale button must still be rejected at the callback
  // boundary rather than relying only on the button's disabled state.
  const availabilityRef = useRef(availability);
  availabilityRef.current = availability;

  // If the engine withdraws the resource during a measurement, unmount ReactionTask. Its
  // effects clear the stimulus timer and key listener, and the interrupted run submits
  // nothing. A later available action starts a fresh instructed task.
  useEffect(() => {
    if (reactionView === "task" && !availability.available) {
      reactionSessionRef.current?.reset();
      setReactionView("form");
      setReactionResult(null);
      setReactionStatus({ kind: "idle" });
    }
  }, [reactionView, availability.available]);

  if (!checkInSupported(scenarioId)) {
    return <CheckInUnsupported />;
  }

  const formPending = status.kind === "pending";
  const reactionPending = reactionStatus.kind === "pending";

  // The shell's callback publishes SubmissionResponse; the lifecycle only needs completion.
  const sendSubmission = async (payload: SubmissionRequest): Promise<void> => {
    await onSubmit(payload);
  };

  const handleChange = (field: CheckInField, value: string) => {
    setRaw((previous) => ({ ...previous, [field]: value }));
    setHasEdited(true);
    formSessionRef.current?.reset();
    setStatus((previous) => (previous.kind === "idle" ? previous : { kind: "idle" }));
  };

  const submitForm = async () => {
    if (status.kind === "pending") {
      return;
    }
    if (Object.keys(errors).length > 0 || !hasCheckInEntries(values)) {
      return;
    }
    setStatus({ kind: "pending" });
    const outcome = await formSessionRef.current!.submit(
      { values, observedAt: missionTime },
      sendSubmission,
    );
    if (outcome.status === "submitted") {
      setStatus({ kind: "success" });
    } else if (outcome.status === "rejected") {
      setStatus({ kind: "error", message: outcome.message });
    } else {
      setStatus({ kind: "idle" });
    }
  };

  const submitReactionResult = async (result: ReactionResult) => {
    setReactionStatus({ kind: "pending" });
    const outcome = await reactionSessionRef.current!.submit(
      { result, observedAt: missionTime },
      sendSubmission,
    );
    if (outcome.status === "submitted") {
      setReactionStatus({ kind: "success" });
    } else if (outcome.status === "rejected") {
      setReactionStatus({ kind: "error", message: outcome.message });
    } else {
      setReactionStatus({ kind: "idle" });
    }
  };

  const startReaction = () => {
    // Authoritative gate: availability is re-read from the newest props even when this
    // callback was captured by an older result view.
    if (!availabilityRef.current.available) {
      return;
    }
    reactionSessionRef.current?.reset();
    setReactionResult(null);
    setReactionStatus({ kind: "idle" });
    setReactionView("task");
  };

  // A completed check submits its result automatically, exactly once (ReactionTask reports
  // completion once and the submission session ignores duplicate in-flight calls).
  const handleReactionCompleted = (result: ReactionResult) => {
    setReactionResult(result);
    setReactionView("form");
    void submitReactionResult(result);
  };

  const handleReactionCancel = () => {
    setReactionView("form");
  };

  const reviewInputsLabel = availability.reviewAction?.label ?? REVIEW_AVAILABLE_INPUTS_LABEL;
  const reviewInputs = () => {
    onAction(REVIEW_AVAILABLE_INPUTS_ACTION_ID);
  };
  const unavailableReason = availability.unavailableReason;

  return (
    <section className="crew-checkin" aria-labelledby="crew-checkin-title">
      <header className="crew-checkin__header">
        <h2 id="crew-checkin-title">Crew check-in</h2>
        <p className="crew-checkin__mission">
          Mission time <time dateTime={missionTime}>{formatUtc(missionTime)}</time>
        </p>
      </header>

      {reactionView === "task" && availability.available ? (
        <ReactionTask onCompleted={handleReactionCompleted} onCancel={handleReactionCancel} />
      ) : (
        <>
          <CheckInForm
            raw={raw}
            errors={errors}
            values={values}
            disabled={formPending}
            status={status}
            showEmptyHint={hasEdited}
            onChange={handleChange}
            onSubmit={() => {
              void submitForm();
            }}
            onRetry={() => {
              void submitForm();
            }}
          />

          <section className="crew-checkin__reaction" aria-labelledby="reaction-title">
            <h3 id="reaction-title">Reaction check</h3>
            {reactionResult !== null ? (
              <>
                <ReactionResultPanel
                  result={reactionResult}
                  status={reactionStatus}
                  onRetry={() => {
                    void submitReactionResult(reactionResult);
                  }}
                  onRunAgain={startReaction}
                  actionAvailable={availability.available}
                />
                {!availability.available && (
                  <ReactionUnavailable
                    reason={unavailableReason}
                    reviewInputsLabel={reviewInputsLabel}
                    onReviewInputs={reviewInputs}
                  />
                )}
              </>
            ) : availability.available && availability.action !== null ? (
              <div className="crew-checkin__actions">
                <button
                  className="crew-checkin__button"
                  type="button"
                  onClick={startReaction}
                  disabled={formPending || reactionPending}
                >
                  {availability.action.label}
                </button>
                <p className="crew-checkin__hint">
                  A short local check, measured on this device. Practice trials are not recorded.
                </p>
              </div>
            ) : (
              <ReactionUnavailable
                reason={unavailableReason}
                reviewInputsLabel={reviewInputsLabel}
                onReviewInputs={reviewInputs}
              />
            )}
          </section>
        </>
      )}
    </section>
  );
}
