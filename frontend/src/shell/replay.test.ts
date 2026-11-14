import { describe, expect, it, vi } from 'vitest'

import type { Run, StateEnvelope } from '../api/types'
import {
  CHECKPOINTS,
  createRequestGate,
  loadVisibleState,
  stateForView,
  type VisibleState,
} from './replay'

const run: Run = {
  run_id: 'r1',
  scenario_id: 'radlab_stale',
  initial_as_of: '2022-04-01T23:00:00Z',
  range_start: '2022-04-01T23:00:00Z',
  range_end: '2022-04-02T01:04:59Z',
}

function emptyState(asOf: string): StateEnvelope {
  return {
    schema_version: 1,
    run_id: 'r1',
    scenario_id: 'radlab_stale',
    as_of: asOf,
    sources: [],
    observations: [],
    assessments: [],
    actions: [],
    incidents: [],
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

describe('replay checkpoints', () => {
  it('keeps the named RadLab checkpoints, including the A02 boundary, in order', () => {
    expect(CHECKPOINTS.radlab_stale.map((checkpoint) => checkpoint.as_of)).toEqual([
      '2022-04-01T23:12:25Z',
      '2022-04-01T23:17:25Z',
      '2022-04-01T23:17:26Z',
      '2022-04-01T23:20:00Z',
      '2022-04-01T23:30:00Z',
    ])
  })
})

describe('late responses', () => {
  it('drops a response superseded by a newer seek', async () => {
    const gate = createRequestGate()
    const first = deferred<VisibleState>()
    const second = deferred<VisibleState>()
    const fetchState = vi
      .fn<(runId: string, asOf: string) => Promise<VisibleState>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const stale = loadVisibleState(run, '2022-04-01T23:12:25Z', gate, fetchState)
    const current = loadVisibleState(run, '2022-04-01T23:20:00Z', gate, fetchState)

    const currentResult = { state: emptyState('2022-04-01T23:20:00Z'), dataMode: 'integrated' as const }
    second.resolve(currentResult)
    await expect(current).resolves.toEqual(currentResult)

    first.resolve({ state: emptyState('2022-04-01T23:12:25Z'), dataMode: 'fixture-preview' })
    await expect(stale).resolves.toBeNull()
  })

  it('drops in-flight work after a reset', async () => {
    const gate = createRequestGate()
    const pending = deferred<VisibleState>()

    const request = loadVisibleState(run, run.initial_as_of, gate, () => pending.promise)
    gate.invalidate()
    pending.resolve({ state: emptyState(run.initial_as_of), dataMode: 'integrated' })

    await expect(request).resolves.toBeNull()
  })

  it('keeps a response that no newer request replaced', async () => {
    const gate = createRequestGate()
    const result = { state: emptyState(run.initial_as_of), dataMode: 'fixture-preview' as const }

    await expect(
      loadVisibleState(run, run.initial_as_of, gate, () => Promise.resolve(result)),
    ).resolves.toEqual(result)
  })
})

describe('stateForView', () => {
  const at = (asOf: string, runId = 'r1') => ({ ...emptyState(asOf), run_id: runId })

  it('shows state only for the active run and clock', () => {
    expect(stateForView(at('2022-04-01T23:20:00Z'), run, '2022-04-01T23:20:00Z')).not.toBeNull()
    // Retained 23:30 state must never appear under a 23:20 clock (no future evidence).
    expect(stateForView(at('2022-04-01T23:30:00Z'), run, '2022-04-01T23:20:00Z')).toBeNull()
    expect(stateForView(at('2022-04-01T23:20:00Z', 'old-run'), run, '2022-04-01T23:20:00Z')).toBeNull()
    expect(stateForView(null, run, '2022-04-01T23:20:00Z')).toBeNull()
    expect(stateForView(at('2022-04-01T23:20:00Z'), null, '2022-04-01T23:20:00Z')).toBeNull()
  })

  it('withholds state from another scenario', () => {
    const crew = { ...at('2022-04-01T23:20:00Z'), scenario_id: 'sleep_vigilance' as const }
    expect(stateForView(crew, run, '2022-04-01T23:20:00Z')).toBeNull()
  })
})

describe('superseded failures', () => {
  it('drops the error of a request a newer seek replaced', async () => {
    const gate = createRequestGate()
    const first = deferred<VisibleState>()
    let rejectFirst!: (error: Error) => void
    const failing = new Promise<VisibleState>((_, reject) => {
      rejectFirst = reject
    })
    const fetchState = vi
      .fn<(runId: string, asOf: string) => Promise<VisibleState>>()
      .mockReturnValueOnce(failing)
      .mockReturnValueOnce(first.promise)

    const old = loadVisibleState(run, '2022-04-01T23:30:00Z', gate, fetchState)
    const current = loadVisibleState(run, '2022-04-01T23:20:00Z', gate, fetchState)
    rejectFirst(new Error('late failure'))
    await expect(old).resolves.toBeNull()
    first.resolve({ state: emptyState('2022-04-01T23:20:00Z'), dataMode: 'integrated' })
    await expect(current).resolves.not.toBeNull()
  })
})
