// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  Checkpoint,
  DashboardProps,
  Observation,
  StateEnvelope,
} from '../api/types'
import gallery from '../gallery/states.json'
import { buttonByText, click, render, text, type Rendered } from '../test/dom'
import { Dashboard } from './Dashboard'

const states = gallery as { id: string; label: string; state: StateEnvelope }[]

function fixture(id: string): StateEnvelope {
  const entry = states.find((item) => item.id === id)
  if (!entry) throw new Error(`Missing gallery fixture ${id}`)
  return structuredClone(entry.state)
}

const EXAMPLE_A = fixture('state-1')
const RECOVERED = fixture('state-4')
const EXAMPLE_B = fixture('state-8')
const WATCH_B = fixture('state-9')
const UNAVAILABLE = fixture('state-12')
const ARTIFICIAL_EDGE = fixture('state-7')
const MISSING_READING = fixture('state-5')

const RADLAB_CHECKPOINTS: Checkpoint[] = [
  { id: '23:20:00', label: '23:20:00', as_of: '2022-04-01T23:20:00Z' },
  { id: '23:30:00', label: '23:30:00', as_of: '2022-04-01T23:30:00Z' },
]

const CREW_CHECKPOINTS: Checkpoint[] = [
  { id: '09:00', label: '09:00', as_of: '2026-01-10T09:00:00Z' },
  { id: '09:01', label: '09:01', as_of: '2026-01-10T09:01:00Z' },
]

function props(overrides: Partial<DashboardProps> = {}): DashboardProps {
  return {
    state: EXAMPLE_A,
    dataMode: 'integrated',
    status: 'ready',
    error: null,
    clock: EXAMPLE_A.as_of,
    scenarioId: 'radlab_stale',
    checkpoints: RADLAB_CHECKPOINTS,
    history: [],
    historyStatus: 'ready',
    historyError: null,
    historySourceId: 'DosTel1',
    evidenceOpen: false,
    onScenarioChange: vi.fn(),
    onSeek: vi.fn(),
    onReset: vi.fn(),
    onRetry: vi.fn(),
    onRetryHistory: vi.fn(),
    onAction: vi.fn(),
    onSelectHistorySource: vi.fn(),
    onOpenEvidence: vi.fn(),
    onCloseEvidence: vi.fn(),
    ...overrides,
  }
}

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

function sourceCard(container: ParentNode, sourceId: string): Element {
  const card = Array.from(container.querySelectorAll('.ui-source')).find((item) =>
    text(item.querySelector('.ui-source__name')) === sourceId,
  )
  if (!card) throw new Error(`No source card ${sourceId}`)
  return card
}

function section(container: ParentNode, heading: string): Element {
  const match = Array.from(container.querySelectorAll('section')).find(
    (item) => text(item.querySelector('h3')) === heading,
  )
  if (!match) throw new Error(`No evidence section ${heading}`)
  return match
}

function why(container: ParentNode): Element {
  const dialog = container.querySelector('dialog')
  if (!dialog) throw new Error('No evidence drawer')
  return dialog
}

describe('Example A rendering', () => {
  it('renders returned source ages, original values, timestamps and provenance', async () => {
    // Deliberately reverse the array: cards and evidence must join observations by ID.
    const reversed = structuredClone(EXAMPLE_A)
    reversed.observations.reverse()
    view = await render(<Dashboard {...props({ state: reversed })} />)

    const stale = sourceCard(view.container, 'DosTel1')
    expect(text(stale)).toContain('stale')
    expect(text(stale)).toContain('455 s · 7 min 35 s')
    expect(text(stale)).toContain('1.65945 µGy/h')
    expect(text(stale)).toContain('2022-04-01 23:12:25 UTC')
    expect(text(stale)).toContain('2022-04-01T23:12:25')
    expect(text(stale)).toContain('Historical NASA telemetry')

    const current = sourceCard(view.container, 'DosTel2')
    expect(text(current)).toContain('current')
    expect(text(current)).toContain('0 s')
    expect(text(current)).toContain('2.211496 µGy/h')
    expect(text(current)).toContain('2022-04-01 23:20:00 UTC')
    expect(text(current)).toContain('Historical NASA telemetry')

    expect(text(view.container.querySelector('.ui-assessment__title'))).toBe(
      'DosTel1 stale · DosTel2 current',
    )
    expect(text(view.container.querySelector('.ui-assessment .ui-rule'))).toBe(
      'SOURCE_FRESHNESS@1',
    )

    const incident = view.container.querySelector('.ui-incident')!
    expect(text(incident)).toContain('open')
    expect(text(incident)).toContain('Opened 2022-04-01 23:17:26 UTC')
    expect(text(incident)).toContain('Not closed yet')
    expect(text(incident)).toContain('Last reading before gap d1-231225')
  })

  it('shows no invented age when a configured source has no reading', async () => {
    view = await render(
      <Dashboard
        {...props({
          state: MISSING_READING,
          clock: MISSING_READING.as_of,
          historySourceId: 'DosTel1',
        })}
      />,
    )

    const missing = sourceCard(view.container, 'DosTel1')
    expect(text(missing)).toContain('No reading')
    expect(text(missing)).toContain('No visible reading for this detector')
    expect(text(missing)).not.toMatch(/Age|\b\d+ s\b/)
    expect(text(sourceCard(view.container, 'DosTel2'))).toContain('0 s')
  })
})

