import type { ReactNode } from 'react'

import type { DashboardProps, Observation, ScenarioId, StateEnvelope } from '../api/types'
import {
  ActionButton,
  AssessmentPanel,
  Drawer,
  EvidenceList,
  IncidentRow,
  MissingInputs,
  ProvenanceBadge,
  SourceCard,
  StateMessage,
  UtcTime,
  formatTime,
  formatUtc,
  formatValue,
  indexObservations,
} from '../ui'
import './dashboard.css'

const SCENARIOS: { id: ScenarioId; label: string; provenance: string }[] = [
  { id: 'radlab_stale', label: 'Detector gap (RadLab)', provenance: 'Historical NASA telemetry' },
  { id: 'sleep_vigilance', label: 'Sleep and vigilance', provenance: 'Synthetic crew scenario' },
]

/**
 * Renders the engine envelope the shell hands over. It never fetches, never filters by
 * time and never computes a status; every label and state comes from props.
 */
export function Dashboard(
  props: DashboardProps & { aside?: ReactNode; hideControls?: boolean },
) {
  const { state, dataMode, status, error, clock } = props
  const preview = dataMode === 'fixture-preview'

  return (
    <div className="dash">
      {!props.hideControls && <ReplayControls {...props} preview={preview} />}

      {preview && state && !props.hideControls && (
        <p className="dash-preview" role="note">
          <strong>Fixture preview.</strong> This is the contract example, a fixed snapshot at{' '}
          <UtcTime iso={state.as_of} />. It is not engine output and cannot be replayed; the
          checkpoints activate once this run holds stored observations.
        </p>
      )}

      <div className="dash-grid">
        <div className="dash-main">
          {status === 'error' && (
            <StateMessage kind="error" onRetry={props.onRetry}>
              {error ?? 'The state could not be loaded.'}
              {clock && (
                <>
                  {' '}
                  No state is shown for <UtcTime iso={clock} />.
                </>
              )}
            </StateMessage>
          )}
          {status === 'loading' && !state && (
            <StateMessage kind="loading">
              Loading state{clock ? ` at ${formatUtc(clock)}` : ''}…
            </StateMessage>
          )}
          {state && <MainColumn {...props} state={state} />}
        </div>
        <div className="dash-side">
          {props.aside}
          {state && <IncidentHistory state={state} />}
          {state && <SourceHistory {...props} state={state} />}
        </div>
      </div>

      <EvidenceDrawer {...props} />
    </div>
  )
}

