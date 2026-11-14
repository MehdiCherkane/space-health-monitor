import { useEffect, useReducer, useRef } from "react";
import {
  MEASURED_TRIAL_COUNT,
  PRACTICE_TRIAL_COUNT,
  RESPONSE_FEEDBACK_MS,
  RESPONSE_KEY_CODE,
} from "./constants.ts";
import {
  INITIAL_REACTION_STATE,
  nextStimulusDelay,
  practiceComplete,
  reduceReaction,
} from "./reactionMachine.ts";
import type { ReactionResult } from "./reactionMachine.ts";

export interface ReactionTaskProps {
  onCompleted: (result: ReactionResult) => void;
  onCancel: () => void;
  /** Monotonic clock; defaults to performance.now(). */
  now?: () => number;
  /** Stimulus delay source; defaults to Math.random. */
  random?: () => number;
}

const DEFAULT_NOW = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

const DEFAULT_RANDOM = (): number => Math.random();

export function ReactionTask(props: ReactionTaskProps) {
  const { onCompleted, onCancel, now = DEFAULT_NOW, random = DEFAULT_RANDOM } = props;
  const [state, dispatch] = useReducer(reduceReaction, INITIAL_REACTION_STATE);
  const timerRef = useRef<number | null>(null);
  const reportedRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const inTrialPhase = state.phase === "practice" || state.phase === "measured";
  const practiceDone = practiceComplete(state);

  // Move keyboard/screen-reader focus to the new screen heading after each phase change.
  useEffect(() => {
    headingRef.current?.focus();
  }, [state.phase, practiceDone]);

  // Report a completed result exactly once; the parent submits it automatically.
  useEffect(() => {
    if (state.phase === "complete" && state.result !== null && !reportedRef.current) {
      reportedRef.current = true;
      onCompleted(state.result);
    }
  }, [state.phase, state.result, onCompleted]);

  // Schedule the next stimulus while the task is waiting.
  useEffect(() => {
    if (!inTrialPhase || state.stimulusShownAt !== null) {
      return undefined;
    }
    if (state.phase === "practice" && practiceDone) {
      return undefined;
    }
    const feedbackDelay = state.feedback === "recorded" ? RESPONSE_FEEDBACK_MS : 0;
    const delay = feedbackDelay + nextStimulusDelay(random);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      dispatch({ type: "stimulus", shownAt: now() });
    }, delay);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    inTrialPhase,
    practiceDone,
    state.phase,
    state.trialIndex,
    state.stimulusShownAt,
    state.feedback,
    state.falseStarts,
    state.practiceTimes.length,
    state.measuredTimes.length,
    now,
    random,
  ]);

  // Single-key response. Held-key repeats are ignored by the reducer, and the listener is
  // removed once the practice step is complete so no false start can be counted off-screen.
  useEffect(() => {
    if (!inTrialPhase || (state.phase === "practice" && practiceDone)) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== RESPONSE_KEY_CODE && event.key !== " ") {
        return;
      }
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("button, a, input, textarea, select")) {
        return;
      }
      event.preventDefault();
      dispatch({
        type: "press",
        at: now(),
        repeat: event.repeat,
        capturedAt: new Date().toISOString(),
      });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inTrialPhase, practiceDone, state.phase, now]);

  const cancel = () => {
    dispatch({ type: "cancel" });
    onCancel();
  };

  if (state.phase === "instructions") {
    return (
      <section className="crew-checkin__reaction-task" aria-labelledby="reaction-task-title">
        <h3 id="reaction-task-title" ref={headingRef} tabIndex={-1}>
          Local reaction check
        </h3>
        <p>
          This short check measures how quickly you press a key after a prompt turns green.
          It takes about 30–60 seconds. Practice trials are not recorded.
        </p>
        <ul className="crew-checkin__list">
          <li>Press the space bar only when the prompt turns green.</li>
          <li>A press before the green prompt counts as a false start.</li>
          <li>There is no clinical cutoff for this demo task.</li>
        </ul>
        <div className="crew-checkin__actions">
          <button
            className="crew-checkin__button"
            type="button"
            onClick={() => dispatch({ type: "start_practice" })}
          >
            Start practice
          </button>
          <button
            className="crew-checkin__button crew-checkin__button--secondary"
            type="button"
            onClick={cancel}
          >
            Cancel reaction check
          </button>
        </div>
      </section>
    );
  }

  if (state.phase === "cancelled") {
    return null;
  }

  if (state.phase === "practice" && practiceDone) {
    return (
      <section className="crew-checkin__reaction-task" aria-labelledby="reaction-practice-done">
        <h3 id="reaction-practice-done" ref={headingRef} tabIndex={-1}>
          Practice complete
        </h3>
        <p>The measured trials start next. Press the space bar only when the prompt turns green.</p>
        <div className="crew-checkin__actions">
          <button
            className="crew-checkin__button"
            type="button"
            onClick={() => dispatch({ type: "start_measured" })}
          >
            Start measured trials
          </button>
          <button
            className="crew-checkin__button crew-checkin__button--secondary"
            type="button"
            onClick={cancel}
          >
            Cancel reaction check
          </button>
        </div>
      </section>
    );
  }

  const totalTrials = state.phase === "practice" ? PRACTICE_TRIAL_COUNT : MEASURED_TRIAL_COUNT;
  const trialNumber = Math.min(state.trialIndex + 1, totalTrials);
  const stimulusVisible = state.stimulusShownAt !== null;

  return (
    <section className="crew-checkin__reaction-task" aria-labelledby="reaction-trial-title">
      <h3 id="reaction-trial-title" ref={headingRef} tabIndex={-1}>
        {state.phase === "practice" ? "Practice trial" : "Measured trial"} {trialNumber} of {totalTrials}
      </h3>
      <p className="crew-checkin__hint">False starts so far: {state.falseStarts}</p>
      <div
        className={`crew-checkin__stimulus ${stimulusVisible ? "crew-checkin__stimulus--go" : ""}`}
        aria-live="assertive"
        aria-atomic="true"
      >
        {stimulusVisible ? "Press the space bar now!" : "Wait for the green prompt…"}
      </div>
      <div className="crew-checkin__status" role="status" aria-live="polite">
        {state.feedback === "false_start" && <p>False start — wait for the green prompt.</p>}
        {state.feedback === "recorded" && <p>Recorded. Get ready for the next trial.</p>}
      </div>
      <div className="crew-checkin__actions">
        <button
          className="crew-checkin__button crew-checkin__button--secondary"
          type="button"
          onClick={cancel}
        >
          Cancel reaction check
        </button>
      </div>
    </section>
  );
}
