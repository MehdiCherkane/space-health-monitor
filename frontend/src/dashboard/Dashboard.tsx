import type { ReactNode } from 'react'

import type { Action, DashboardProps, Observation, ScenarioId, StateEnvelope } from '../api/types'
import {
  ActionButton,
  AssessmentPanel,
  Drawer,
  EvidenceList,
  IncidentRow,
  MissingInputs,
  ProvenanceBadge,
  SourceCard,
  StatusBadge,
  StateMessage,
  UtcTime,
  formatTime,
  formatUtc,
  formatValue,
  indexObservations,
} from '../ui'
import { EvidenceStatusPanel } from '../evidence-status'
import { ObservatoryScene } from './ObservatoryScene'
import { HistoryPlot } from './HistoryPlot'
import './dashboard.css'

export interface ReplayControlExtras {
  playing: boolean
  speed: number
  rangeStart: string | null
  rangeEnd: string | null
  onTogglePlay(): void
  onSpeedChange(speed: number): void
  onScrub(asOf: string): void
}

export type DashboardExtras = {
  aside?: ReactNode
  hideControls?: boolean
  replayControls?: ReplayControlExtras
}

const SCENARIOS: { id: ScenarioId; label: string; provenance: string }[] = [
  { id: 'radlab_stale', label: 'Detector gap (RadLab)', provenance: 'Historical NASA telemetry' },
  { id: 'sleep_vigilance', label: 'Sleep and vigilance', provenance: 'Synthetic crew scenario' },
]

function toUtcSecond(milliseconds: number): string {
  return new Date(milliseconds).toISOString().slice(0, 19) + 'Z'
}

function rowsLabel(count: number): string {
  return `${count} ${count === 1 ? 'row' : 'rows'}`
}

/**
 * Renders the engine envelope the shell hands over. It never fetches, never filters by
 * time and never computes a status; every label and state comes from props.
 */
export function Dashboard(props: DashboardProps & DashboardExtras) {
  const { state, dataMode, status, error, clock } = props
  const preview = dataMode === 'fixture-preview'
  const observations = indexObservations(state?.observations ?? [])

  return (
    <div className="dash">
      {!props.hideControls && (
        <ReplayControls {...props} preview={preview} replayControls={props.replayControls} />
      )}

      {preview && !props.hideControls && (
        <p className="dash-preview" role="note">
          <strong>Fixture preview.</strong> This is the contract example, a fixed snapshot at{' '}
          <UtcTime iso={state?.as_of ?? clock} />. It is not engine output and cannot be replayed; the
          checkpoints activate once this run holds stored observations.
        </p>
      )}

      <div className="dash-banner">
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
        {state &&
          (state.assessments.length === 0 ? (
            <StateMessage kind="empty">No assessment was returned for this time.</StateMessage>
          ) : (
            state.assessments.map((assessment) => (
              <AssessmentPanel
                key={assessment.id}
                assessment={assessment}
                actions={state.actions}
                onAction={props.onAction}
                onWhy={props.onOpenEvidence}
              />
            ))
          ))}
      </div>

      {state ? (
        <div className="dash-grid">
          <ReadingsColumn {...props} state={state} observations={observations} />
          <ObservatoryScene
            state={state}
            selectedSource={props.historySourceId}
            onSelectSource={props.onSelectHistorySource}
            onOpenEvidence={props.onOpenEvidence}
            onAction={props.onAction}
          />
          <div className="dash-side">
            <SourceHistory {...props} state={state} />
            <EvidenceStatusPanel
              compact
              state={state}
              dataMode={dataMode}
              status={status}
              onAction={props.onAction}
              onOpenEvidence={props.onOpenEvidence}
            />
            <IncidentHistory state={state} />
          </div>
        </div>
      ) : (
        <div className="dash-waiting">
          <EvidenceStatusPanel
            compact
            state={state}
            dataMode={dataMode}
            status={status}
            onAction={props.onAction}
            onOpenEvidence={props.onOpenEvidence}
          />
        </div>
      )}

      {!props.hideControls && <CheckpointRail {...props} preview={preview} />}
      {props.aside}
      <EvidenceDrawer {...props} />
    </div>
  )
}