function ReplayControls(props: DashboardProps & { preview: boolean }) {
  const { scenarioId, checkpoints, clock, preview, status } = props
  return (
    <section className="dash-controls ui-card" aria-labelledby="controls-title">
      <h2 id="controls-title" className="visually-hidden">
        Replay controls
      </h2>
      <div className="dash-controls__group">
        <p className="dash-label" id="scenario-label">
          Scenario
        </p>
        <div className="dash-segment" role="group" aria-labelledby="scenario-label">
          {SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              className="dash-segment__option"
              aria-pressed={scenarioId === scenario.id}
              onClick={() => props.onScenarioChange(scenario.id)}
            >
              <span className="dash-segment__title">{scenario.label}</span>
              <span className="dash-segment__sub">{scenario.provenance}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="dash-controls__group">
        <p className="dash-label" id="clock-label">
          Replay clock
        </p>
        <p className="dash-clock mono" aria-live="polite" aria-labelledby="clock-label">
          {clock ? formatUtc(clock) : '—'}
        </p>
      </div>

      <div className="dash-controls__group dash-controls__wide">
        <p className="dash-label" id="checkpoint-label">
          Checkpoints
        </p>
        <div className="dash-checkpoints" role="group" aria-labelledby="checkpoint-label">
          {checkpoints.map((checkpoint) => (
            <button
              key={checkpoint.id}
              type="button"
              className="ui-button ui-button--secondary mono"
              aria-pressed={clock === checkpoint.as_of}
              disabled={preview || status === 'idle'}
              aria-describedby="checkpoint-preview-note"
              onClick={() => props.onSeek(checkpoint.as_of)}
            >
              {checkpoint.label}
            </button>
          ))}
          <button type="button" className="ui-button ui-button--ghost" onClick={props.onReset}>
            Fresh run
          </button>
        </div>
        <p id="checkpoint-preview-note" className="dash-hint">
          {preview
            ? 'Replay is off for the fixed preview snapshot.'
            : 'Pick a checkpoint to move the replay clock. Only readings up to that time are used.'}
        </p>
      </div>
    </section>
  )
}

function MainColumn(props: DashboardProps & { state: StateEnvelope }) {
  const { state } = props
  const observations = indexObservations(state.observations)
  return (
    <>
      {state.assessments.length === 0 ? (
        <StateMessage kind="empty">No assessment was returned for this time.</StateMessage>
      ) : (
        state.assessments.map((item) => (
          <AssessmentPanel
            key={item.id}
            assessment={item}
            actions={state.actions}
            onAction={props.onAction}
            onWhy={props.onOpenEvidence}
          />
        ))
      )}

      <section aria-labelledby="sources-title">
        <h2 id="sources-title" className="dash-section-title">
          Sources and latest readings
        </h2>
        {state.sources.length === 0 ? (
          <StateMessage kind="empty">No sources were returned.</StateMessage>
        ) : (
          <div className="dash-sources">
            {state.sources.map((source) => (
              <SourceCard
                key={source.source_id}
                source={source}
                lastObservation={
                  source.last_observation_id === null
                    ? undefined
                    : observations.get(source.last_observation_id)
                }
                onHistory={() => props.onSelectHistorySource(source.source_id)}
              />
            ))}
          </div>
        )}
      </section>

      <OtherActions {...props} state={state} />
    </>
  )
}

function EvidenceDrawer(props: DashboardProps) {
  const { state } = props
  const observations = indexObservations(state?.observations ?? [])
  return (
    <Drawer open={props.evidenceOpen} title="Why? Evidence" onClose={props.onCloseEvidence}>
      {state === null ? (
        <p className="ui-empty">No state is loaded for the current clock.</p>
      ) : state.assessments.length === 0 ? (
        <p className="ui-empty">No assessment was returned for this time.</p>
      ) : (
        state.assessments.map((item) => (
          <div key={item.id} className="dash-why">
            <p className="dash-why__title">
              <strong>{item.title}</strong>{' '}
              <code className="ui-rule">
                {item.rule_id}@{item.rule_version}
              </code>{' '}
              at <UtcTime iso={state.as_of} />
            </p>
            <section aria-label="Supporting evidence">
              <h3>Supporting evidence</h3>
              <EvidenceList
                items={item.supporting_evidence}
                observations={observations}
                emptyText="No supporting evidence returned."
              />
            </section>
            <section aria-label="Conflicting evidence">
              <h3>Conflicting evidence</h3>
              <EvidenceList
                items={item.conflicting_evidence}
                observations={observations}
                emptyText="No conflicting evidence returned."
              />
            </section>
            <section aria-label="Missing inputs">
              <h3>Missing inputs</h3>
              <MissingInputs inputs={item.missing_inputs} />
            </section>
          </div>
        ))
      )}
      <p className="dash-hint">
        Evidence text, states and rule IDs are returned by the engine. Thresholds are
        prototype settings, not clinical cutoffs.
      </p>
    </Drawer>
  )
}

/** Actions the engine returned that no assessment already offers stay visible here. */
function OtherActions(props: DashboardProps & { state: StateEnvelope }) {
  const offered = new Set(props.state.assessments.flatMap((item) => item.action_ids))
  const rest = props.state.actions.filter((action) => !offered.has(action.id))
  if (rest.length === 0) return null
  return (
    <section aria-labelledby="other-actions-title" className="ui-card">
      <h2 id="other-actions-title" className="dash-section-title">
        Other actions
      </h2>
      <div className="dash-actions">
        {rest.map((action) => (
          <ActionButton key={action.id} action={action} onAction={props.onAction} />
        ))}
      </div>
    </section>
  )
}

function IncidentHistory({ state }: { state: StateEnvelope }) {
  return (
    <section className="ui-card" aria-labelledby="incidents-title">
      <h2 id="incidents-title" className="dash-section-title">
        Incident history
      </h2>
      {state.incidents.length === 0 ? (
        <p className="ui-empty">No incidents at this time.</p>
      ) : (
        <ul className="ui-incidents">
          {state.incidents.map((incident) => (
            <IncidentRow key={incident.id} incident={incident} />
          ))}
        </ul>
      )}
    </section>
  )
}

function SourceHistory(props: DashboardProps & { state: StateEnvelope }) {
  const { state, history, historyStatus, historySourceId } = props
  return (
    <section className="ui-card" aria-labelledby="history-title" id="source-history" tabIndex={-1}>
      <h2 id="history-title" className="dash-section-title">
        Source history
      </h2>
      <div className="dash-history-tabs" role="group" aria-label="History source">
        {state.sources.map((source) => (
          <button
            key={source.source_id}
            type="button"
            className="ui-button ui-button--ghost mono"
            aria-pressed={historySourceId === source.source_id}
            onClick={() => props.onSelectHistorySource(source.source_id)}
          >
            {source.source_id}
          </button>
        ))}
      </div>
      {historyStatus === 'loading' && <StateMessage kind="loading">Loading history…</StateMessage>}
      {historyStatus === 'error' && (
        <StateMessage kind="error" onRetry={props.onRetryHistory}>
          {props.historyError ?? 'History could not be loaded.'}
        </StateMessage>
      )}
      {historyStatus === 'ready' &&
        (history.length === 0 ? (
          <p className="ui-empty">
            No stored observations for {historySourceId} up to {formatTime(props.clock)}.
            {props.dataMode === 'fixture-preview' &&
              ' A fixture preview run holds no stored history.'}
          </p>
        ) : (
          <HistoryTable observations={history} />
        ))}
    </section>
  )
}

function HistoryTable({ observations }: { observations: Observation[] }) {
  return (
    <div className="ui-table-wrap" tabIndex={0} aria-label="Source history table">
      <table className="ui-table">
        <thead>
          <tr>
            <th scope="col">Time (UTC)</th>
            <th scope="col">Value</th>
            <th scope="col">Provenance</th>
          </tr>
        </thead>
        <tbody>
          {observations.map((observation) => (
            <tr key={observation.id}>
              <td>
                <UtcTime iso={observation.observed_at} />
              </td>
              <td className="mono">{formatValue(observation)}</td>
              <td>
                <ProvenanceBadge provenance={observation.provenance} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
