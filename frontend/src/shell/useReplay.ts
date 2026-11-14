import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiError, createRun, getStateAt, type DataMode } from '../api/client'
import type { Run, ScenarioId, StateEnvelope } from '../api/types'
import { loadVisibleState, createRequestGate } from './replay'

export type ReplayStatus = 'idle' | 'loading' | 'ready' | 'error'

function describe(cause: unknown): string {
  if (cause instanceof ApiError) return cause.message
  return 'Network error. Check that the local API is running.'
}

export interface Replay {
  scenarioId: ScenarioId
  run: Run | null
  clock: string
  state: StateEnvelope | null
  dataMode: DataMode
  status: ReplayStatus
  error: string | null
  setScenario(scenarioId: ScenarioId): void
  seek(asOf: string): void
  retry(): void
  reset(): void
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
        setStatus('ready')
      })
      .catch((cause) => {
        if (cancelled) return
        setStatus('error')
        setError(describe(cause))
      })
    return () => {
      cancelled = true
    }
  }, [run, clock, stateAttempt])

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

  const retry = useCallback(() => {
    if (run) setStateAttempt((attempt) => attempt + 1)
    else setRunAttempt((attempt) => attempt + 1)
  }, [run])

  const reset = useCallback(() => {
    gate.current.invalidate()
    setClock('')
    setRunAttempt((attempt) => attempt + 1)
  }, [])

  return {
    scenarioId,
    run,
    clock,
    state,
    dataMode,
    status,
    error,
    setScenario,
    seek,
    retry,
    reset,
  }
}
