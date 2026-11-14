import { REACTION_UNAVAILABLE_TEXT } from "./constants.ts";

export interface ReactionUnavailableProps {
  /** Engine-provided reason text; rendered exactly, including when it repeats the title. */
  reason: string | null;
  reviewInputsLabel: string;
  onReviewInputs: () => void;
}

/**
 * The engine's unavailable state for the local reaction task. It keeps the fixed title,
 * the engine reason and the review-inputs fallback together so the completed-result view
 * and the not-yet-started view cannot drift apart.
 */
export function ReactionUnavailable(props: ReactionUnavailableProps) {
  const { reason, reviewInputsLabel, onReviewInputs } = props;
  return (
    <div className="crew-checkin__unavailable" role="status">
      <p className="crew-checkin__unavailable-title">{REACTION_UNAVAILABLE_TEXT}</p>
      {reason !== null && reason !== REACTION_UNAVAILABLE_TEXT && (
        <p className="crew-checkin__hint">{reason}</p>
      )}
      <button
        className="crew-checkin__button crew-checkin__button--secondary"
        type="button"
        onClick={onReviewInputs}
      >
        {reviewInputsLabel}
      </button>
    </div>
  );
}
