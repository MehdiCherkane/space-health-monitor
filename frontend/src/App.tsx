import { CHECKPOINTS } from './shell/replay'
import { useReplay } from './shell/useReplay'
import type { ScenarioId } from './api/types'

const SCENARIOS: { id: ScenarioId; label: string }[] = [
  { id: 'radlab_stale', label: 'Detector gap (RadLab)' },
  { id: 'sleep_vigilance', label: 'Sleep and vigilance' },
]

const MODE_LABEL = {
  'fixture-preview': 'Fixture preview',
  integrated: 'Integrated run',
  unknown: 'Preview shell',
} as const

export default function App() {
  const replay = useReplay('radlab_stale')
  const checkpoints = CHECKPOINTS[replay.scenarioId]

  return (
    <main className="shell">
      <header className="shell-header">
        <h1>Astro Vital</h1>
        <span className="badge" data-mode={replay.dataMode}>
          {MODE_LABEL[replay.dataMode]}
        </span>
      </header>

      <nav className="toolbar" aria-label="Scenario">
        {SCENARIOS.map((scenario) => (
          <button
            key={scenario.id}
            type="button"
            className="chip"
            aria-pressed={replay.scenarioId === scenario.id}
            onClick={() => replay.setScenario(scenario.id)}
          >
            {scenario.label}
          </button>
        ))}
      </nav>

      <nav className="toolbar" aria-label="Replay checkpoints">
        {checkpoints.map((checkpoint) => (
          <button
            key={checkpoint.id}
            type="button"
            className="chip"
            aria-pressed={replay.clock === checkpoint.as_of}
            onClick={() => replay.seek(checkpoint.as_of)}
          >
            {checkpoint.label}
          </button>
        ))}
        <button type="button" className="chip" onClick={replay.reset}>
          Fresh run
        </button>
      </nav>

      <p className="shell-note">Clock: {replay.clock || '—'}</p>

      {replay.status === 'error' && (
        <div className="shell-status" role="alert">
          <p>{replay.error}</p>
          <button type="button" className="chip" onClick={replay.retry}>
            Retry
          </button>
        </div>
      )}
      {replay.status === 'loading' && <p role="status">Loading…</p>}

      {replay.state && (
        <section aria-label="Returned state">
          <ul className="state-list">
            {replay.state.sources.map((source) => (
              <li key={source.source_id}>
                {source.source_id}: {source.state}
                {source.age_seconds === null ? '' : ` · ${source.age_seconds} s`}
              </li>
            ))}
          </ul>
          {replay.state.assessments.map((assessment) => (
            <p key={assessment.id}>
              <strong>{assessment.title}</strong> · {assessment.state}
            </p>
          ))}
        </section>
      )}

      <p className="shell-note">
        Shell preview. The dashboard and check-in components mount here once their
        exports land.
      </p>
    </main>
  )
}
