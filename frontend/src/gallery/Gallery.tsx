import { useState } from 'react'

import { routeAction } from '../actions'
import type { ScenarioId, StateEnvelope, SubmissionRequest } from '../api/types'
import { CrewCheckIn } from '../checkin'
import { Dashboard } from '../dashboard/Dashboard'
import { DataModeBadge, ProvenanceBadge, StatusBadge } from '../ui'
import rawStates from './states.json'
import './gallery.css'

interface GalleryState {
  id: string
  scenario_id: ScenarioId
  label: string
  origin: string
  state: StateEnvelope
}

const STATES = rawStates as GalleryState[]

/**
 * Static state gallery. No API: every state is a contract example, engine output from
 * explicitly synthetic inputs (generate_states.py) or a labeled hand-edited test prop.
 */
export function Gallery() {
  const [selectedId, setSelectedId] = useState(STATES[0].id)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [routed, setRouted] = useState<string | null>(null)
  const [historySourceId, setHistorySourceId] = useState<string | null>(null)
  const selected = STATES.find((item) => item.id === selectedId) ?? STATES[0]
  const { state } = selected

  const onAction = (actionId: string) => {
    const route = routeAction(actionId)
    setRouted(`${actionId} → ${route ?? 'no route'}`)
    if (route === 'evidence') setEvidenceOpen(true)
  }

  const fakeSubmit = async (submission: SubmissionRequest) => ({
    submission_id: submission.submission_id,
    observation_ids: submission.entries.map((_, index) => `gallery:${index}`),
  })

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          <h1>Astro Vital · State gallery</h1>
          <p>Static review of every contract state. No API, no stored data.</p>
        </div>
        <DataModeBadge mode="fixture-preview" />
      </header>

      <main className="app-main gallery">
        <p className="gallery-note" role="note">
          <strong>Fixture preview.</strong> States are contract examples, engine output from
          synthetic test inputs, or labeled hand-edited test props. Detector rows outside
          Example A are synthetic, not NASA archive data. Nothing here is an integrated pass.
        </p>

        <section className="ui-card" aria-labelledby="gallery-pick">
          <h2 id="gallery-pick" className="dash-section-title">
            Choose a state
          </h2>
          <div className="gallery-list" role="group" aria-labelledby="gallery-pick">
            {STATES.map((item) => (
              <button
                key={item.id}
                type="button"
                className="gallery-item"
                aria-pressed={item.id === selected.id}
                onClick={() => {
                  setSelectedId(item.id)
                  setEvidenceOpen(false)
                  setRouted(null)
                  setHistorySourceId(null)
                }}
              >
                <span className="gallery-item__label">{item.label}</span>
                <span className="gallery-item__origin">{item.origin}</span>
              </button>
            ))}
          </div>
          {routed && (
            <p className="dash-hint" role="status">
              Routed action: <code>{routed}</code>
            </p>
          )}
        </section>

        <Dashboard
          hideControls
          state={state}
          dataMode="fixture-preview"
          status="ready"
          error={null}
          clock={state.as_of}
          scenarioId={selected.scenario_id}
          checkpoints={[]}
          history={[]}
          historyStatus="ready"
          historyError={null}
          historySourceId={historySourceId ?? state.sources[0]?.source_id ?? null}
          evidenceOpen={evidenceOpen}
          onScenarioChange={() => undefined}
          onSeek={() => undefined}
          onReset={() => undefined}
          onRetry={() => undefined}
          onRetryHistory={() => undefined}
          onAction={onAction}
          onSelectHistorySource={setHistorySourceId}
          onOpenEvidence={() => setEvidenceOpen(true)}
          onCloseEvidence={() => setEvidenceOpen(false)}
          aside={
            selected.scenario_id === 'sleep_vigilance' ? (
              <CrewCheckIn
                key={selected.id}
                run={{
                  run_id: `gallery-${selected.id}`,
                  scenario_id: 'sleep_vigilance',
                  initial_as_of: state.as_of,
                  range_start: '2026-01-10T09:00:00Z',
                  range_end: '2026-01-10T10:00:00Z',
                }}
                scenarioId="sleep_vigilance"
                missionTime={state.as_of}
                actions={state.actions}
                onSubmit={fakeSubmit}
                onAction={onAction}
              />
            ) : null
          }
        />

        <section className="ui-card" aria-labelledby="gallery-kit">
          <h2 id="gallery-kit" className="dash-section-title">
            Badge vocabulary
          </h2>
          <div className="gallery-badges">
            {(['current', 'stale', 'missing', 'invalid', 'conflicting'] as const).map((value) => (
              <StatusBadge key={value} kind="source" state={value} />
            ))}
          </div>
          <div className="gallery-badges">
            {(['observed', 'watch', 'insufficient_data'] as const).map((value) => (
              <StatusBadge key={value} kind="assessment" state={value} />
            ))}
            {(['open', 'resolved'] as const).map((value) => (
              <StatusBadge key={value} kind="incident" state={value} />
            ))}
          </div>
          <div className="gallery-badges">
            {(['REAL_HISTORICAL', 'SYNTHETIC', 'LIVE_MEASURED'] as const).map((value) => (
              <ProvenanceBadge key={value} provenance={value} />
            ))}
            <DataModeBadge mode="fixture-preview" />
            <DataModeBadge mode="integrated" />
          </div>
        </section>
      </main>
    </div>
  )
}
