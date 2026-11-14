import { useMemo, useRef, useState } from "react";
import { CheckInForm } from "./CheckInForm.tsx";
import { ReactionResultPanel } from "./ReactionResultPanel.tsx";
import { ReactionTask } from "./ReactionTask.tsx";
import {
  REACTION_UNAVAILABLE_TEXT,
  REVIEW_AVAILABLE_INPUTS_ACTION_ID,
  REVIEW_AVAILABLE_INPUTS_LABEL,
} from "./constants.ts";
import { buildCheckInSubmission, buildReactionSubmission } from "./payload.ts";
import type { ReactionResult } from "./reactionMachine.ts";
import { SubmissionSession } from "./submission.ts";
import type { ObservationSubmission, CrewCheckInProps } from "./types.ts";
import type { RequestStatus } from "./status.ts";
import type { CheckInField, CheckInFormValues, RawCheckInForm } from "./validation.ts";
import {
  checkInSnapshot,
  hasCheckInEntries,
  validateCheckInForm,
} from "./validation.ts";
import { checkInSupported, reactionAvailability } from "./viewModel.ts";
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

export function CrewCheckIn(props: CrewCheckInProps) {
  const { scenarioId, asOf, actions, onSubmit, onAction } = props;
  const [raw, setRaw] = useState<RawCheckInForm>(EMPTY_FORM);
  const [hasEdited, setHasEdited] = useState(false);
  const [status, setStatus] = useState<RequestStatus>({ kind: "idle" });
  const [reactionStatus, setReactionStatus] = useState<RequestStatus>({ kind: "idle" });
  const [reactionView, setReactionView] = useState<"form" | "task">("form");
  const [reactionResult, setReactionResult] = useState<ReactionResult | null>(null);

  const formSessionRef = useRef<SubmissionSession<CheckInSubmitInput, ObservationSubmission> | null>(
    null,
  );
  if (formSessionRef.current === null) {
    formSessionRef.current = new SubmissionSession<CheckInSubmitInput, ObservationSubmission>({
      build: (input, submissionId) =>
        buildCheckInSubmission(input.values, submissionId, input.observedAt),
      snapshot: (input) => checkInSnapshot(input.values),
    });
  }

  const reactionSessionRef = useRef<
    SubmissionSession<ReactionSubmitInput, ObservationSubmission> | null
  >(null);
  if (reactionSessionRef.current === null) {
    reactionSessionRef.current = new SubmissionSession<ReactionSubmitInput, ObservationSubmission>({
      build: (input, submissionId) =>
        buildReactionSubmission(submissionId, input.observedAt, input.result),
      snapshot: (input) => JSON.stringify(input.result),
    });
  }

  const { values, errors } = useMemo(() => validateCheckInForm(raw), [raw]);
  const availability = useMemo(() => reactionAvailability(actions), [actions]);

  if (!checkInSupported(scenarioId)) {
    return <CheckInUnsupported />;
  }

  const formPending = status.kind === "pending";
  const reactionPending = reactionStatus.kind === "pending";

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
    const outcome = await formSessionRef.current!.submit({ values, observedAt: asOf }, onSubmit);
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
      { result, observedAt: asOf },
      onSubmit,
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
          Mission time <time dateTime={asOf}>{asOf}</time>
        </p>
      </header>

      {reactionView === "task" ? (
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
              <ReactionResultPanel
                result={reactionResult}
                status={reactionStatus}
                onRetry={() => {
                  void submitReactionResult(reactionResult);
                }}
                onRunAgain={startReaction}
              />
            ) : availability.action === null ? (
              <p className="crew-checkin__hint">No reaction check is offered for this view.</p>
            ) : availability.available ? (
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
              <div className="crew-checkin__unavailable" role="status">
                <p className="crew-checkin__unavailable-title">{REACTION_UNAVAILABLE_TEXT}</p>
                {unavailableReason !== null && unavailableReason !== REACTION_UNAVAILABLE_TEXT && (
                  <p className="crew-checkin__hint">{unavailableReason}</p>
                )}
                <button
                  className="crew-checkin__button crew-checkin__button--secondary"
                  type="button"
                  onClick={reviewInputs}
                >
                  {reviewInputsLabel}
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