describe('Why evidence rendering', () => {
  it('joins RadLab evidence by observation ID and renders returned details', async () => {
    view = await render(<Dashboard {...props({ evidenceOpen: true })} />)

    const drawer = why(view.container)
    expect(text(drawer)).toContain('DosTel1 last reported 7 min 35 s ago.')
    expect(text(drawer)).toContain('DosTel2 reported at the current replay time.')
    expect(text(drawer)).toContain('d1-231225')
    expect(text(drawer)).toContain('1.65945 µGy/h')
    expect(text(drawer)).toContain('d2-232000')
    expect(text(drawer)).toContain('2.211496 µGy/h')
    expect(text(drawer)).not.toContain('Evidence unavailable')
  })

  it('renders the seeded sleep baseline and a genuinely missing reaction input', async () => {
    view = await render(
      <Dashboard
        {...props({
          state: EXAMPLE_B,
          clock: EXAMPLE_B.as_of,
          scenarioId: 'sleep_vigilance',
          checkpoints: CREW_CHECKPOINTS,
          historySourceId: 'crew_sleep_log',
          evidenceOpen: true,
        })}
      />,
    )

    const supporting = section(why(view.container), 'Supporting evidence')
    expect(text(supporting)).toContain('crew-demo-sleep-v1')
    expect(text(supporting)).toContain('380 min')
    expect(text(supporting)).toContain('370 min')
    expect(text(supporting)).toContain('420 min')
    expect(text(supporting)).toContain('450 min')
    expect(text(supporting)).toContain('Two of the last three logged nights')

    const missing = section(why(view.container), 'Missing inputs')
    expect(text(missing)).toContain('Reaction time')
    expect(text(missing)).toContain('reaction_time')

    // Missing is not zero: the reaction source has no reading and no age.
    const reaction = sourceCard(view.container, 'reaction_task')
    expect(text(reaction)).toContain('No reading')
    expect(text(reaction)).not.toMatch(/Age|\b\d+ s\b/)
  })

  it('renders the 09:01 watch comparison and resolves every referenced baseline ID', async () => {
    view = await render(
      <Dashboard
        {...props({
          state: WATCH_B,
          clock: WATCH_B.as_of,
          scenarioId: 'sleep_vigilance',
          checkpoints: CREW_CHECKPOINTS,
          historySourceId: 'crew_sleep_log',
          evidenceOpen: true,
        })}
      />,
    )

    expect(text(view.container.querySelector('.ui-assessment__title'))).toBe(
      'Sleep and vigilance change',
    )
    const drawer = why(view.container)
    expect(text(drawer)).toContain('310 ms')
    expect(text(drawer)).toContain('250 ms')
    expect(text(drawer)).toContain('crew-demo-reaction-v1')
    expect(text(drawer)).toContain('reaction-10')
    expect(text(drawer)).toContain('base-reaction-5')
    expect(text(drawer)).not.toContain('Evidence unavailable')
  })

  it('keeps supporting, conflicting and missing evidence separate for an artificial edge fixture', async () => {
    // The gallery state-7 entry is explicitly hand-edited, not engine output. It only
    // exercises rendering of a reserved conflict state and a deliberately absent ID.
    view = await render(
      <Dashboard
        {...props({
          state: ARTIFICIAL_EDGE,
          clock: ARTIFICIAL_EDGE.as_of,
          evidenceOpen: true,
        })}
      />,
    )

    const drawer = why(view.container)
    expect(text(section(drawer, 'Supporting evidence'))).toContain(
      'DosTel1 last reported 7 min 35 s ago.',
    )
    expect(text(section(drawer, 'Supporting evidence'))).not.toContain(
      'Placeholder conflicting entry',
    )
    expect(text(section(drawer, 'Conflicting evidence'))).toContain(
      'Placeholder conflicting entry',
    )
    expect(text(section(drawer, 'Missing inputs'))).toContain(
      'No missing inputs returned.',
    )

    const unavailable = section(drawer, 'Supporting evidence').querySelector('.ui-obs--missing')!
    expect(text(unavailable)).toContain('Evidence unavailable')
    expect(text(unavailable)).toContain('d1-not-returned')
  })
})

