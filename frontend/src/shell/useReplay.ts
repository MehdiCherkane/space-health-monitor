import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiError, createRun, getObservations, getStateAt, type DataMode } from '../api/client'
import type { LoadStatus, Observation, Run, ScenarioId, StateEnvelope } from '../api/types'
import { createRequestGate, loadVisibleState, stateForView } from './replay'

export type ReplayStatus = LoadStatus

function describe(cause: unknown): string {
  if (cause instanceof ApiError) return cause.message
  return 'Network error. Check that the local API is running.'
}

export interface Replay {
  scenarioId: ScenarioId
  run: Run | null
  clock: string
  /** State for exactly this run, scenario and clock; null while loading or after a failure. */
  state: StateEnvelope | null
  dataMode: DataMode
  status: ReplayStatus
  error: string | null
  /** Playback advances the replay clock through the run's range at the selected speed. */
  isPlaying: boolean
  speed: number
  togglePlay(): void
  setSpeed(speed: number): void
  setScenario(scenarioId: ScenarioId): void
  seek(asOf: string): void
  retry(): void
  /** Re-read the state at the current clock, e.g. after a submission. */
  refresh(): void
  reset(): void
}

const REPLAY_SPEEDS = [1, 2, 4] as const

function toUtcSecond(milliseconds: number): string {
  return new Date(milliseconds).toISOString().slice(0, 19) + 'Z'
}

/** The shell owns the clock and every request; features only render what it hands them. */
export function useReplay(initialScenario: ScenarioId = 'radlab_stale'): Replay {
  const [scenarioId, setScenarioId] = useState<ScenarioId>(initialScenario)
  const [run, setRun] = useState<Run | null>(null)
  const [clock, setClock] = useState('')
  const [state, setState] = useState<StateEnvelope | null>(null)
  const [dataMode, setDataMode] = useState<DataMode>('unknown')
  const [status, setStatus] = useState<ReplayStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [runAttempt, setRunAttempt] = useState(0)
  const [stateAttempt, setStateAttempt] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeedState] = useState(1)
  const gate = useRef(createRequestGate())

  useEffect(() => {
    let cancelled = false
    gate.current.invalidate()
    setRun(null)
    setState(null)
    setDataMode('unknown')
    setStatus('loading')
    setError(null)
    createRun(scenarioId)
      .then((created) => {
        if (cancelled) return
        setRun(created)
        setClock(created.initial_as_of)
      })
      .catch((cause) => {
        if (cancelled) return
        setStatus('error')
        setError(describe(cause))
      })
    return () => {
      cancelled = true
    }
  }, [scenarioId, runAttempt])

  useEffect(() => {
    if (!run || !clock) return
    let cancelled = false
    setStatus('loading')
    setError(null)
    loadVisibleState(run, clock, gate.current, getStateAt)
      .then((result) => {
        if (cancelled || !result) return
        setState(result.state)
        setDataMode(result.dataMode)
        if (result.dataMode === 'fixture-preview' && result.state.as_of !== clock) {
          // A preview is a fixed snapshot: move the clock to its own time instead of
          // presenting it as the requested one (bug B).
          setClock(result.state.as_of)
          return
        }
        setStatus('ready')
      })
      .catch((cause) => {
        if (cancelled) return
        // Never leave an earlier clock's state on screen beside a failure (bug A).
        setState(null)
        setStatus('error')
        setError(describe(cause))
      })
    return () => {
      cancelled = true
    }
  }, [run, clock, stateAttempt])

  // Playback is a shell concern: it only advances the authoritative replay clock.
  // One tick per second keeps the request gate from being flooded with updates.
  useEffect(() => {
    if (!isPlaying || !run) return undefined
    const interval = window.setInterval(() => {
      setClock((current) => {
        const end = Date.parse(run.range_end)
        const next = Math.min(Date.parse(current || run.initial_as_of) + speed * 30_000, end)
        return toUtcSecond(next)
      })
    }, 1000)
    return () => window.clearInterval(interval)
  }, [isPlaying, run, speed])

  useEffect(() => {
    if (!isPlaying || !run) return
    if (Date.parse(clock) >= Date.parse(run.range_end)) setIsPlaying(false)
  }, [clock, isPlaying, run])

  // A new run or scenario is a new replay context; never carry playback across it.
  useEffect(() => {
    setIsPlaying(false)
  }, [run?.run_id, scenarioId])

  const togglePlay = useCallback(() => {
    if (!run) return
    if (!isPlaying && Date.parse(clock || run.initial_as_of) >= Date.parse(run.range_end)) {
      setClock(toUtcSecond(Date.parse(run.range_start)))
    }
    setIsPlaying((playing) => !playing)
  }, [run, isPlaying, clock])

  const setSpeed = useCallback((next: number) => {
    setSpeedState(REPLAY_SPEEDS.includes(next as (typeof REPLAY_SPEEDS)[number]) ? next : 1)
  }, [])

  const seek = useCallback((asOf: string) => {
    gate.current.invalidate()
    setClock(asOf)
  }, [])

  const setScenario = useCallback(
    (next: ScenarioId) => {
      if (next === scenarioId) return
      gate.current.invalidate()
      setScenarioId(next)
      setClock('')
      setRunAttempt((attempt) => attempt + 1)
    },
    [scenarioId],
  )

  const refresh = useCallback(() => setStateAttempt((attempt) => attempt + 1), [])

  const retry = useCallback(() => {
    if (run) refresh()
    else setRunAttempt((attempt) => attempt + 1)
  }, [run, refresh])

  const reset = useCallback(() => {
    gate.current.invalidate()
    setIsPlaying(false)
    setClock('')
    setRunAttempt((attempt) => attempt + 1)
  }, [])

  return {
    scenarioId,
    run,
    clock,
    state: stateForView(state, run, clock),
    dataMode,
    status,
    error,
    isPlaying,
    speed,
    togglePlay,
    setSpeed,
    setScenario,
    seek,
    retry,
    refresh,
    reset,
  }
}

export interface HistoryResult {
  observations: Observation[]
  status: ReplayStatus
  error: string | null
}

/**
 * D7: the shell reads source history and passes it to the dashboard. A response for an
 * older run, clock or source is discarded.
 */
export function useSourceHistory(
  run: Run | null,
  clock: string,
  sourceId: string | null,
  metric: string | null,
  attempt = 0,
  /** The state this history accompanies; a newly loaded state (e.g. after a submit) reloads it. */
  version: unknown = null,
): HistoryResult {
  const [result, setResult] = useState<HistoryResult & { key: string }>({
    key: '',
    observations: [],
    status: 'idle',
    error: null,
  })
  const key = run && clock && sourceId ? `${run.run_id}|${clock}|${sourceId}|${metric}` : ''

  useEffect(() => {
    if (!run || !key || !sourceId) return
    let cancelled = false
    setResult({ key, observations: [], status: 'loading', error: null })
    getObservations(run.run_id, {
      asOf: clock,
      sourceId,
      metric: metric ?? undefined,
      limit: 180,
    })
      .then((history) => {
        if (!cancelled) setResult({ key, observations: history.observations, status: 'ready', error: null })
      })
      .catch((cause) => {
        if (!cancelled) setResult({ key, observations: [], status: 'error', error: describe(cause) })
      })
    return () => {
      cancelled = true
    }
    // `key` covers run, clock, source and metric.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt, version])

  if (result.key !== key) return { observations: [], status: key ? 'loading' : 'idle', error: null }
  return result
}