function ReplayControls(
  props: DashboardProps & DashboardExtras & { preview: boolean },
) {
  const { scenarioId, clock, preview, status, replayControls } = props
  const start = replayControls?.rangeStart ? Date.parse(replayControls.rangeStart) : NaN
  const end = replayControls?.rangeEnd ? Date.parse(replayControls.rangeEnd) : NaN
  const current = clock ? Date.parse(clock) : NaN
  const canScrub =
    replayControls !== undefined &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    Number.isFinite(current) &&
    !preview &&
    status !== 'idle'

  return (
    <section className="dash-controls" aria-labelledby="controls-title">
      <h2 id="controls-title" className="visually-hidden">
        Replay controls
      </h2>

      <div className="dash-controls__group dash-controls__scenario">
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

      <div className="dash-controls__group dash-controls__clock">
        <p className="dash-label" id="clock-label">
          Replay clock
        </p>
        <p className="dash-clock mono" aria-live="polite" aria-labelledby="clock-label">
          {clock ? formatUtc(clock) : '—'}
        </p>
      </div>

      {replayControls && (
        <div className="dash-controls__group dash-transport">
          <p className="dash-label" id="transport-label">
            Playback
          </p>
          <div className="dash-transport__row" role="group" aria-labelledby="transport-label">
            <button
              type="button"
              className="ui-button ui-button--primary dash-play"
              onClick={replayControls.onTogglePlay}
              disabled={status === 'idle' || preview}
              aria-pressed={replayControls.playing}
            >
              <span aria-hidden="true">{replayControls.playing ? '❚❚' : '▶'}</span>
              {replayControls.playing ? 'Pause replay' : 'Play replay'}
            </button>
            <div className="dash-speed" role="group" aria-label="Playback speed">
              {[1, 2, 4].map((speed) => (
                <button
                  key={speed}
                  type="button"
                  className="dash-speed__option"
                  aria-pressed={replayControls.speed === speed}
                  onClick={() => replayControls.onSpeedChange(speed)}
                >
                  {speed}×
                </button>
              ))}
            </div>
            <label className="dash-scrub">
              <span className="dash-scrub__label">Scrub</span>
              <input
                type="range"
                aria-label="Scrub replay clock"
                min={Number.isFinite(start) ? start : 0}
                max={Number.isFinite(end) ? end : 0}
                step={1000}
                value={Number.isFinite(current) ? current : 0}
                disabled={!canScrub}
                onChange={(event) => replayControls.onScrub(toUtcSecond(Number(event.target.value)))}
              />
            </label>
          </div>
        </div>
      )}
    </section>
  )
}