describe('incident history', () => {
  it('renders one stable incident open, then resolved, and removes closure on rewind', async () => {
    const open = structuredClone(EXAMPLE_A)
    const resolved = structuredClone(EXAMPLE_A)
    resolved.as_of = '2022-04-01T23:30:00Z'
    resolved.sources = RECOVERED.sources
    resolved.observations = RECOVERED.observations
    // Keep the same incident ID so this proves one row changes state, not a replacement.
    resolved.incidents = [
      {
        ...open.incidents[0],
        state: 'resolved',
        closed_at: '2022-04-01T23:29:00Z',
      },
    ]

    view = await render(<Dashboard {...props({ state: open })} />)
    let rows = view.container.querySelectorAll('.ui-incident')
    expect(rows).toHaveLength(1)
    expect(text(rows[0])).toContain('open')
    expect(text(rows[0])).toContain('Not closed yet')

    await view.rerender(<Dashboard {...props({ state: resolved, clock: resolved.as_of })} />)
    rows = view.container.querySelectorAll('.ui-incident')
    expect(rows).toHaveLength(1)
    expect(text(rows[0])).toContain('resolved')
    expect(text(rows[0])).toContain('Closed 2022-04-01 23:29:00 UTC')

    await view.rerender(<Dashboard {...props({ state: open })} />)
    rows = view.container.querySelectorAll('.ui-incident')
    expect(rows).toHaveLength(1)
    expect(text(rows[0])).toContain('open')
    expect(text(rows[0])).toContain('Not closed yet')
    expect(text(view.container)).not.toContain('Closed 2022-04-01 23:29:00 UTC')
    expect(text(view.container)).not.toContain('2022-04-01 23:29:00 UTC')
  })
})

describe('actions', () => {
  it('routes an available action to its parent action ID', async () => {
    const onAction = vi.fn()
    view = await render(<Dashboard {...props({ onAction })} />)

    await click(buttonByText(view.container, 'Review source history'))
    expect(onAction).toHaveBeenCalledWith('view_source_history')
  })

  it('keeps an unavailable action visible with its reason and routes the fallback', async () => {
    const onAction = vi.fn()
    view = await render(
      <Dashboard
        {...props({
          state: UNAVAILABLE,
          clock: UNAVAILABLE.as_of,
          scenarioId: 'sleep_vigilance',
          checkpoints: CREW_CHECKPOINTS,
          historySourceId: 'crew_sleep_log',
          onAction,
        })}
      />,
    )

    const unavailable = buttonByText(view.container, 'Run reaction check')
    expect(unavailable.disabled).toBe(true)
    const reasonId = unavailable.getAttribute('aria-describedby')
    expect(reasonId).not.toBeNull()
    expect(text(view.container.querySelector(`#${reasonId}`))).toBe(
      'Reaction check unavailable',
    )
    await click(unavailable)
    expect(onAction).not.toHaveBeenCalled()

    const fallback = buttonByText(view.container, 'Review available inputs')
    expect(fallback.disabled).toBe(false)
    await click(fallback)
    expect(onAction).toHaveBeenCalledWith('review_available_inputs')
  })

  it('routes Why? and Close to the parent-owned evidence drawer', async () => {
    const onOpenEvidence = vi.fn()
    const onCloseEvidence = vi.fn()
    view = await render(<Dashboard {...props({ onOpenEvidence, onCloseEvidence })} />)

    await click(buttonByText(view.container, 'Why?'))
    expect(onOpenEvidence).toHaveBeenCalledTimes(1)

    await view.rerender(
      <Dashboard
        {...props({ onOpenEvidence, onCloseEvidence, evidenceOpen: true })}
      />,
    )
    await click(buttonByText(why(view.container), 'Close'))
    expect(onCloseEvidence).toHaveBeenCalledTimes(1)
  })
})

