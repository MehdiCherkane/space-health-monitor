import { useId } from 'react'

import type { Action, DataMode, LoadStatus, Observation, StateEnvelope } from '../api/types'
import {
  ActionButton,
  DataModeBadge,
  EvidenceList,
  ProvenanceBadge,
  StatusBadge,
  UtcTime,
  formatValue,
  indexObservations,
} from '../ui'
import {
  buildEvidenceStatus,
  type AssessmentView,
  type RequirementRow,
  type SourceRow,
} from './evidenceStatus'
import './evidence-status.css'

export interface EvidenceStatusPanelProps {
  state: StateEnvelope | null
  dataMode: DataMode
  status: LoadStatus
  onAction: (actionId: string) => void
  onOpenEvidence: () => void
}

/**
 * Compact Evidence status section. Every visible fact comes from the returned
 * envelope; the component fetches nothing, keeps no copy of props in state and
 * does not compute another assessment.
 */
export function EvidenceStatusPanel({
  state,
  dataMode,
  status,
  onAction,
  onOpenEvidence,
}: EvidenceStatusPanelProps) {
  const model = buildEvidenceStatus(state, dataMode, status)
  const headingId = useId()
  const observations = indexObservations(state?.observations ?? [])
  const hasAssessment = model.assessments.length > 0

  return (
    <section className="evidence-status ui-card" aria-labelledby={headingId}>
      <header className="evidence-status__head">
        <h2 id={headingId} className="evidence-status__title">
          Evidence status
        </h2>
        <div className="evidence-status__meta">
          <DataModeBadge mode={dataMode} />
          {model.asOf !== null && (
            <span className="evidence-status__asof">
              As of <UtcTime iso={model.asOf} />
            </span>
          )}
        </div>
      </header>

      {model.notice !== null && (
        <p className="evidence-status__notice" role="note">
          {model.notice}
        </p>
      )}

      {model.phase === 'loading' && (
        <p className="evidence-status__pending" role="status">
          Loading evidence status…
        </p>
      )}
      {model.phase === 'error' && (
        <p className="evidence-status__pending" role="alert">
          Evidence status is unavailable for this time.
        </p>
      )}
      {model.phase === 'unavailable' && (
        <p className="evidence-status__pending">No evidence status is available at this time.</p>
      )}

      {model.phase === 'ready' && (
        <>
          <p className="evidence-status__summary">{model.summary}</p>

          {model.assessments.map((assessment) => (
            <AssessmentBlock
              key={assessment.id}
              assessment={assessment}
              observations={observations}
            />
          ))}

          {model.sources.length > 0 && <SourceList sources={model.sources} />}

          {hasAssessment && !model.hasConflicts && (
            <p className="evidence-status__disagreement ui-empty">
              No conflicting evidence returned.
            </p>
          )}

          {hasAssessment && (
            <section className="evidence-status__next" aria-label="What can we do next?">
              <h3 className="evidence-status__subhead">What can we do next?</h3>
              <div className="evidence-status__actions">
                {model.actions.map((row) => {
                  const action: Action = {
                    id: row.id,
                    label: row.label,
                    required_resource_ids: [],
                    available: row.available,
                    unavailable_reason: row.unavailableReason,
                  }
                  return (
                    <ActionButton key={row.id} action={action} onAction={onAction} variant="secondary" />
                  )
                })}
                {model.unresolvedActions.map((id) => (
                  <span key={id} className="evidence-status__unresolved">
                    Action <code>{id}</code> unavailable
                  </span>
                ))}
                {model.actions.length === 0 && model.unresolvedActions.length === 0 && (
                  <p className="ui-empty">No action was returned for this assessment.</p>
                )}
                <button
                  type="button"
                  className="ui-button ui-button--ghost evidence-status__why"
                  onClick={onOpenEvidence}
                >
                  Why?
                </button>
              </div>
            </section>
          )}

          {model.limits.length > 0 && (
            <details className="evidence-status__details">
              <summary>What this means</summary>
              <ul className="evidence-status__limits">
                {model.limits.map((limit) => (
                  <li key={limit}>{limit}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  )
}

function RequirementList({ rows }: { rows: RequirementRow[] }) {
  return (
    <dl className="evidence-status__rows">
      {rows.map((row, index) => (
        <div
          key={`${row.input || 'requirement'}-${index}`}
          className="evidence-status__row"
          data-kind={row.kind}
        >
          <dt>
            {row.name}
            {row.input !== '' && row.input !== row.name && (
              <>
                {' '}
                <code className="evidence-status__code">{row.input}</code>
              </>
            )}
          </dt>
          <dd>
            <span>{row.detail}</span>
            {row.observation !== undefined && (
              <span className="evidence-status__observed">
                {row.observation.observation !== undefined ? (
                  <>
                    <span className="mono">{formatValue(row.observation.observation)}</span>
                    <span aria-hidden="true">·</span>
                    <UtcTime iso={row.observation.observation.observed_at} />
                    <ProvenanceBadge provenance={row.observation.observation.provenance} />
                    <code>{row.observation.id}</code>
                  </>
                ) : (
                  <>
                    <span className="ui-obs__unavailable">Evidence unavailable</span>
                    <code>{row.observation.id}</code>
                  </>
                )}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function SourceList({ sources }: { sources: SourceRow[] }) {
  return (
    <section className="evidence-status__sources" aria-label="Source quality and freshness">
      <h3 className="evidence-status__subhead">Source quality and freshness</h3>
      <dl className="evidence-status__rows">
        {sources.map((source) => (
          <div key={source.sourceId} className="evidence-status__row" data-source-state={source.state}>
            <dt>
              <span className="mono">{source.sourceId}</span>{' '}
              <StatusBadge kind="source" state={source.state} />
            </dt>
            <dd>
              <span>
                {source.ageSeconds === null
                  ? 'Age unavailable — no eligible reading returned.'
                  : `Last reading ${source.ageText} ago.`}
              </span>
              {source.last === null ? (
                <span className="ui-empty">No reading returned.</span>
              ) : source.last.observation !== undefined ? (
                <span className="evidence-status__observed">
                  <span className="mono">{formatValue(source.last.observation)}</span>
                  <span aria-hidden="true">·</span>
                  <UtcTime iso={source.last.observation.observed_at} />
                  <ProvenanceBadge provenance={source.last.observation.provenance} />
                  <code>{source.last.id}</code>
                </span>
              ) : (
                <span className="evidence-status__observed">
                  <span className="ui-obs__unavailable">Evidence unavailable</span>
                  <code>{source.last.id}</code>
                </span>
              )}
              <span className="ui-reason">
                {source.reasonText}
                <code>{source.reasonCode}</code>
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function AssessmentBlock({
  assessment,
  observations,
}: {
  assessment: AssessmentView
  observations: Map<string, Observation>
}) {
  const titleId = useId()
  return (
    <section
      className="evidence-status__assessment"
      aria-labelledby={titleId}
      data-state={assessment.state}
    >
      <div className="evidence-status__assessment-head">
        <StatusBadge kind="assessment" state={assessment.state} />
        <code className="ui-rule">{assessment.rule}</code>
      </div>
      <h3 id={titleId} className="evidence-status__assessment-title">
        {assessment.title}
      </h3>
      <p className="evidence-status__meaning">{assessment.meaning}</p>

      <h4 className="evidence-status__subhead">Required inputs</h4>
      <RequirementList rows={assessment.requirements} />

      {assessment.supporting.length > 0 && (
        <details className="evidence-status__details">
          <summary>Returned evidence ({assessment.supporting.length})</summary>
          <EvidenceList
            items={assessment.supporting}
            observations={observations}
            emptyText="No supporting evidence returned."
          />
        </details>
      )}

      {assessment.conflicts.length > 0 && (
        <section className="evidence-status__conflict" aria-label="Returned conflict">
          <h4 className="evidence-status__subhead">Disagreement</h4>
          <EvidenceList
            items={assessment.conflicts}
            observations={observations}
            emptyText="No conflicting evidence returned."
          />
        </section>
      )}
    </section>
  )
}
