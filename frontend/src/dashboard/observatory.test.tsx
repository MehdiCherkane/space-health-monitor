// @vitest-environment jsdom
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CheckInProps, StateEnvelope } from '../api/types'
import { CrewCheckIn } from '../checkin/CrewCheckIn'
import gallery from '../gallery/states.json'
import { buttonByText, click, render, text, type Rendered } from '../test/dom'
import { GalaxyBackground, useAmbientMotion } from './GalaxyBackground'
import { HistoryPlot } from './HistoryPlot'
import { ObservatoryScene } from './ObservatoryScene'

const states = gallery as { id: string; state: StateEnvelope }[]
const crew = states.find((item) => item.id === 'state-8')!.state
const radlab = states.find((item) => item.id === 'state-1')!.state
let view: Rendered | null = null
afterEach(() => { view?.unmount(); view = null; vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('observatory presentation and navigation', () => {
  it('changes all four anatomy views without changing data or invoking an action', async () => {
    const onAction = vi.fn(), onSelectSource = vi.fn(), onOpenEvidence = vi.fn()
    const original = JSON.stringify(crew)
    view = await render(<ObservatoryScene state={crew} selectedSource="crew_sleep_log" onAction={onAction} onSelectSource={onSelectSource} onOpenEvidence={onOpenEvidence} />)
    const label = () => view!.container.querySelector('[role="img"]')!.getAttribute('aria-label') ?? ''
    expect(label()).toContain('male hologram figure, front view')
    await click(buttonByText(view.container, 'Back'))
    expect(label()).toContain('male hologram figure, back view')
    await click(buttonByText(view.container, 'Female'))
    expect(label()).toContain('female hologram figure, back view')
    await click(buttonByText(view.container, 'Front'))
    expect(label()).toContain('female hologram figure, front view')
    expect(buttonByText(view.container, 'Female').getAttribute('aria-pressed')).toBe('true')
    expect(JSON.stringify(crew)).toBe(original)
    expect(onAction).not.toHaveBeenCalled()
    expect(onSelectSource).not.toHaveBeenCalled()
    await click(buttonByText(view.container, 'Sleep history'))
    expect(onSelectSource).toHaveBeenCalledWith('crew_sleep_log')
    await click(buttonByText(view.container, 'Why evidence'))
    expect(onOpenEvidence).toHaveBeenCalledOnce()
  })

  it('keeps detector data off the body and exposes returned instrument states', async () => {
    const onSelectSource = vi.fn()
    view = await render(<ObservatoryScene state={radlab} selectedSource="DosTel1" onAction={vi.fn()} onSelectSource={onSelectSource} onOpenEvidence={vi.fn()} />)
    expect(view.container.querySelector('.anatomy')).toBeNull()
    expect(text(view.container)).toContain('Historical cabin measurements — not personal exposure.')
    expect(text(view.container.querySelector('.detector__sources'))).not.toContain('current')
    const detector = buttonByText(view.container, 'DosTel1')
    expect(detector.querySelector('.detector__node-key')?.getAttribute('data-state')).toBe('stale')
    await click(buttonByText(view.container, 'DosTel2'))
    expect(onSelectSource).toHaveBeenCalledWith('DosTel2')
  })

  it('plots a real zero as one dot and never fills empty history', async () => {
    view = await render(<HistoryPlot observations={[]} />)
    expect(view.container.querySelector('svg')).toBeNull()
    const zero = { ...radlab.observations[0], value: 0 }
    await view.rerender(<HistoryPlot observations={[zero]} />)
    const dots = view.container.querySelectorAll('.history-plot__point')
    expect(dots).toHaveLength(1)
    expect(dots[0].getAttribute('aria-label')).toContain('0 µGy/h')
    expect(dots[0].getAttribute('cy')).not.toContain('NaN')
    expect(view.container.querySelector('.history-plot__line')).toBeNull()
    expect(view.container.querySelector('.history-plot__area')).toBeNull()
    expect(text(view.container)).toContain('Single recorded reading')
  })

  it('draws line and area plus a returned baseline band with focusable point details', async () => {
    const rows = [
      { ...radlab.observations[0], id: 'a', value: 380, unit: 'min', observed_at: '2026-01-08T07:00:00Z' },
      { ...radlab.observations[0], id: 'b', value: 420, unit: 'min', observed_at: '2026-01-10T07:00:00Z' },
    ]
    view = await render(
      <HistoryPlot observations={rows} band={{ min: 440, max: 460, label: 'Returned demo baseline range' }} />,
    )
    expect(view.container.querySelector('.history-plot__line')).not.toBeNull()
    expect(view.container.querySelector('.history-plot__area')).not.toBeNull()
    expect(view.container.querySelector('.history-plot__band')).not.toBeNull()
    expect(text(view.container)).toContain('Returned demo baseline range')

    const point = view.container.querySelector('.history-plot__point') as SVGElement
    await act(async () => {
      point.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    })
    expect(view.container.querySelector('.history-plot__tooltip')).not.toBeNull()
  })

  it('does not combine different units in one chart', async () => {
    view = await render(<HistoryPlot observations={[radlab.observations[0], { ...radlab.observations[0], id: 'different', unit: 'ms' }]} />)
    expect(view.container.querySelector('svg')).toBeNull()
    expect(text(view.container)).toContain('Different units are shown separately in the table.')
  })
})

function MotionHarness({ measuring = false }: { measuring?: boolean }) {
  const motion = useAmbientMotion(measuring)
  return <><GalaxyBackground paused={motion.paused} /><button disabled={motion.locked} onClick={motion.toggle}>{motion.label}</button></>
}

describe('ambient motion has priority below measurement and accessibility', () => {
  it('preserves an explicit pause through measurement, cancellation and document visibility changes', async () => {
    let hidden = false
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
    view = await render(<MotionHarness />)
    const paused = () => view!.container.querySelector('#galaxy')!.getAttribute('data-paused')
    expect(paused()).toBe('false')
    await click(buttonByText(view.container, 'Pause motion'))
    await view.rerender(<MotionHarness measuring />)
    expect(paused()).toBe('true')
    expect(buttonByText(view.container, 'Motion paused for check').disabled).toBe(true)
    await view.rerender(<MotionHarness />)
    expect(paused()).toBe('true')
    await click(buttonByText(view.container, 'Resume motion'))
    expect(paused()).toBe('false')
    await act(async () => { hidden = true; document.dispatchEvent(new Event('visibilitychange')) })
    expect(paused()).toBe('true')
    await act(async () => { hidden = false; document.dispatchEvent(new Event('visibilitychange')) })
    expect(paused()).toBe('false')
  })

  it('responds to the reduced-motion preference and removes its listener on unmount', async () => {
    let listener: (() => void) | undefined
    const query = { matches: true, addEventListener: vi.fn((_name, callback) => { listener = callback }), removeEventListener: vi.fn() }
    vi.stubGlobal('matchMedia', vi.fn(() => query))
    view = await render(<MotionHarness />)
    expect(buttonByText(view.container, 'Reduced motion').disabled).toBe(true)
    expect(view.container.querySelector('#galaxy')!.getAttribute('data-paused')).toBe('true')
    await act(async () => { query.matches = false; listener?.() })
    expect(view.container.querySelector('#galaxy')!.getAttribute('data-paused')).toBe('false')
    view.unmount(); view = null
    expect(query.removeEventListener).toHaveBeenCalledWith('change', listener)
  })

  it('reports task start, cancellation, withdrawal and unmount so the shell never keeps animating during a task', async () => {
    const onTaskActiveChange = vi.fn()
    const props: CheckInProps = {
      run: { run_id: 'test', scenario_id: 'sleep_vigilance', initial_as_of: crew.as_of, range_start: crew.as_of, range_end: crew.as_of },
      scenarioId: 'sleep_vigilance', missionTime: crew.as_of, actions: crew.actions,
      onSubmit: vi.fn(), onAction: vi.fn(),
    }
    view = await render(<CrewCheckIn {...props} onTaskActiveChange={onTaskActiveChange} />)
    expect(onTaskActiveChange).toHaveBeenLastCalledWith(false)
    await click(buttonByText(view.container, 'Run reaction check'))
    expect(onTaskActiveChange).toHaveBeenLastCalledWith(true)
    await click(buttonByText(view.container, 'Cancel reaction check'))
    expect(onTaskActiveChange).toHaveBeenLastCalledWith(false)
    await click(buttonByText(view.container, 'Run reaction check'))
    await view.rerender(<CrewCheckIn {...props} actions={[]} onTaskActiveChange={onTaskActiveChange} />)
    expect(onTaskActiveChange).toHaveBeenLastCalledWith(false)
    await view.rerender(<CrewCheckIn {...props} onTaskActiveChange={onTaskActiveChange} />)
    await click(buttonByText(view.container, 'Run reaction check'))
    view.unmount(); view = null
    expect(onTaskActiveChange).toHaveBeenLastCalledWith(false)
    expect(props.onSubmit).not.toHaveBeenCalled()
  })
})
