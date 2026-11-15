// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import * as client from './api/client'
import type { Run, StateEnvelope, SubmissionResponse } from './api/types'
import gallery from './gallery/states.json'
import { buttonByText, click, flush, render, text, type, type Rendered } from './test/dom'

vi.mock('./api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/client')>()
  return {
    ...actual,
    createRun: vi.fn(),
    getStateAt: vi.fn(),
    getObservations: vi.fn(),
    submitObservations: vi.fn(),
  }
})

const api = vi.mocked(client)
const states = gallery as { id: string; state: StateEnvelope }[]
const EXAMPLE_A = states.find((item) => item.id === 'state-1')!.state
const RECOVERED = states.find((item) => item.id === 'state-4')!.state
const EXAMPLE_B = states.find((item) => item.id === 'state-8')!.state

function radlabRun(id: string): Run {
  return {
    run_id: id,
    scenario_id: 'radlab_stale',
    initial_as_of: '2022-04-01T23:00:00Z',
    range_start: '2022-04-01T23:00:00Z',
    range_end: '2022-04-02T01:04:59Z',
  }
}

function crewRun(id: string): Run {
  return {
    run_id: id,
    scenario_id: 'sleep_vigilance',
    initial_as_of: '2026-01-10T09:00:00Z',
    range_start: '2026-01-10T09:00:00Z',
    range_end: '2026-01-10T10:00:00Z',
  }
}

/** Integrated engine output pinned to the run and requested clock. */
function at(base: StateEnvelope, runId: string, asOf: string): StateEnvelope {
  return { ...structuredClone(base), run_id: runId, as_of: asOf }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((settle, fail) => {
    resolve = settle
    reject = fail
  })
  return { promise, resolve, reject }
}

let view: Rendered | null = null

beforeEach(() => {
  vi.resetAllMocks()
  api.getObservations.mockResolvedValue({ observations: [] })
})

afterEach(() => {
  view?.unmount()
  view = null
})

const title = () => text(view!.container.querySelector('.ui-assessment__title'))
const clockText = () => text(view!.container.querySelector('.dash-clock'))

describe('replay state ownership (bug A)', () => {
  it('keeps the pending response when its checkpoint is selected again', async () => {
    api.createRun.mockResolvedValue(radlabRun('r1'))
    const slow = deferred<client.StateResult>()
    api.getStateAt.mockImplementation(async (runId, asOf) => {
      if (asOf === '2022-04-01T23:30:00Z') return slow.promise
      return { state: at(EXAMPLE_A, runId, asOf), dataMode: 'integrated' }
    })
    view = await render(<App />)
    await flush()
    await click(buttonByText(view.container, '23:30:00'))
    await click(buttonByText(view.container, '23:30:00'))
    slow.resolve({ state: at(RECOVERED, 'r1', '2022-04-01T23:30:00Z'), dataMode: 'integrated' })
    await flush()
    expect(title()).toBe('DosTel1 current · DosTel2 current')
    expect(api.getStateAt.mock.calls.filter(([, time]) => time === '2022-04-01T23:30:00Z')).toHaveLength(1)
  })

  it('withholds the 23:30 state after a failed rewind to 23:20', async () => {
    api.createRun.mockResolvedValue(radlabRun('r1'))
    api.getStateAt.mockImplementation(async (runId, asOf) => ({
      state: at(asOf === '2022-04-01T23:30:00Z' ? RECOVERED : EXAMPLE_A, runId, asOf),
      dataMode: 'integrated',
    }))
    view = await render(<App />)
    await flush()

    await click(buttonByText(view.container, '23:30:00'))
    await flush()
    expect(title()).toBe('DosTel1 current · DosTel2 current')
    expect(text(view.container)).toContain('resolved')

    api.getStateAt.mockRejectedValueOnce(new client.ApiError(500, 'Internal Server Error'))
    await click(buttonByText(view.container, '23:20:00'))
    await flush()

    expect(clockText()).toBe('2022-04-01 23:20:00 UTC')
    expect(view.container.querySelector('.ui-assessment')).toBeNull()
    expect(text(view.container)).not.toContain('resolved')
    const alert = view.container.querySelector('[role="alert"]')
    expect(text(alert)).toContain('Internal Server Error')
    expect(text(alert)).toContain('No state is shown for 2022-04-01 23:20:00 UTC')
  })

  it('keeps the newest seek when an older response arrives late', async () => {
    api.createRun.mockResolvedValue(radlabRun('r1'))
    const slow = deferred<client.StateResult>()
    api.getStateAt.mockImplementation(async (runId, asOf) => {
      if (asOf === '2022-04-01T23:30:00Z') return slow.promise
      return { state: at(EXAMPLE_A, runId, asOf), dataMode: 'integrated' }
    })
    view = await render(<App />)
    await flush()

    await click(buttonByText(view.container, '23:30:00'))
    await click(buttonByText(view.container, '23:20:00'))
    await flush()
    expect(title()).toBe('DosTel1 stale · DosTel2 current')

    slow.resolve({ state: at(RECOVERED, 'r1', '2022-04-01T23:30:00Z'), dataMode: 'integrated' })
    await flush()
    expect(clockText()).toBe('2022-04-01 23:20:00 UTC')
    expect(title()).toBe('DosTel1 stale · DosTel2 current')
  })
})

