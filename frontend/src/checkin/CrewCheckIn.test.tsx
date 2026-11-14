// @vitest-environment jsdom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Action, CheckInProps, Run, SubmissionResponse } from '../api/types'
import { CrewCheckIn } from './CrewCheckIn'
import { buttonByText, click, flush, render, text, type, type Rendered } from '../test/dom'

const RUN: Run = {
  run_id: 'c1',
  scenario_id: 'sleep_vigilance',
  initial_as_of: '2026-01-10T09:00:00Z',
  range_start: '2026-01-10T09:00:00Z',
  range_end: '2026-01-10T10:00:00Z',
}

const MISSION_TIME = '2026-01-10T09:00:00Z'

const START_ACTION: Action = {
  id: 'start_reaction_check',
  label: 'Run reaction check',
  required_resource_ids: ['local_reaction_task'],
  available: true,
  unavailable_reason: null,
}

const UNAVAILABLE_START_ACTION: Action = {
  ...START_ACTION,
  available: false,
  unavailable_reason: 'Local reaction task is disabled for this replay.',
}

const REVIEW_ACTION: Action = {
  id: 'review_available_inputs',
  label: 'Review available inputs',
  required_resource_ids: [],
  available: true,
  unavailable_reason: null,
}

const AGGRESSIVE_REVIEW_LABEL: Action = {
  ...REVIEW_ACTION,
  label: 'Review inputs from engine',
}

function okResponse(): SubmissionResponse {
  return { submission_id: 'srv', observation_ids: [] }
}

function crewProps(
  actions: Action[],
  overrides: Partial<Pick<CheckInProps, 'missionTime' | 'onSubmit' | 'onAction'>> = {},
): CheckInProps {
  return {
    run: RUN,
    scenarioId: 'sleep_vigilance',
    missionTime: MISSION_TIME,
    actions,
    onSubmit: async () => okResponse(),
    onAction: () => undefined,
    ...overrides,
  }
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

/** Read the React onClick that was attached during this render, including after a rerender. */
function staleClickHandler(element: Element): (event?: unknown) => void {
  const key = [...Object.keys(element), ...Object.getOwnPropertyNames(element)].find((name) =>
    name.startsWith('__reactProps$'),
  )
  if (!key) throw new Error('React props not found on element')
  const props = (element as unknown as Record<string, { onClick?: (event?: unknown) => void }>)[key]
  if (typeof props.onClick !== 'function') throw new Error('Element has no onClick handler')
  return props.onClick
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

async function pressSpace(options: { repeat?: boolean } = {}) {
  await act(async () => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: ' ',
        code: 'Space',
        bubbles: true,
        cancelable: true,
        repeat: options.repeat ?? false,
      }),
    )
  })
}

async function waitForStimulus(container: HTMLElement) {
  // Math.random is pinned to 0.5: 2250 ms wait, plus at most 500 ms feedback.
  await advance(3000)
  expect(text(container.querySelector('.crew-checkin__stimulus'))).toContain(
    'Press the space bar now!',
  )
}

async function runReactionTask(
  container: HTMLElement,
  options: { falseStart?: boolean; heldRepeat?: boolean } = {},
) {
  await click(buttonByText(container, 'Run reaction check'))
  await click(buttonByText(container, 'Start practice'))

  for (let trial = 0; trial < 3; trial += 1) {
    await waitForStimulus(container)
    await pressSpace()
  }

  expect(text(container)).toContain('Practice complete')
  await click(buttonByText(container, 'Start measured trials'))

  if (options.heldRepeat) {
    // Held-key repeat while waiting must be ignored, not counted as a false start.
    await pressSpace({ repeat: true })
  }
  if (options.falseStart) {
    // Early real press while waiting counts as a false start and never as a trial.
    await pressSpace()
  }

  for (let trial = 0; trial < 12; trial += 1) {
    await waitForStimulus(container)
    if (options.heldRepeat && trial === 0) {
      // Held-key repeat at the stimulus must not record a trial.
      await pressSpace({ repeat: true })
    }
    await pressSpace()
  }

  await flush(8)
}

let view: Rendered | null = null

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] })
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
})

