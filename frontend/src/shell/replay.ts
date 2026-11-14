import { getStateAt, type DataMode } from '../api/client'
import type { Checkpoint, Run, ScenarioId, StateEnvelope } from '../api/types'

/**
 * Named checkpoints from contracts/v1.md. The shell seeks only to these while
 * continuous playback stays optional.
 */
export const CHECKPOINTS: Record<ScenarioId, Checkpoint[]> = {
  radlab_stale: [
    { id: '23:12:25', label: '23:12:25', as_of: '2022-04-01T23:12:25Z' },
    { id: '23:20:00', label: '23:20:00', as_of: '2022-04-01T23:20:00Z' },
    { id: '23:30:00', label: '23:30:00', as_of: '2022-04-01T23:30:00Z' },
  ],
  sleep_vigilance: [
    { id: '09:00', label: '09:00', as_of: '2026-01-10T09:00:00Z' },
    { id: '09:01', label: '09:01', as_of: '2026-01-10T09:01:00Z' },
  ],
}

export interface VisibleState {
  state: StateEnvelope
  dataMode: DataMode
}

export interface RequestGate {
  /** Reserve the next request; only the newest reservation may apply. */
  begin(): number
  isCurrent(token: number): boolean
  /** Drop everything in flight, e.g. when the run or scenario changes. */
  invalidate(): void
}

export function createRequestGate(): RequestGate {
  let latest = 0
  return {
    begin: () => ++latest,
    isCurrent: (token) => token === latest,
    invalidate: () => {
      latest += 1
    },
  }
}

/**
 * Resolve the state for one clock and drop the answer if a newer request (or a
 * reset/seek) has already superseded it. Returns null for stale responses.
 */
export async function loadVisibleState(
  run: Run,
  clock: string,
  gate: RequestGate,
  fetchState: (runId: string, asOf: string) => Promise<VisibleState> = getStateAt,
): Promise<VisibleState | null> {
  const token = gate.begin()
  const result = await fetchState(run.run_id, clock)
  return gate.isCurrent(token) ? result : null
}