describe('fixture preview (bug B)', () => {
  it('shows the snapshot at its own time and disables replay checkpoints', async () => {
    api.createRun.mockResolvedValue(radlabRun('r1'))
    // The API returns the fixed example regardless of the requested clock.
    api.getStateAt.mockImplementation(async (runId) => ({
      state: { ...structuredClone(EXAMPLE_A), run_id: runId },
      dataMode: 'fixture-preview',
    }))
    view = await render(<App />)
    await flush()

    expect(clockText()).toBe('2022-04-01 23:20:00 UTC')
    expect(text(view.container)).toContain('Fixture preview')
    expect(text(view.container)).toContain('fixed snapshot')
    expect(buttonByText(view.container, '23:30:00').disabled).toBe(true)
    expect(title()).toBe('DosTel1 stale · DosTel2 current')
  })
})

describe('check-in lifecycle across runs (bug C)', () => {
  async function openCrewScenario(runs: Run[]) {
    api.createRun.mockResolvedValueOnce(radlabRun('r0'))
    for (const run of runs) api.createRun.mockResolvedValueOnce(run)
    api.getStateAt.mockImplementation(async (runId, asOf) => ({
      state: at(EXAMPLE_B, runId, asOf),
      dataMode: 'integrated',
    }))
    view = await render(<App />)
    await flush()
    await click(buttonByText(view.container, 'Sleep and vigilance'))
    await flush()
  }

  const sleepInput = () => view!.container.querySelector<HTMLInputElement>('#checkin-sleep')!

  it('does not carry a failed submission and its retry into a fresh run', async () => {
    await openCrewScenario([crewRun('c1'), crewRun('c2')])
    api.submitObservations.mockRejectedValueOnce(new client.ApiError(500, 'Server unavailable'))

    await type(sleepInput(), '400')
    await click(buttonByText(view!.container, 'Submit check-in'))
    await flush()
    expect(text(view!.container)).toContain('Server unavailable')
    expect(buttonByText(view!.container, 'Retry submission')).toBeTruthy()
    const failedId = api.submitObservations.mock.calls[0][1].submission_id

    await click(buttonByText(view!.container, 'Fresh run'))
    await flush()
    expect(sleepInput().value).toBe('')
    expect(text(view!.container)).not.toContain('Server unavailable')
    expect(() => buttonByText(view!.container, 'Retry submission')).toThrow()

    api.submitObservations.mockResolvedValueOnce({ submission_id: 'x', observation_ids: [] })
    await type(sleepInput(), '400')
    await click(buttonByText(view!.container, 'Submit check-in'))
    await flush()
    const [runId, submission] = api.submitObservations.mock.calls[1]
    expect(runId).toBe('c2')
    expect(submission.submission_id).not.toBe(failedId)
  })

  it('retries with the same id, payload and mission time within one run', async () => {
    await openCrewScenario([crewRun('c1')])
    api.submitObservations
      .mockRejectedValueOnce(new client.ApiError(500, 'Server unavailable'))
      .mockResolvedValueOnce({ submission_id: 'ok', observation_ids: ['ok:0'] })

    await type(sleepInput(), '400')
    await click(buttonByText(view!.container, 'Submit check-in'))
    await flush()
    await click(buttonByText(view!.container, 'Retry submission'))
    await flush()
    const [first, second] = api.submitObservations.mock.calls
    expect(second).toEqual(first)
    expect(second[1].observed_at).toBe('2026-01-10T09:00:00Z')
  })

  it('drops an active reaction task when a fresh run starts', async () => {
    await openCrewScenario([crewRun('c1'), crewRun('c2')])
    const checkIn = () => view!.container.querySelector('.crew-checkin')!
    await click(buttonByText(checkIn(), 'Run reaction check'))
    expect(text(view!.container)).toContain('Local reaction check')

    await click(buttonByText(view!.container, 'Fresh run'))
    await flush()
    expect(text(view!.container)).not.toContain('Local reaction check')
    expect(buttonByText(checkIn(), 'Run reaction check')).toBeTruthy()
  })

  it('does not refresh the new run when an old run submission resolves late', async () => {
    await openCrewScenario([crewRun('c1'), crewRun('c2')])
    const pending = deferred<SubmissionResponse>()
    api.submitObservations.mockReturnValueOnce(pending.promise)

    await type(sleepInput(), '400')
    await click(buttonByText(view!.container, 'Submit check-in'))
    await click(buttonByText(view!.container, 'Fresh run'))
    await flush()
    const callsAfterReset = api.getStateAt.mock.calls.length

    pending.resolve({ submission_id: 'late', observation_ids: ['late:0'] })
    await flush()
    expect(api.getStateAt.mock.calls.length).toBe(callsAfterReset)
    expect(text(view!.container)).not.toContain('Check-in submitted')
  })

  it('refreshes state after a successful submission in the same run', async () => {
    await openCrewScenario([crewRun('c1')])
    api.submitObservations.mockResolvedValueOnce({ submission_id: 's', observation_ids: ['s:0'] })
    const before = api.getStateAt.mock.calls.length
    const historyBefore = api.getObservations.mock.calls.length
    await type(sleepInput(), '400')
    await click(buttonByText(view!.container, 'Submit check-in'))
    await flush()
    expect(api.getStateAt.mock.calls.length).toBe(before + 1)
    // History reloads with the refreshed state so the new entry appears.
    expect(api.getObservations.mock.calls.length).toBe(historyBefore + 1)
    expect(text(view!.container)).toContain('Check-in submitted')
  })
})

