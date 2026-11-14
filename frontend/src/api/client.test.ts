import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRun, getObservations, getState, submitObservations } from './client'

const run = {
  run_id: 'r1',
  scenario_id: 'radlab_stale',
  initial_as_of: '2022-04-01T23:00:00Z',
  range_start: '2022-04-01T23:00:00Z',
  range_end: '2022-04-02T01:04:59Z',
} as const

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('api client', () => {
  it('creates a run with the scenario id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(run, 201))
    vi.stubGlobal('fetch', fetchMock)

    await expect(createRun('radlab_stale')).resolves.toEqual(run)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/runs',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ scenario_id: 'radlab_stale' }),
      }),
    )
  })

  it('requests state at the given clock', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ run_id: 'r1' }))
    vi.stubGlobal('fetch', fetchMock)

    await getState('r1', '2022-04-01T23:20:00Z')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/runs/r1/state?as_of=2022-04-01T23%3A20%3A00Z',
      expect.anything(),
    )
  })

  it('passes only provided observation filters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ observations: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await getObservations('r1', { asOf: '2022-04-01T23:20:00Z', sourceId: 'DosTel1' })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/runs/r1/observations?as_of=2022-04-01T23%3A20%3A00Z&source_id=DosTel1',
      expect.anything(),
    )
  })

  it('posts a submission and returns ids', async () => {
    const response = { submission_id: 's1', observation_ids: ['o1'] }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(response, 201))
    vi.stubGlobal('fetch', fetchMock)
    const submission = {
      submission_id: 's1',
      observed_at: '2026-01-10T09:05:00Z',
      entries: [
        { metric: 'sleep_duration', value: 400, unit: 'min', source_id: 'crew_sleep_log' },
      ],
    }

    await expect(submitObservations('r1', submission)).resolves.toEqual(response)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/runs/r1/observations',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(submission) }),
    )
  })

  it('surfaces the API detail on errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'Unknown run' }, 404)))

    await expect(getState('missing', '2022-04-01T23:20:00Z')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'Unknown run',
    })
  })
})