afterEach(() => {
  view?.unmount()
  view = null
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('completed reaction result availability', () => {
  it('keeps the result and rejects a stale restart when the action becomes unavailable', async () => {
    const onSubmit = vi.fn<CheckInProps['onSubmit']>(async () => okResponse())
    const onAction = vi.fn()
    view = await render(
      <CrewCheckIn
        {...crewProps([START_ACTION, REVIEW_ACTION], { onSubmit, onAction })}
      />,
    )

    await runReactionTask(view.container)
    expect(text(view.container)).toContain('Reaction check complete')
    expect(text(view.container)).toContain('Recorded on this device')
    expect(text(view.container)).toMatch(/Median response time\s*\d+ ms/)
    expect(onSubmit).toHaveBeenCalledTimes(1)

    const stale = staleClickHandler(buttonByText(view.container, 'Run reaction check again'))

    await view.rerender(
      <CrewCheckIn
        {...crewProps([UNAVAILABLE_START_ACTION, REVIEW_ACTION], { onSubmit, onAction })}
      />,
    )

    expect(text(view.container)).toContain('Reaction check complete')
    expect(text(view.container)).toContain('Recorded on this device')
    expect(text(view.container)).toContain('Reaction check unavailable')
    expect(text(view.container)).toContain('Local reaction task is disabled for this replay.')
    const restart = buttonByText(view.container, 'Run reaction check again')
    expect(restart.disabled).toBe(true)

    // A callback retained from the available render must not bypass the new props.
    await act(async () => {
      stale(new MouseEvent('click'))
    })
    await flush()
    expect(text(view.container)).not.toContain('Local reaction check')
    expect(view.container.querySelector('.crew-checkin__reaction-task')).toBeNull()

    await click(buttonByText(view.container, 'Review available inputs'))
    expect(onAction).toHaveBeenCalledWith('review_available_inputs')
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('keeps a completed result when the start action is absent, then permits a fresh task later', async () => {
    const onSubmit = vi.fn<CheckInProps['onSubmit']>(async () => okResponse())
    view = await render(
      <CrewCheckIn {...crewProps([START_ACTION, AGGRESSIVE_REVIEW_LABEL], { onSubmit })} />,
    )

    await runReactionTask(view.container)
    expect(onSubmit).toHaveBeenCalledTimes(1)

    const stale = staleClickHandler(buttonByText(view.container, 'Run reaction check again'))
    await view.rerender(
      <CrewCheckIn {...crewProps([AGGRESSIVE_REVIEW_LABEL], { onSubmit })} />,
    )

    expect(text(view.container)).toContain('Reaction check complete')
    expect(text(view.container)).toContain('Reaction check unavailable')
    expect(buttonByText(view.container, 'Run reaction check again').disabled).toBe(true)
    expect(buttonByText(view.container, 'Review inputs from engine')).toBeTruthy()

    await act(async () => {
      stale(new MouseEvent('click'))
    })
    await flush()
    expect(text(view.container)).not.toContain('Local reaction check')

    await view.rerender(
      <CrewCheckIn {...crewProps([START_ACTION, AGGRESSIVE_REVIEW_LABEL], { onSubmit })} />,
    )
    const restart = buttonByText(view.container, 'Run reaction check again')
    expect(restart.disabled).toBe(false)
    await click(restart)
    expect(text(view.container)).toContain('Local reaction check')
    expect(text(view.container)).toContain('Start practice')
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('interrupts an active measurement when availability is withdrawn and starts fresh later', async () => {
    const onSubmit = vi.fn<CheckInProps['onSubmit']>(async () => okResponse())
    const onAction = vi.fn()
    view = await render(
      <CrewCheckIn
        {...crewProps([START_ACTION, REVIEW_ACTION], { onSubmit, onAction })}
      />,
    )

    await click(buttonByText(view.container, 'Run reaction check'))
    await click(buttonByText(view.container, 'Start practice'))
    await waitForStimulus(view.container)
    expect(text(view.container)).toContain('Practice trial 1 of 3')

    await view.rerender(
      <CrewCheckIn
        {...crewProps([UNAVAILABLE_START_ACTION, REVIEW_ACTION], { onSubmit, onAction })}
      />,
    )

    expect(view.container.querySelector('.crew-checkin__reaction-task')).toBeNull()
    expect(text(view.container)).toContain('Reaction check unavailable')
    expect(text(view.container)).toContain('Local reaction task is disabled for this replay.')

    // Advancing the removed timer and pressing the old key must not complete or submit.
    await advance(15000)
    await pressSpace()
    await flush()
    expect(onSubmit).not.toHaveBeenCalled()

    await view.rerender(
      <CrewCheckIn
        {...crewProps([START_ACTION, REVIEW_ACTION], { onSubmit, onAction })}
      />,
    )
    await click(buttonByText(view.container, 'Run reaction check'))
    expect(text(view.container)).toContain('Local reaction check')
    expect(text(view.container)).toContain('Start practice')
    expect(text(view.container)).not.toContain('Practice trial 1 of 3')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('retries a failed completed submission with the same id, payload and mission time', async () => {
    const onSubmit = vi
      .fn<CheckInProps['onSubmit']>()
      .mockRejectedValueOnce(new Error('Server unavailable'))
      .mockResolvedValueOnce(okResponse())
    view = await render(
      <CrewCheckIn {...crewProps([START_ACTION, REVIEW_ACTION], { onSubmit })} />,
    )

    await runReactionTask(view.container)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(text(view.container)).toContain('Server unavailable')
    const failedPayload = onSubmit.mock.calls[0][0]

    await view.rerender(
      <CrewCheckIn
        {...crewProps([UNAVAILABLE_START_ACTION, REVIEW_ACTION], {
          onSubmit,
          missionTime: '2026-01-10T09:05:00Z',
        })}
      />,
    )
    expect(text(view.container)).toContain('Reaction check complete')
    expect(text(view.container)).toContain('Reaction check unavailable')
    expect(text(view.container)).not.toContain('Local reaction check')

    await click(buttonByText(view.container, 'Retry submission'))
    await flush()

    expect(onSubmit).toHaveBeenCalledTimes(2)
    expect(onSubmit.mock.calls[1][0]).toEqual(failedPayload)
    expect(onSubmit.mock.calls[1][0].observed_at).toBe(MISSION_TIME)
    expect(text(view.container)).toContain('Reaction result submitted.')
    expect(text(view.container)).not.toContain('Local reaction check')
  })
})

describe('reaction task component lifecycle', () => {
  it('submits measured trials once with false starts counted and held repeats ignored', async () => {
    const onSubmit = vi.fn<CheckInProps['onSubmit']>(async () => okResponse())
    view = await render(<CrewCheckIn {...crewProps([START_ACTION, REVIEW_ACTION], { onSubmit })} />)

    await runReactionTask(view.container, { falseStart: true, heldRepeat: true })

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0]
    expect(payload.observed_at).toBe(MISSION_TIME)
    const entry = payload.entries[0]
    expect(entry.source_id).toBe('reaction_task')
    expect(entry.metric).toBe('reaction_time')
    expect(entry.unit).toBe('ms')
    expect(entry.value).toBeGreaterThan(0)
    expect(Number.isFinite(entry.value)).toBe(true)
    expect(entry.metadata).toMatchObject({
      task_version: 'demo-rt-v1',
      input_profile: 'browser-keyboard',
      trial_count: 12,
      false_starts: 1,
      completed: true,
    })
    expect(Number.isNaN(Date.parse(String(entry.metadata?.captured_at)))).toBe(false)
    expect(text(view.container)).toContain('Reaction check complete')
  })

  it('cancels an active task without submitting or leaving it running', async () => {
    const onSubmit = vi.fn<CheckInProps['onSubmit']>(async () => okResponse())
    view = await render(<CrewCheckIn {...crewProps([START_ACTION, REVIEW_ACTION], { onSubmit })} />)

    await click(buttonByText(view.container, 'Run reaction check'))
    await click(buttonByText(view.container, 'Start practice'))
    await waitForStimulus(view.container)
    await click(buttonByText(view.container, 'Cancel reaction check'))

    expect(view.container.querySelector('.crew-checkin__reaction-task')).toBeNull()
    expect(onSubmit).not.toHaveBeenCalled()

    await advance(15000)
    await pressSpace()
    await flush()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(text(view.container)).not.toContain('Reaction check complete')
  })

  it('unmounts mid-measurement without submitting', async () => {
    const onSubmit = vi.fn<CheckInProps['onSubmit']>(async () => okResponse())
    view = await render(<CrewCheckIn {...crewProps([START_ACTION, REVIEW_ACTION], { onSubmit })} />)

    await click(buttonByText(view.container, 'Run reaction check'))
    await click(buttonByText(view.container, 'Start practice'))
    await waitForStimulus(view.container)

    view.unmount()
    view = null

    await advance(15000)
    await pressSpace()
    await flush()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('check-in form component lifecycle', () => {
  it('omits blank optional fields, keeps zero, and displays a 422 with an identical retry', async () => {
    const onSubmit = vi
      .fn<CheckInProps['onSubmit']>()
      .mockRejectedValueOnce(new Error('Invalid check-in (422): sample value rejected'))
      .mockResolvedValueOnce(okResponse())
    view = await render(<CrewCheckIn {...crewProps([START_ACTION, REVIEW_ACTION], { onSubmit })} />)

    await type(view.container.querySelector<HTMLInputElement>('#checkin-fatigue')!, '0')
    await click(buttonByText(view.container, 'Submit check-in'))
    await flush()

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const failedPayload = onSubmit.mock.calls[0][0]
    expect(failedPayload.entries).toEqual([
      { source_id: 'crew_self_report', metric: 'fatigue', value: 0, unit: 'score_0_10' },
    ])
    expect(text(view.container)).toContain('Invalid check-in (422): sample value rejected')

    await click(buttonByText(view.container, 'Retry submission'))
    await flush()
    expect(onSubmit).toHaveBeenCalledTimes(2)
    expect(onSubmit.mock.calls[1][0]).toEqual(failedPayload)
    expect(text(view.container)).toContain('Check-in submitted')
  })

  it('blocks invalid input before any request and sends a kept zero after correction', async () => {
    const onSubmit = vi.fn<CheckInProps['onSubmit']>(async () => okResponse())
    view = await render(<CrewCheckIn {...crewProps([START_ACTION, REVIEW_ACTION], { onSubmit })} />)

    await type(view.container.querySelector<HTMLInputElement>('#checkin-sleep')!, '2000')
    expect(text(view.container)).toContain('Enter sleep duration as a number from 0 to 1440')
    const blocked = buttonByText(view.container, 'Submit check-in')
    expect(blocked.disabled).toBe(true)
    await click(blocked)
    expect(onSubmit).not.toHaveBeenCalled()

    await type(view.container.querySelector<HTMLInputElement>('#checkin-sleep')!, '0')
    await click(buttonByText(view.container, 'Submit check-in'))
    await flush()
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0].entries).toEqual([
      { source_id: 'crew_sleep_log', metric: 'sleep_duration', value: 0, unit: 'min' },
    ])
  })

  it('sends one request while the check-in is pending', async () => {
    const pending = deferred<SubmissionResponse>()
    const onSubmit = vi.fn(() => pending.promise)
    view = await render(<CrewCheckIn {...crewProps([START_ACTION, REVIEW_ACTION], { onSubmit })} />)

    await type(view.container.querySelector<HTMLInputElement>('#checkin-sleep')!, '400')
    await click(buttonByText(view.container, 'Submit check-in'))

    const disabled = buttonByText(view.container, 'Submit check-in')
    expect(disabled.disabled).toBe(true)
    await click(disabled)
    expect(onSubmit).toHaveBeenCalledTimes(1)

    pending.resolve(okResponse())
    await flush()
    expect(text(view.container)).toContain('Check-in submitted')
  })

  it('uses a new submission id after an edit following a rejection', async () => {
    const onSubmit = vi
      .fn<CheckInProps['onSubmit']>()
      .mockRejectedValueOnce(new Error('Server unavailable'))
      .mockResolvedValueOnce(okResponse())
    view = await render(<CrewCheckIn {...crewProps([START_ACTION, REVIEW_ACTION], { onSubmit })} />)

    const sleep = view.container.querySelector<HTMLInputElement>('#checkin-sleep')!
    await type(sleep, '400')
    await click(buttonByText(view.container, 'Submit check-in'))
    await flush()
    const firstId = onSubmit.mock.calls[0][0].submission_id

    await type(sleep, '401')
    await click(buttonByText(view.container, 'Submit check-in'))
    await flush()

    expect(onSubmit).toHaveBeenCalledTimes(2)
    const second = onSubmit.mock.calls[1][0]
    expect(second.submission_id).not.toBe(firstId)
    expect(second.entries).toEqual([
      { source_id: 'crew_sleep_log', metric: 'sleep_duration', value: 401, unit: 'min' },
    ])
  })

  it('shows the missing-action fallback and starts only after availability returns', async () => {
    const onSubmit = vi.fn<CheckInProps['onSubmit']>(async () => okResponse())
    const onAction = vi.fn()
    view = await render(
      <CrewCheckIn
        {...crewProps([REVIEW_ACTION], { onSubmit, onAction })}
      />,
    )

    expect(text(view.container)).toContain('Reaction check unavailable')
    expect(() => buttonByText(view!.container, 'Run reaction check')).toThrow()
    await click(buttonByText(view.container, 'Review available inputs'))
    expect(onAction).toHaveBeenCalledWith('review_available_inputs')
    expect(text(view.container)).not.toContain('Local reaction check')

    await view.rerender(
      <CrewCheckIn
        {...crewProps([START_ACTION, REVIEW_ACTION], { onSubmit, onAction })}
      />,
    )
    await click(buttonByText(view.container, 'Run reaction check'))
    expect(text(view.container)).toContain('Local reaction check')
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
