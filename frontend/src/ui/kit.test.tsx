// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Action, Observation, SourceStatus } from '../api/types'
import { buttonByText, click, render, text, type Rendered } from '../test/dom'
import { Drawer } from './Drawer'
import { formatAge, formatNumber } from './format'
import { ActionButton, EvidenceList, ProvenanceBadge, SourceCard } from './kit'

let view: Rendered | null = null
afterEach(() => {
  view?.unmount()
  view = null
})

const reading: Observation = {
  id: 'd2-232000',
  subject_id: null,
  metric: 'absorbed_dose_rate',
  value: 2.211496,
  unit: 'µGy/h',
  observed_at: '2022-04-01T23:20:00Z',
  source_id: 'DosTel2',
  provenance: 'REAL_HISTORICAL',
  source_timestamp: '2022-04-01T23:20:00',
}

function source(overrides: Partial<SourceStatus>): SourceStatus {
  return {
    source_id: 'DosTel2',
    metric: 'absorbed_dose_rate',
    state: 'current',
    last_observation_id: 'd2-232000',
    age_seconds: 0,
    reason_code: 'within_demo_window',
    ...overrides,
  }
}

describe('formatAge', () => {
  it('shows zero, keeps exact seconds and returns null for no reading', () => {
    expect(formatAge(0)).toBe('0 s')
    expect(formatAge(455)).toBe('455 s · 7 min 35 s')
    expect(formatAge(7200)).toBe('7200 s · 2 h 0 min')
    expect(formatAge(null)).toBeNull()
  })
})

describe('formatNumber', () => {
  it('keeps readable compact values while trimming runaway floating-point tails', () => {
    expect(formatNumber(1.65945)).toBe('1.65945')
    expect(formatNumber(2.211496)).toBe('2.211496')
    expect(formatNumber(6.025896666666667)).toBe('6.025897')
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(310)).toBe('310')
  })
})

describe('SourceCard', () => {
  it('displays age 0 explicitly with the reading and provenance', async () => {
    view = await render(<SourceCard source={source({})} lastObservation={reading} />)
    const card = text(view.container)
    expect(card).toContain('Age0 s')
    expect(card).toContain('2.211496 µGy/h')
    expect(card).toContain('Historical NASA telemetry')
  })

  it('shows No reading and no age when there is no observation', async () => {
    view = await render(
      <SourceCard
        source={source({
          state: 'missing',
          last_observation_id: null,
          age_seconds: null,
          reason_code: 'no_eligible_observation',
        })}
        lastObservation={undefined}
      />,
    )
    expect(text(view.container)).toContain('No reading')
    expect(text(view.container)).not.toMatch(/Age|\d+ s/)
    // Contract meaning shown in words, with the engine code kept alongside.
    expect(text(view.container)).toContain('No visible reading for this detector')
    expect(text(view.container)).toContain('no_eligible_observation')
  })

  it('reports a referenced observation that was not returned', async () => {
    view = await render(
      <SourceCard source={source({ last_observation_id: 'gone' })} lastObservation={undefined} />,
    )
    expect(text(view.container)).toContain('Evidence unavailable')
    expect(text(view.container)).toContain('gone')
  })
})

describe('EvidenceList', () => {
  it('joins by ID regardless of array order and flags missing references', async () => {
    const other: Observation = { ...reading, id: 'd1-231225', source_id: 'DosTel1', value: 1.65945 }
    const observations = new Map([other, reading].map((row) => [row.id, row]))
    view = await render(
      <EvidenceList
        items={[{ code: 'c', detail: 'detail', observation_ids: ['d2-232000', 'missing-id'] }]}
        observations={observations}
        emptyText="none"
      />,
    )
    const rows = view.container.querySelectorAll('.ui-obs')
    expect(text(rows[0])).toContain('DosTel2')
    expect(text(rows[0])).toContain('2.211496')
    expect(text(rows[1])).toContain('Evidence unavailable')
    expect(text(rows[1])).toContain('missing-id')
  })

  it('renders the empty text when nothing is returned', async () => {
    view = await render(<EvidenceList items={[]} observations={new Map()} emptyText="None here." />)
    expect(text(view.container)).toBe('None here.')
  })
})

describe('ActionButton', () => {
  it('keeps an unavailable action visible, disabled, with the supplied reason', async () => {
    const action: Action = {
      id: 'start_reaction_check',
      label: 'Run reaction check',
      required_resource_ids: ['local_reaction_task'],
      available: false,
      unavailable_reason: 'Reaction check unavailable',
    }
    const onAction = vi.fn()
    view = await render(<ActionButton action={action} onAction={onAction} />)
    const button = buttonByText(view.container, 'Run reaction check')
    expect(button.disabled).toBe(true)
    const reason = document.getElementById(button.getAttribute('aria-describedby')!)
    expect(text(reason)).toBe('Reaction check unavailable')
    await click(button)
    expect(onAction).not.toHaveBeenCalled()
  })
})

describe('ProvenanceBadge', () => {
  it('uses the three contract labels', async () => {
    view = await render(
      <>
        <ProvenanceBadge provenance="REAL_HISTORICAL" />
        <ProvenanceBadge provenance="SYNTHETIC" />
        <ProvenanceBadge provenance="LIVE_MEASURED" />
      </>,
    )
    const labels = text(view.container)
    expect(labels).toContain('Historical NASA telemetry')
    expect(labels).toContain('Synthetic crew scenario')
    expect(labels).toContain('Recorded on this device')
  })
})

describe('Drawer', () => {
  it('moves focus in on open and returns it to the opener on close', async () => {
    const onClose = vi.fn()
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    view = await render(
      <Drawer open={false} title="Why? Evidence" onClose={onClose}>
        <p>body</p>
      </Drawer>,
    )
    await view.rerender(
      <Drawer open title="Why? Evidence" onClose={onClose}>
        <p>body</p>
      </Drawer>,
    )
    const dialog = view.container.querySelector('dialog')!
    expect(dialog.open).toBe(true)
    expect(document.activeElement?.textContent).toBe('Why? Evidence')

    await click(buttonByText(dialog, 'Close'))
    expect(dialog.open).toBe(false)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })
})