describe('action routing', () => {
  it('routes review_available_inputs from the check-in to the evidence drawer', async () => {
    const unavailable = states.find((item) => item.id === 'state-12')!.state
    api.createRun.mockResolvedValueOnce(radlabRun('r0')).mockResolvedValueOnce(crewRun('c1'))
    api.getStateAt.mockImplementation(async (runId, asOf) => ({
      state: at(runId === 'r0' ? EXAMPLE_A : unavailable, runId, asOf),
      dataMode: 'integrated',
    }))
    view = await render(<App />)
    await flush()
    await click(buttonByText(view.container, 'Sleep and vigilance'))
    await flush()

    const reaction = buttonByText(view.container, 'Run reaction check')
    expect(reaction.disabled).toBe(true)
    expect(text(view.container)).toContain('Reaction check unavailable')
    expect(text(view.container.querySelector('.ui-badge[data-state="insufficient_data"]'))).toContain(
      'insufficient data',
    )

    const dialog = view.container.querySelector('dialog')!
    expect(dialog.open).toBe(false)
    const fallback = Array.from(view.container.querySelectorAll('.crew-checkin button')).find(
      (button) => text(button) === 'Review available inputs',
    )!
    await click(fallback)
    expect(dialog.open).toBe(true)
    expect(text(dialog)).toContain('Missing inputs')
    expect(text(dialog)).toContain('reaction_time')
  })

  it('routes start_reaction_check to the check-in and view_source_history to history', async () => {
    api.createRun.mockResolvedValueOnce(radlabRun('r0')).mockResolvedValueOnce(crewRun('c1'))
    api.getStateAt.mockImplementation(async (runId, asOf) => ({
      state: at(runId === 'r0' ? EXAMPLE_A : EXAMPLE_B, runId, asOf),
      dataMode: 'integrated',
    }))
    view = await render(<App />)
    await flush()

    await click(buttonByText(view.container.querySelector('.ui-assessment')!, 'Review source history'))
    expect(document.activeElement?.id).toBe('source-history')
    expect(api.getObservations).toHaveBeenCalledWith(
      'r0',
      expect.objectContaining({ asOf: '2022-04-01T23:00:00Z', sourceId: 'DosTel1' }),
    )

    await click(buttonByText(view.container, 'Sleep and vigilance'))
    await flush()
    await click(buttonByText(view.container.querySelector('.ui-assessment')!, 'Run reaction check'))
    expect(document.activeElement?.classList.contains('app-checkin')).toBe(true)
  })
})