describe('replay controls', () => {
  it('invokes parent scenario, checkpoint and reset callbacks without a local clock', async () => {
    const onScenarioChange = vi.fn()
    const onSeek = vi.fn()
    const onReset = vi.fn()
    view = await render(
      <Dashboard {...props({ onScenarioChange, onSeek, onReset })} />,
    )

    await click(buttonByText(view.container, 'Sleep and vigilance'))
    expect(onScenarioChange).toHaveBeenCalledWith('sleep_vigilance')

    await click(buttonByText(view.container, '23:30:00'))
    expect(onSeek).toHaveBeenCalledWith('2022-04-01T23:30:00Z')

    await click(buttonByText(view.container, 'Fresh run'))
    expect(onReset).toHaveBeenCalledTimes(1)

    // The component never advances its own clock; the prop stays authoritative.
    expect(text(view.container.querySelector('.dash-clock'))).toBe(
      '2022-04-01 23:20:00 UTC',
    )
  })

  it('marks the fixture preview as fixed and disables replay checkpoints', async () => {
    view = await render(
      <Dashboard {...props({ dataMode: 'fixture-preview', status: 'ready' })} />,
    )

    expect(text(view.container)).toContain('Fixture preview')
    expect(text(view.container)).toContain('fixed snapshot')
    expect(buttonByText(view.container, '23:30:00').disabled).toBe(true)
    expect(text(view.container.querySelector('.dash-hint'))).toContain(
      'Replay is off for the fixed preview snapshot.',
    )
  })
})

describe('source history', () => {
  const history: Observation[] = [
    {
      ...EXAMPLE_A.observations[0],
      id: 'd1-231225',
      observed_at: '2022-04-01T23:12:25Z',
    },
    {
      ...EXAMPLE_A.observations[1],
      id: 'd2-232000',
      observed_at: '2022-04-01T23:20:00Z',
    },
  ]

  it('renders shell-provided history and asks the parent when a source changes', async () => {
    const onSelectHistorySource = vi.fn()
    view = await render(
      <Dashboard
        {...props({
          history,
          historyStatus: 'ready',
          historySourceId: 'DosTel1',
          onSelectHistorySource,
        })}
      />,
    )

    const rows = view.container.querySelectorAll('.ui-table tbody tr')
    expect(rows).toHaveLength(2)
    expect(text(rows[0])).toContain('2022-04-01 23:12:25 UTC')
    expect(text(rows[0])).toContain('1.65945 µGy/h')
    expect(text(rows[0])).toContain('Historical NASA telemetry')
    expect(text(rows[1])).toContain('2022-04-01 23:20:00 UTC')
    expect(text(rows[1])).toContain('2.211496 µGy/h')

    const tabs = view.container.querySelector('.dash-history-tabs')!
    await click(buttonByText(tabs, 'DosTel2'))
    expect(onSelectHistorySource).toHaveBeenCalledWith('DosTel2')

    await click(buttonByText(sourceCard(view.container, 'DosTel1'), 'History'))
    expect(onSelectHistorySource).toHaveBeenCalledWith('DosTel1')
  })

  it('renders history failure with a parent-owned retry', async () => {
    const onRetryHistory = vi.fn()
    view = await render(
      <Dashboard
        {...props({
          history: [],
          historyStatus: 'error',
          historyError: 'History request failed',
          onRetryHistory,
        })}
      />,
    )

    const alert = view.container.querySelector('.dash-side [role="alert"]')
    expect(text(alert)).toContain('History request failed')
    const retry = buttonByText(alert!, 'Retry')
    await click(retry)
    expect(onRetryHistory).toHaveBeenCalledTimes(1)
  })
})

describe('loading and empty feature states', () => {
  it('shows the requested clock while loading and a retryable error with no state', async () => {
    const onRetry = vi.fn()
    view = await render(
      <Dashboard
        {...props({ state: null, status: 'loading', clock: '2022-04-01T23:20:00Z' })}
      />,
    )
    expect(text(view.container.querySelector('[role="status"]'))).toContain(
      'Loading state at 2022-04-01 23:20:00 UTC',
    )
    expect(view.container.querySelector('.ui-assessment')).toBeNull()

    await view.rerender(
      <Dashboard
        {...props({
          state: null,
          status: 'error',
          error: 'Internal Server Error',
          clock: '2022-04-01T23:20:00Z',
          onRetry,
        })}
      />,
    )
    const alert = view.container.querySelector('[role="alert"]')
    expect(text(alert)).toContain('Internal Server Error')
    expect(text(alert)).toContain('No state is shown for 2022-04-01 23:20:00 UTC')
    await click(buttonByText(alert!, 'Retry'))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(view.container.querySelector('.ui-assessment')).toBeNull()
  })

  it('renders explicit empty assessment and source messages', async () => {
    const empty = structuredClone(EXAMPLE_A)
    empty.assessments = []
    empty.sources = []
    empty.observations = []
    empty.actions = []
    empty.incidents = []
    view = await render(<Dashboard {...props({ state: empty })} />)

    const featureText = text(view.container.querySelector('.dash-main'))
    expect(featureText).toContain('No assessment was returned for this time.')
    expect(featureText).toContain('No sources were returned.')
    expect(text(view.container.querySelector('.dash-side'))).toContain(
      'No incidents at this time.',
    )
  })
})
