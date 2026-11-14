import type { CheckInField, CheckInFormErrors, CheckInFormValues, RawCheckInForm } from "./validation.ts";
import {
  CHECK_IN_FIELD_LABELS,
  NO_ENTRIES_MESSAGE,
  hasCheckInEntries,
} from "./validation.ts";
import { SELF_REPORT_METRICS } from "./constants.ts";
import { SAMPLE_ENTRY_BADGE } from "./constants.ts";
import type { RequestStatus } from "./status.ts";

export interface CheckInFormProps {
  raw: RawCheckInForm;
  errors: CheckInFormErrors;
  values: CheckInFormValues;
  disabled: boolean;
  status: RequestStatus;
  onChange: (field: CheckInField, value: string) => void;
  onSubmit: () => void;
  onRetry: () => void;
}

const SCORE_FIELD_LABELS: Record<(typeof SELF_REPORT_METRICS)[number], string> = {
  fatigue: "Fatigue (0–10, optional)",
  mood: "Mood (0–10, optional)",
  stress: "Stress (0–10, optional)",
};

function FieldHint({ id, children }: { id?: string; children: string }) {
  return (
    <p id={id} className="crew-checkin__hint">
      {children}
    </p>
  );
}

export function CheckInForm(props: CheckInFormProps) {
  const { raw, errors, values, disabled, status, onChange, onSubmit, onRetry } = props;
  const pending = status.kind === "pending";
  const success = status.kind === "success";
  const invalid = Object.keys(errors).length > 0;
  const empty = !hasCheckInEntries(values);
  const inputsDisabled = disabled || pending;
  const submitDisabled = inputsDisabled || success || invalid || empty;

  return (
    <form
      className="crew-checkin__form"
      aria-label="Sample check-in form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!submitDisabled) {
          onSubmit();
        }
      }}
    >
      <p className="crew-checkin__disclaimer">
        Sample entries for the demo. Nothing here is a diagnosis.
      </p>

      <div className="crew-checkin__field-group">
        <label className="crew-checkin__label" htmlFor="checkin-sleep">
          {CHECK_IN_FIELD_LABELS.sleep} (minutes)
        </label>
        <input
          id="checkin-sleep"
          name="sleep"
          className="crew-checkin__input"
          type="number"
          inputMode="decimal"
          min={0}
          max={1440}
          step="any"
          value={raw.sleep}
          disabled={inputsDisabled}
          aria-invalid={errors.sleep ? true : undefined}
          aria-describedby={errors.sleep ? "checkin-sleep-error" : "checkin-sleep-hint"}
          onChange={(event) => onChange("sleep", event.target.value)}
        />
        <FieldHint id="checkin-sleep-hint">Sample entry — stored as synthetic.</FieldHint>
        {errors.sleep && (
          <p id="checkin-sleep-error" className="crew-checkin__field-error" role="alert">
            {errors.sleep}
          </p>
        )}
      </div>

      <fieldset className="crew-checkin__field-group" disabled={inputsDisabled}>
        <legend className="crew-checkin__label">{SAMPLE_ENTRY_BADGE} — optional self-reports</legend>
        <p className="crew-checkin__hint">
          Whole numbers 0–10. Leave a field blank to omit it; 0 is a real value and is sent.
        </p>
        {SELF_REPORT_METRICS.map((metric) => (
          <div className="crew-checkin__subfield" key={metric}>
            <label className="crew-checkin__label" htmlFor={`checkin-${metric}`}>
              {SCORE_FIELD_LABELS[metric]}
            </label>
            <input
              id={`checkin-${metric}`}
              name={metric}
              className="crew-checkin__input"
              type="number"
              inputMode="numeric"
              min={0}
              max={10}
              step={1}
              value={raw[metric]}
              aria-invalid={errors[metric] ? true : undefined}
              aria-describedby={errors[metric] ? `checkin-${metric}-error` : undefined}
              onChange={(event) => onChange(metric, event.target.value)}
            />
            {errors[metric] && (
              <p id={`checkin-${metric}-error`} className="crew-checkin__field-error" role="alert">
                {errors[metric]}
              </p>
            )}
          </div>
        ))}
      </fieldset>

      <div className="crew-checkin__actions">
        <button className="crew-checkin__button" type="submit" disabled={submitDisabled}>
          Submit check-in
        </button>
        {empty && !success && <p className="crew-checkin__hint">{NO_ENTRIES_MESSAGE}</p>}
      </div>

      <div className="crew-checkin__status" role="status" aria-live="polite">
        {pending && <p>Submitting check-in…</p>}
        {success && (
          <p className="crew-checkin__success">
            Check-in submitted. Edit a field to start a new check-in.
          </p>
        )}
      </div>

      {status.kind === "error" && (
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
    </form>
  );
}
