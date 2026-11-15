import { useId, type ReactNode } from 'react'


import type {
  Action,
  Assessment,
  DataMode,
  AssessmentState,
  Evidence,
  Incident,
  IncidentState,
  Observation,
  Provenance,
  SourceState,
  SourceStatus,
} from '../api/types'
import { Icon, type IconName } from './Icon'
import {
  PROVENANCE_LABEL,
  REASON_TEXT,
  humanize,
  formatAge,
  formatNumber,
  formatTime,
  formatUtc,
  formatValue,
  stateLabel,
} from './format'

type Tone = 'ok' | 'watch' | 'muted' | 'danger' | 'info'

// Restrained mapping: `observed` is neutral, never a "healthy" green.
const SOURCE_TONE: Record<SourceState, [Tone, IconName]> = {
  current: ['ok', 'current'],
  stale: ['watch', 'stale'],
  missing: ['muted', 'missing'],
  invalid: ['danger', 'invalid'],
  conflicting: ['info', 'conflicting'],
}
const ASSESSMENT_TONE: Record<AssessmentState, [Tone, IconName]> = {
  observed: ['muted', 'observed'],
  watch: ['watch', 'watch'],
  insufficient_data: ['info', 'insufficient'],
}
const INCIDENT_TONE: Record<IncidentState, [Tone, IconName]> = {
  open: ['watch', 'open'],
  resolved: ['muted', 'resolved'],
}

const PROVENANCE_ICON: Record<Provenance, IconName> = {
  REAL_HISTORICAL: 'historical',
  SYNTHETIC: 'synthetic',
  LIVE_MEASURED: 'device',
}

export type StatusKind = 'source' | 'assessment' | 'incident'

export function StatusBadge({ kind, state }: { kind: StatusKind; state: string }) {
  const table: Record<string, [Tone, IconName]> =
    kind === 'source' ? SOURCE_TONE : kind === 'assessment' ? ASSESSMENT_TONE : INCIDENT_TONE
  const [tone, icon] = table[state] ?? ['muted', 'info']
  return (
    <span className={`ui-badge ui-badge--${tone}`} data-state={state}>
      <Icon name={icon} size={14} />
      <span className="visually-hidden">{kind} state: </span>
      {stateLabel(state)}
    </span>
  )
}

export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  return (
    <span className={`ui-prov ui-prov--${provenance.toLowerCase()}`}>
      <Icon name={PROVENANCE_ICON[provenance]} size={14} />
      {PROVENANCE_LABEL[provenance]}
    </span>
  )
}

const MODE_LABEL: Record<DataMode, string> = {
  'fixture-preview': 'Fixture preview',
  integrated: 'Integrated run',
  unknown: 'Connecting',
}

export function DataModeBadge({ mode }: { mode: DataMode }) {
  return (
    <span className={`ui-mode ui-mode--${mode}`} data-mode={mode}>
      {MODE_LABEL[mode]}
    </span>
  )
}

export function UtcTime({ iso, compact = false }: { iso: string; compact?: boolean }) {
  return (
    <time className="mono" dateTime={iso} title={formatUtc(iso)}>
      {compact ? formatTime(iso) : formatUtc(iso)}
    </time>
  )
}

/** One observation, joined by ID. A missing reference is reported, never filled in. */
export function ObservationLine({
  id,
  observation,
}: {
  id: string
  observation: Observation | undefined
}) {
  if (!observation) {
    return (
      <li className="ui-obs ui-obs--missing">
        <span className="ui-obs__unavailable">Evidence unavailable</span>
        <code className="ui-obs__id">{id}</code>
      </li>
    )
  }
  return (
    <li className="ui-obs">
      <span className="ui-obs__source">{observation.source_id}</span>
      <span className="ui-obs__value mono">{formatValue(observation)}</span>
      <UtcTime iso={observation.observed_at} />
      <ProvenanceBadge provenance={observation.provenance} />
      <code className="ui-obs__id">{observation.id}</code>
    </li>
  )
}

export function SourceCard({
  source,
  lastObservation,
  onHistory,
  compact = false,
  selected = false,
}: {
  source: SourceStatus
  lastObservation: Observation | undefined
  onHistory?: () => void
  compact?: boolean
  selected?: boolean
}) {
  const age = formatAge(source.age_seconds)
  const titleId = useId()
  const reason = (
<p className="ui-reason">
          {REASON_TEXT[source.reason_code] ?? humanize(source.reason_code)}
          <code title="Engine reason code">{source.reason_code}</code>
        </p>
  )
  const metadata = lastObservation ? (
          <dl className="ui-meta">
            <div>
              <dt>Age</dt>
              <dd className="mono">{age}</dd>
            </div>
            <div>
              <dt>Last reading</dt>
              <dd>
                <UtcTime iso={lastObservation.observed_at} />
              </dd>
            </div>
            {lastObservation.source_timestamp !== undefined && (
              <div>
                <dt>Source timestamp</dt>
                <dd className="mono">{lastObservation.source_timestamp}</dd>
              </div>
            )}
          </dl>
  ) : null
  return (
    <article className={`ui-card ui-source${compact ? " ui-source--compact" : ""}`} aria-labelledby={titleId} data-state={source.state} data-selected={selected}>
      <header className="ui-source__head">
        <h3 id={titleId} className="ui-source__name">
          {source.source_id}
        </h3>
        <StatusBadge kind="source" state={source.state} />
      </header>
      <p className="ui-source__metric">{humanize(source.metric)}</p>
      {source.last_observation_id === null ? (
        <p className="ui-source__empty">No reading</p>
      ) : lastObservation ? (
        <>
          <p className="ui-source__value mono"><span>{formatNumber(lastObservation.value)}</span> <small>{lastObservation.unit}</small></p>
          {compact ? <details className="source-details"><summary>Reading details{age !== null && <span>{age}</span>}</summary>
{metadata}
            {reason}
          </details> : <>
{metadata}
          </>}

          {!compact && <ProvenanceBadge provenance={lastObservation.provenance} />}
        </>
      ) : (
        <>
          {age !== null && <p className="ui-source__age mono">Age {age}</p>}
          <p className="ui-obs__unavailable">Evidence unavailable</p>
          <code className="ui-obs__id">{source.last_observation_id}</code>
        </>
      )}
      <footer className="ui-source__foot">
        {compact && lastObservation ? <ProvenanceBadge provenance={lastObservation.provenance} /> : reason}
        {onHistory && (
          <button type="button" className="ui-button ui-button--ghost" onClick={onHistory}>
            <Icon name="history" />
            History<span className="visually-hidden"> for {source.source_id}</span>
          </button>
        )}
      </footer>
    </article>
  )
}