function CheckpointRail(props: DashboardProps & { preview: boolean }) {
  const { checkpoints, clock, preview, status } = props
  return (
    <section className="replay-rail" aria-label="Replay checkpoints">
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

function ReadingsColumn(
  props: DashboardProps & { state: StateEnvelope; observations: Map<string, Observation> },
) {
  const { state } = props
  const isCrew = state.scenario_id === 'sleep_vigilance'
  const reactionAction = state.actions.find((action) => action.id === 'start_reaction_check')
  const fallbackAction = state.actions.find(
    (action) => action.id === 'review_available_inputs' && action.available,
  )
  const reactionSource = state.sources.find((source) => source.source_id === 'reaction_task')
  const reactionEmpty =
    isCrew && (reactionSource === undefined || reactionSource.last_observation_id === null)
  const comparison = detectorComparison(state, props.observations)

  return (
    <section className="dash-readings" aria-labelledby="sources-title">
      <div className="dash-readings__head">
        <h2 id="sources-title" className="dash-section-title">
          Sources and latest readings
        </h2>
        {comparison !== null && <DetectorComparison comparison={comparison} />}
      </div>
      {state.sources.length === 0 ? (
        <StateMessage kind="empty">No sources were returned.</StateMessage>
      ) : (
        <div className="dash-sources">
          {state.sources.map((source) => {
            const isReaction = source.source_id === 'reaction_task'
            const emptyAction =
              isReaction && reactionEmpty ? (
                reactionAction !== undefined ? (
                  <ActionButton action={reactionAction} onAction={props.onAction} variant="primary" />
                ) : fallbackAction !== undefined ? (
                  <ActionButton action={fallbackAction} onAction={props.onAction} variant="primary" />
                ) : undefined
              ) : undefined
            return (
              <SourceCard
                key={source.source_id}
                source={source}
                compact
                selected={props.historySourceId === source.source_id}
                emptyAction={emptyAction}
                lastObservation={
                  source.last_observation_id === null
                    ? undefined
                    : props.observations.get(source.last_observation_id)
                }
                onHistory={() => props.onSelectHistorySource(source.source_id)}
              />
            )
          })}
        </div>
      )}
      <OtherActions {...props} state={state} />
    </section>
  )
}

interface DetectorComparisonValue {
  first: string
  second: string
  difference: number
  agreed: boolean
  firstValue: string
  secondValue: string
}

function detectorComparison(
  state: StateEnvelope,
  observations: Map<string, Observation>,
): DetectorComparisonValue | null {
  if (state.scenario_id !== 'radlab_stale' || state.sources.length < 2) return null
  const first = state.sources[0]
  const second = state.sources[1]
  if (first.last_observation_id === null || second.last_observation_id === null) return null
  const a = observations.get(first.last_observation_id)
  const b = observations.get(second.last_observation_id)
  if (!a || !b || a.unit !== b.unit || a.value === 0) return null
  const difference = ((b.value - a.value) / Math.abs(a.value)) * 100
  return {
    first: first.source_id,
    second: second.source_id,
    difference,
    agreed: Math.abs(difference) <= 10,
    firstValue: `${a.value.toFixed(2)} ${a.unit}`,
    secondValue: `${b.value.toFixed(2)} ${b.unit}`,
  }
}

/** Display-only cross-check; the ±10% band is not a backend rule or a safety threshold. */
function DetectorComparison({ comparison }: { comparison: DetectorComparisonValue }) {
  return (
    <p className="detector-compare" data-agreed={comparison.agreed}>
      <span className="detector-compare__pair">
        {comparison.first} {comparison.firstValue} · {comparison.second} {comparison.secondValue}
      </span>
      <span className="detector-compare__delta mono">
        {comparison.difference > 0 ? '+' : ''}
        {comparison.difference.toFixed(1)}%
      </span>
      <span className="detector-compare__state">
        {comparison.agreed ? 'In agreement' : 'Not in agreement'}
        <small> ±10% display band</small>
      </span>
    </p>
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
    <section aria-labelledby="other-actions-title" className="ui-card dash-other-actions">
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
    <details className="ui-card dash-incidents">
      <summary>
        <span>Incident history</span>
        {state.incidents.length > 0 ? (
          state.incidents.map((incident) => (
            <StatusBadge key={incident.id} kind="incident" state={incident.state} />
          ))
        ) : (
          <span className="ui-empty">No incidents</span>
        )}
      </summary>
      <h2 className="visually-hidden">Incident history details</h2>
      {state.incidents.length === 0 ? (
        <p className="ui-empty">No incidents at this time.</p>
      ) : (
        <ul className="ui-incidents">
          {state.incidents.map((incident) => (
            <IncidentRow key={incident.id} incident={incident} />
          ))}
        </ul>
      )}
    </details>
  )
}

/** Returned baseline observations referenced by evidence, used only for a chart band. */
function returnedBaselineBand(
  state: StateEnvelope,
  sourceId: string,
): { min: number; max: number; label: string } | null {
  const metric = state.sources.find((source) => source.source_id === sourceId)?.metric
  if (!metric) return null
  const observations = indexObservations(state.observations)
  for (const assessment of state.assessments) {
    for (const evidence of assessment.supporting_evidence) {
      if (!evidence.baseline_id) continue
      const rows = evidence.observation_ids
        .map((id) => observations.get(id))
        .filter((row): row is Observation => row !== undefined && row.metric === metric)
      if (rows.length < 2) continue
      const values = rows.map((row) => row.value)
      return {
        min: Math.min(...values),
        max: Math.max(...values),
        label: 'Returned demo baseline range',
      }
    }
  }
  return null
}

function SourceHistory(props: DashboardProps & { state: StateEnvelope }) {
  const { state, history, historyStatus, historySourceId } = props
  const band = historySourceId ? returnedBaselineBand(state, historySourceId) : null
  return (
    <section className="ui-card dash-history" aria-labelledby="history-title" id="source-history" tabIndex={-1}>
      <h2 id="history-title" className="dash-section-title">
        Source history
      </h2>
      <div className="dash-history-tabs" role="group" aria-label="History source">
        {state.sources.map((source) => (
          <button
            key={source.source_id}
            type="button"
            className="ui-button ui-button--ghost"
            aria-pressed={historySourceId === source.source_id}
            onClick={() => props.onSelectHistorySource(source.source_id)}
          >
            {source.source_id === 'crew_sleep_log'
              ? 'Sleep log'
              : source.source_id === 'reaction_task'
                ? 'Reaction task'
                : source.source_id}
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
          <>
            <HistoryPlot observations={history} band={band} />
            <details className="history-details">
              <summary>
                View data table <span>{rowsLabel(history.length)}</span>
              </summary>
              <HistoryTable observations={history} />
            </details>
          </>
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
