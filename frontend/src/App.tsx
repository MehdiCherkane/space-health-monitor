import { useCallback, useEffect, useRef, useState } from 'react'

import { routeAction } from './actions'
import { submitObservations } from './api/client'
import type { SubmissionRequest } from './api/types'
import { CrewCheckIn } from './checkin'
import { Dashboard } from './dashboard/Dashboard'
import { GalaxyBackground, useAmbientMotion } from './dashboard/GalaxyBackground'
import { CHECKPOINTS } from './shell/replay'
import { useReplay, useSourceHistory } from './shell/useReplay'
import { DataModeBadge } from './ui'

export default function App() {
  const replay = useReplay('radlab_stale')
  const [measuring, setMeasuring] = useState(false)
  const motion = useAmbientMotion(measuring)
  const { run, state, clock } = replay
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [historySourceId, setHistorySourceId] = useState<string | null>(null)
  const [historyAttempt, setHistoryAttempt] = useState(0)
  const checkInRef = useRef<HTMLDivElement>(null)
  const runIdRef = useRef<string | null>(null)
  runIdRef.current = run?.run_id ?? null

  // Default the history source to the first returned source; drop a source this run lacks.
  const sources = state?.sources ?? []
  const selected = sources.find((source) => source.source_id === historySourceId) ?? sources[0]
  const history = useSourceHistory(
    run,
    state ? clock : '',
    selected?.source_id ?? null,
    selected?.metric ?? null,
    historyAttempt,
    state,
  )

  // A new run starts clean: no open drawer, no remembered history source.
  useEffect(() => {
    setEvidenceOpen(false)
    setHistorySourceId(null)
  }, [run?.run_id])

  const focusSection = (element: HTMLElement | null) => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    element?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
    element?.focus({ preventScroll: true })
  }

  const onAction = useCallback((actionId: string) => {
    const route = routeAction(actionId)
    if (route === 'evidence') setEvidenceOpen(true)
    else if (route === 'history') focusSection(document.getElementById('source-history'))
    else if (route === 'checkin') focusSection(checkInRef.current)
  }, [])

  const { refresh } = replay
  const onSubmit = useCallback(
    async (submission: SubmissionRequest) => {
      if (!run) throw new Error('No active run.')
      const response = await submitObservations(run.run_id, submission)
      // Only the run that received the submission may trigger a state refresh.
      if (runIdRef.current === run.run_id) refresh()
      return response
    },
    [run, refresh],
  )

  const checkIn =
    run && replay.scenarioId === 'sleep_vigilance' && run.scenario_id === 'sleep_vigilance' ? (
      <div ref={checkInRef} tabIndex={-1} className="app-checkin" aria-label="Crew check-in">
        {/* Keyed by run: a fresh run never inherits form, task or retry state (bug C). */}
        <CrewCheckIn
          onTaskActiveChange={setMeasuring}
          key={run.run_id}
          run={run}
          scenarioId={run.scenario_id}
          missionTime={clock}
          actions={state?.actions ?? []}
          onSubmit={onSubmit}
          onAction={onAction}
        />
      </div>
    ) : null

  return (
    <div className="app" data-motion-paused={motion.paused}>
      <GalaxyBackground paused={motion.paused} />
      <a className="app-skip" href="#main">
        Skip to dashboard
      </a>
      <header className="app-header">
        <div className="app-brand">
          <svg className="app-mark" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="12" fill="none" stroke="currentColor" strokeWidth="1.5" /><ellipse cx="20" cy="20" rx="19" ry="7" transform="rotate(-35 20 20)" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="29" cy="10" r="3" fill="currentColor" /></svg>
          <div><h1>Astro Vital</h1>
          <p>Evidence for the next decision.</p></div>
        </div>
        <div className="app-header__tools">
          <span className="app-prototype">Replay prototype</span>
          <DataModeBadge mode={replay.dataMode} />
          <button className="motion-control" type="button" onClick={motion.toggle} disabled={motion.locked} aria-pressed={motion.paused}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">{motion.paused ? <path d="m5 3 8 5-8 5Z" /> : <path d="M4 3h3v10H4zm5 0h3v10H9z" />}</svg>
            {motion.label}
          </button>
        </div>
      </header>

      <main id="main" className="app-main" tabIndex={-1}>
        <Dashboard
          state={state}
          dataMode={replay.dataMode}
          status={replay.status}
          error={replay.error}
          clock={clock}
          scenarioId={replay.scenarioId}
          checkpoints={CHECKPOINTS[replay.scenarioId]}
          history={history.observations}
          historyStatus={history.status}
          historyError={history.error}
          historySourceId={selected?.source_id ?? null}
          evidenceOpen={evidenceOpen}
          onScenarioChange={replay.setScenario}
          onSeek={replay.seek}
          onReset={replay.reset}
          onRetry={replay.retry}
          onRetryHistory={() => setHistoryAttempt((attempt) => attempt + 1)}
          onAction={onAction}
          onSelectHistorySource={(sourceId) => {
            setHistorySourceId(sourceId)
            focusSection(document.getElementById('source-history'))
          }}
          onOpenEvidence={() => setEvidenceOpen(true)}
          onCloseEvidence={() => setEvidenceOpen(false)}
          aside={checkIn}
        />
      </main>
      <footer className="app-footer"><span>Astro Vital · Space Apps prototype</span><span>Explainable replay. Not a medical device.</span></footer>
    </div>
  )
}