export function EvidenceList({
  items,
  observations,
  emptyText,
}: {
  items: Evidence[]
  observations: Map<string, Observation>
  emptyText: string
}) {
  if (items.length === 0) return <p className="ui-empty">{emptyText}</p>
  return (
    <ul className="ui-evidence">
      {items.map((item, index) => (
        <li key={`${item.code}-${index}`} className="ui-evidence__item">
          <p className="ui-evidence__detail">{item.detail}</p>
          <p className="ui-evidence__meta">
            <code>{item.code}</code>
            {item.baseline_id && (
              <>
                {' '}
                · baseline <code>{item.baseline_id}</code>
              </>
            )}
          </p>
          <ul className="ui-obs-list">
            {item.observation_ids.map((id) => (
              <ObservationLine key={id} id={id} observation={observations.get(id)} />
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}

export function MissingInputs({ inputs }: { inputs: string[] }) {
  if (inputs.length === 0) return <p className="ui-empty">No missing inputs returned.</p>
  return (
    <ul className="ui-missing">
      {inputs.map((input) => (
        <li key={input}>
          <Icon name="missing" size={14} /> {humanize(input)} <code>{input}</code>
        </li>
      ))}
    </ul>
  )
}

/** Unavailable actions stay visible, disabled, with the engine's reason. */
export function ActionButton({
  action,
  onAction,
  variant = 'secondary',
}: {
  action: Action
  onAction: (actionId: string) => void
  variant?: 'primary' | 'secondary'
}) {
  const reasonId = useId()
  return (
    <span className="ui-action">
      <button
        type="button"
        className={`ui-button ui-button--${variant}`}
        disabled={!action.available}
        aria-describedby={action.available ? undefined : reasonId}
        onClick={() => onAction(action.id)}
      >
        {action.label}
      </button>
      {!action.available && (
        <span id={reasonId} className="ui-action__reason">
          {action.unavailable_reason}
        </span>
      )}
    </span>
  )
}

export function AssessmentPanel({
  assessment,
  actions,
  onAction,
  onWhy,
}: {
  assessment: Assessment
  actions: Action[]
  onAction: (actionId: string) => void
  onWhy: () => void
}) {
  const byId = new Map(actions.map((action) => [action.id, action]))
  const titleId = useId()
  return (
    <section
      className={`ui-card ui-assessment ui-assessment--${assessment.state}`}
      aria-labelledby={titleId}
    >
      <div className="ui-assessment__top">
        <StatusBadge kind="assessment" state={assessment.state} />
        <code className="ui-rule">
          {assessment.rule_id}@{assessment.rule_version}
        </code>
      </div>
      <h2 id={titleId} className="ui-assessment__title">
        {assessment.title}
      </h2>
      {assessment.missing_inputs.length > 0 && (
        <p className="ui-assessment__missing">
          Missing input{assessment.missing_inputs.length > 1 ? 's' : ''}:{' '}
          {assessment.missing_inputs.map((input, index) => (
            <span key={input} title={input}>
              {index > 0 && ', '}
              {humanize(input)}
            </span>
          ))}
        </p>
      )}
      <div className="ui-assessment__actions">
        <button type="button" className="ui-button ui-button--primary" onClick={onWhy}>
          <Icon name="why" />
          Why?
        </button>
        {assessment.action_ids.map((id) => {
          const action = byId.get(id)
          return action ? (
            <ActionButton key={id} action={action} onAction={onAction} />
          ) : (
            <span key={id} className="ui-action__reason">
              Action <code>{id}</code> unavailable
            </span>
          )
        })}
      </div>
    </section>
  )
}

export function IncidentRow({ incident }: { incident: Incident }) {
  return (
    <li className="ui-incident" data-state={incident.state}>
      <span className="ui-incident__source">{incident.source_id}</span>
      <StatusBadge kind="incident" state={incident.state} />
      <span className="ui-incident__time">
        Opened <UtcTime iso={incident.opened_at} />
      </span>
      <span className="ui-incident__time">
        {incident.closed_at === null ? (
          'Not closed yet'
        ) : (
          <>
            Closed <UtcTime iso={incident.closed_at} />
          </>
        )}
      </span>
      <span className="ui-incident__ref">
        Last reading before gap <code>{incident.last_observation_id}</code>
      </span>
    </li>
  )
}

export function StateMessage({
  kind,
  children,
  onRetry,
}: {
  kind: 'loading' | 'empty' | 'error'
  children: ReactNode
  onRetry?: () => void
}) {
  return (
    <div
      className={`ui-message ui-message--${kind}`}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      {kind === 'loading' && <span className="ui-spinner" aria-hidden="true" />}
      <span>{children}</span>
      {onRetry && (
        <button type="button" className="ui-button ui-button--secondary" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}
