// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { StateEnvelope } from '../api/types'
import gallery from '../gallery/states.json'
import { buttonByText, click, render, text, type Rendered } from '../test/dom'
import {
  EvidenceStatusPanel,
  buildEvidenceStatus,
  describeAge,
  type EvidenceStatusPanelProps,
} from '.'

const states = gallery as { id: string; label: string; state: StateEnvelope }[]

function fixture(id: string): StateEnvelope {
  const entry = states.find((item) => item.id === id)
  if (!entry) throw new Error(`Missing gallery fixture ${id}`)
  return structuredClone(entry.state)
}

// Canonical gallery entries. State-7 is the explicitly hand-edited edge fixture;
// any other clone below is a named variant built from a canonical state.
const EXAMPLE_A = fixture('state-1')
const RECOVERED = fixture('state-4')
const MISSING_READING = fixture('state-5')
const INVALID_READING = fixture('state-6')
const ARTIFICIAL_EDGE = fixture('state-7')
const EXAMPLE_B = fixture('state-8')
const WATCH_B = fixture('state-9')
const OBSERVED_B = fixture('state-10')
const INCOMPARABLE_B = fixture('state-11')
const UNAVAILABLE = fixture('state-12')

// Actual engine output captured for this regression. It was produced with
// backend.engine.evaluate("sleep_vigilance", "review-invalid-sleep", "2026-01-10T09:01:00Z",
// rows, resources, policy) where rows are fixtures/crew/sleep-vigilance.json with
// sleep-09 value set to -1, resources = rules/demo-v1.json resources, and policy =
// rules/demo-v1.json. No field is hand-edited below.
const INVALID_SLEEP_ENGINE_OUTPUT: StateEnvelope = {
  "schema_version": 1,
  "run_id": "review-invalid-sleep",
  "scenario_id": "sleep_vigilance",
  "as_of": "2026-01-10T09:01:00Z",
  "sources": [
    {
      "source_id": "crew_sleep_log",
      "metric": "sleep_duration",
      "state": "invalid",
      "last_observation_id": "sleep-09",
      "age_seconds": 93660,
      "reason_code": "invalid_observation"
    },
    {
      "source_id": "reaction_task",
      "metric": "reaction_time",
      "state": "current",
      "last_observation_id": "reaction-10",
      "age_seconds": 0,
      "reason_code": "scheduled_input_received"
    }
  ],
  "observations": [
    {
      "id": "base-sleep-1",
      "subject_id": "crew-demo-1",
      "metric": "sleep_duration",
      "value": 450,
      "unit": "min",
      "observed_at": "2026-01-01T07:00:00Z",
      "source_id": "crew_sleep_log",
      "provenance": "SYNTHETIC"
    },
    {
      "id": "base-reaction-1",
      "subject_id": "crew-demo-1",
      "metric": "reaction_time",
      "value": 245,
      "unit": "ms",
      "observed_at": "2026-01-01T09:00:00Z",
      "source_id": "reaction_task",
      "provenance": "SYNTHETIC",
      "metadata": {
        "task_version": "demo-rt-v1",
        "input_profile": "seeded-demo",
        "trial_count": 5,
        "false_starts": 0,
        "completed": true
      }
    },
    {
      "id": "base-sleep-2",
      "subject_id": "crew-demo-1",
      "metric": "sleep_duration",
      "value": 440,
      "unit": "min",
      "observed_at": "2026-01-02T07:00:00Z",
      "source_id": "crew_sleep_log",
      "provenance": "SYNTHETIC"
    },
    {
      "id": "base-reaction-2",
      "subject_id": "crew-demo-1",
      "metric": "reaction_time",
      "value": 250,
      "unit": "ms",
      "observed_at": "2026-01-02T09:00:00Z",
      "source_id": "reaction_task",
      "provenance": "SYNTHETIC",
      "metadata": {
        "task_version": "demo-rt-v1",
        "input_profile": "seeded-demo",
        "trial_count": 5,
        "false_starts": 0,
        "completed": true
      }
    },
    {
      "id": "base-sleep-3",
      "subject_id": "crew-demo-1",
      "metric": "sleep_duration",
      "value": 450,
      "unit": "min",
      "observed_at": "2026-01-03T07:00:00Z",
      "source_id": "crew_sleep_log",
      "provenance": "SYNTHETIC"
    },
    {
      "id": "base-reaction-3",
      "subject_id": "crew-demo-1",
      "metric": "reaction_time",
      "value": 255,
      "unit": "ms",
      "observed_at": "2026-01-03T09:00:00Z",
      "source_id": "reaction_task",
      "provenance": "SYNTHETIC",
      "metadata": {
        "task_version": "demo-rt-v1",
        "input_profile": "seeded-demo",
        "trial_count": 5,
        "false_starts": 0,
        "completed": true
      }
    },
    {
      "id": "base-sleep-4",
      "subject_id": "crew-demo-1",
      "metric": "sleep_duration",
      "value": 460,
      "unit": "min",
      "observed_at": "2026-01-04T07:00:00Z",
      "source_id": "crew_sleep_log",
      "provenance": "SYNTHETIC"
    },
    {
      "id": "base-reaction-4",
      "subject_id": "crew-demo-1",
      "metric": "reaction_time",
      "value": 248,
      "unit": "ms",
      "observed_at": "2026-01-04T09:00:00Z",
      "source_id": "reaction_task",
      "provenance": "SYNTHETIC",
      "metadata": {
        "task_version": "demo-rt-v1",
        "input_profile": "seeded-demo",
        "trial_count": 5,
        "false_starts": 0,
        "completed": true
      }
    },
    {
      "id": "base-sleep-5",
      "subject_id": "crew-demo-1",
      "metric": "sleep_duration",
      "value": 445,
      "unit": "min",
      "observed_at": "2026-01-05T07:00:00Z",
      "source_id": "crew_sleep_log",
      "provenance": "SYNTHETIC"
    },
    {
      "id": "base-reaction-5",
      "subject_id": "crew-demo-1",
      "metric": "reaction_time",
      "value": 252,
      "unit": "ms",
      "observed_at": "2026-01-05T09:00:00Z",
      "source_id": "reaction_task",
      "provenance": "SYNTHETIC",
      "metadata": {
        "task_version": "demo-rt-v1",
        "input_profile": "seeded-demo",
        "trial_count": 5,
        "false_starts": 0,
        "completed": true
      }
    },
    {
      "id": "sleep-08",
      "subject_id": "crew-demo-1",
      "metric": "sleep_duration",
      "value": 380,
      "unit": "min",
      "observed_at": "2026-01-08T07:00:00Z",
      "source_id": "crew_sleep_log",
      "provenance": "SYNTHETIC"
    },
    {
      "id": "sleep-09",
      "subject_id": "crew-demo-1",
      "metric": "sleep_duration",
      "value": -1,
      "unit": "min",
      "observed_at": "2026-01-09T07:00:00Z",
      "source_id": "crew_sleep_log",
      "provenance": "SYNTHETIC"
    },
    {
      "id": "sleep-10",
      "subject_id": "crew-demo-1",
      "metric": "sleep_duration",
      "value": 420,
      "unit": "min",
      "observed_at": "2026-01-10T07:00:00Z",
      "source_id": "crew_sleep_log",
      "provenance": "SYNTHETIC"
    },
    {
      "id": "reaction-10",
      "subject_id": "crew-demo-1",
      "metric": "reaction_time",
      "value": 310,
      "unit": "ms",
      "observed_at": "2026-01-10T09:01:00Z",
      "source_id": "reaction_task",
      "provenance": "SYNTHETIC",
      "metadata": {
        "task_version": "demo-rt-v1",
        "input_profile": "seeded-demo",
        "trial_count": 5,
        "false_starts": 0,
        "completed": true
      }
    }
  ],
  "assessments": [
    {
      "id": "demo-sleep-vigilance",
      "rule_id": "SLEEP_VIGILANCE",
      "rule_version": 1,
      "state": "insufficient_data",
      "title": "Comparison incomplete",
      "supporting_evidence": [
        {
          "code": "sleep_inputs_incomplete",
          "observation_ids": [
            "sleep-08",
            "sleep-10",
            "sleep-09",
            "base-sleep-1",
            "base-sleep-2",
            "base-sleep-3",
            "base-sleep-4",
            "base-sleep-5"
          ],
          "detail": "Required sleep slots or baseline inputs are missing or invalid.",
          "baseline_id": "crew-demo-sleep-v1"
        },
        {
          "code": "slower_reaction",
          "observation_ids": [
            "reaction-10",
            "base-reaction-1",
            "base-reaction-2",
            "base-reaction-3",
            "base-reaction-4",
            "base-reaction-5"
          ],
          "detail": "Current reaction time is 310 ms against the 250 ms demo baseline (+24.0%).",
          "baseline_id": "crew-demo-reaction-v1"
        }
      ],
      "conflicting_evidence": [],
      "missing_inputs": [
        "sleep_duration"
      ],
      "action_ids": [
        "review_available_inputs"
      ]
    }
  ],
  "actions": [
    {
      "id": "review_available_inputs",
      "label": "Review available inputs",
      "required_resource_ids": [],
      "available": true,
      "unavailable_reason": null
    }
  ],
  "incidents": []
}

function props(overrides: Partial<EvidenceStatusPanelProps> = {}): EvidenceStatusPanelProps {
  return {
    state: EXAMPLE_A,
    dataMode: 'integrated',
    status: 'ready',
    onAction: vi.fn(),
    onOpenEvidence: vi.fn(),
    ...overrides,
  }
}

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

describe('canonical crew states', () => {
  it('explains a missing reaction result and offers the returned available action', async () => {
    const onAction = vi.fn()
    view = await render(<EvidenceStatusPanel {...props({ state: EXAMPLE_B, onAction })} />)

    const content = text(view.container)
    expect(content).toContain('Evidence status')
    expect(content).toContain('Vigilance data missing')
    expect(content).toContain('insufficient data')
    expect(content).toContain('2026-01-10 09:00:00 UTC')
    expect(content).toContain('Integrated run')
    // Sleep evidence is present, but the missing reaction is the blocker.
    expect(content).toContain('crew_sleep_log')
    expect(content).toContain('Scheduled input received')
    expect(content).toContain('Two of the last three logged nights were at least 60 minutes below')
    expect(content).toContain('Reaction result missing.')
    expect(content).toContain('A comparable reaction result is needed before this comparison can be completed.')
    expect(content).not.toContain('Reaction result recorded;')
    expect(content).not.toContain('Required inputs available for this demo rule.')

    // The baseline reaction rows are not a current result: none are rendered as one.
    expect(view.container.querySelector('.evidence-status__row[data-kind="recorded"]')).toBeNull()

    await click(buttonByText(view.container, 'Run reaction check'))
    expect(onAction).toHaveBeenCalledWith('start_reaction_check')
  })

  it('states the demo conditions matched at 09:01 without a diagnosis or probability', async () => {
    const onAction = vi.fn()
    view = await render(<EvidenceStatusPanel {...props({ state: WATCH_B, onAction })} />)

    const content = text(view.container)
    expect(content).toContain('Sleep and vigilance change')
    expect(content).toContain('watch')
    expect(content).toContain('The configured sleep and reaction conditions matched. The cause is not established.')
    expect(content).toContain('Required inputs available for this demo rule.')
    // Returned evidence detail is still reachable through progressive disclosure.
    expect(content).toContain('310 ms')
    expect(content).toContain('250 ms')
    expect(content).toContain('(+24.0%)')
    expect(content).not.toMatch(/all healthy/i)
    expect(content).not.toMatch(/\d+% confident/i)

    await click(buttonByText(view.container, 'Review available inputs'))
    expect(onAction).toHaveBeenCalledWith('review_available_inputs')
  })

  it('renders a completed comparison as "not observed" without a health score', async () => {
    view = await render(<EvidenceStatusPanel {...props({ state: OBSERVED_B })} />)

    const content = text(view.container)
    expect(content).toContain('Demo pattern not observed')
    expect(content).toContain('observed')
    expect(content).toContain(
      'The configured watch pattern was not observed. This is not a general health assessment.',
    )
    expect(content).toContain('270 ms')
    expect(content).toContain('(+8.0%)')
    expect(content).not.toMatch(/all healthy/i)
    expect(content).not.toMatch(/\d+% confident/i)
    expect(content).not.toMatch(/Strong|Moderate|Weak/)
  })

  it('shows a recorded but incomparable browser result instead of calling it missing', async () => {
    view = await render(<EvidenceStatusPanel {...props({ state: INCOMPARABLE_B })} />)

    const content = text(view.container)
    expect(content).toContain('Comparison incomplete')
    expect(content).toContain(
      'Reaction result recorded; comparison with the demo baseline is unavailable.',
    )
    expect(content).not.toContain('Reaction result missing.')
    expect(content).toContain('The result was recorded, but its task or input setup differs from the demo baseline.')
    // The actual value and provenance are preserved from the returned observation.
    expect(content).toContain('320 ms')
    expect(content).toContain('Recorded on this device')
    expect(content).toContain('browser-1')
    expect(view.container.querySelector('.evidence-status__row[data-kind="recorded"]')).not.toBeNull()
  })

  it('names an unsatisfied sleep night or baseline with the returned explanation', async () => {
    const missingNight = structuredClone(EXAMPLE_B)
    missingNight.assessments[0].title = 'Comparison incomplete'
    missingNight.assessments[0].missing_inputs = ['sleep_duration']
    missingNight.assessments[0].supporting_evidence = [
      {
        code: 'sleep_inputs_incomplete',
        observation_ids: [],
        detail: 'Required sleep slots or baseline inputs are missing or invalid.',
        baseline_id: 'crew-demo-sleep-v1',
      },
    ]
    missingNight.sources[0] = {
      ...missingNight.sources[0],
      state: 'missing',
      last_observation_id: null,
      age_seconds: null,
      reason_code: 'scheduled_input_missing',
    }

    view = await render(<EvidenceStatusPanel {...props({ state: missingNight })} />)
    expect(text(view.container)).toContain('A required sleep log is missing.')
    expect(text(view.container)).toContain('A required sleep log is missing, so the comparison cannot be completed.')

    await view.rerender(
      <EvidenceStatusPanel
        {...props({
          state: {
            ...missingNight,
            assessments: [
              {
                ...missingNight.assessments[0],
                missing_inputs: ['reaction_baseline'],
              },
            ],
          },
        })}
      />,
    )
    expect(text(view.container)).toContain('Reaction baseline incomplete.')
    expect(text(view.container)).toContain('Reaction baseline')
  })

  it('shows an invalid reading as invalid and preserves the engine assessment', async () => {
    view = await render(<EvidenceStatusPanel {...props({ state: INVALID_READING })} />)

    const content = text(view.container)
    expect(content).toContain('DosTel1 invalid')
    expect(content).toContain('invalid')
    expect(content).toContain('DosTel1 has an unusable reading.')
    expect(content).toContain('A required detector reading is missing or unusable')
    expect(content).not.toContain('DosTel1 missing')
    expect(content).not.toMatch(/all healthy/i)

    // The invalid reading is returned in observations, so no invented absence is shown.
    expect(view.container.querySelector('.evidence-status__row[data-kind="invalid"]')).not.toBeNull()
  })
  it('describes an invalid sleep reading without calling it absent (actual engine output)', async () => {
    view = await render(<EvidenceStatusPanel {...props({ state: INVALID_SLEEP_ENGINE_OUTPUT })} />)

    const content = text(view.container)
    expect(content).toContain('Comparison incomplete')
    expect(content).toContain('insufficient data')
    // A present but invalid sleep observation is reported as invalid, not absent.
    expect(content).toContain('A required sleep log is invalid.')
    expect(content).toContain('sleep-09')
    expect(content).toContain('-1 min')
    expect(view.container.querySelector('.evidence-status__row[data-kind="invalid"]')).not.toBeNull()
    expect(
      view.container.querySelector('.evidence-status__row[data-source-state="invalid"]'),
    ).not.toBeNull()
    // The meaning must not contradict the invalid requirement by calling it missing.
    expect(content).toContain(
      'A returned sleep reading is invalid, so the comparison cannot be completed.',
    )
    expect(content).not.toContain('A required sleep input is missing')
    expect(content).not.toContain('A required sleep log is missing.')
    expect(content).not.toContain('Reaction result missing.')

  })

})

describe('radlab freshness and replay', () => {
  it('describes stale and zero-age readings without applying a new threshold', async () => {
    view = await render(<EvidenceStatusPanel {...props({ state: EXAMPLE_A })} />)

    const content = text(view.container)
    expect(content).toContain('DosTel1 stale')
    expect(content).toContain('Last reading 7 min 35 s ago.')
    expect(content).toContain('DosTel2 current')
    expect(content).toContain('Last reading 0 s ago.')
    expect(content).toContain('A detector reading is old. The cause of the gap is unknown.')
    expect(content).toContain('older_than_demo_window')
    expect(content).not.toMatch(/missing measurement|radiation danger|dose-based health concern/i)
    expect(content).not.toMatch(/ready|all evidence/i)
  })

  it('shows an honest unavailable age when a source has no reading', async () => {
    view = await render(<EvidenceStatusPanel {...props({ state: MISSING_READING })} />)

    const content = text(view.container)
    expect(content).toContain('DosTel1 missing')
    const missingRow = view.container.querySelector('.evidence-status__row[data-source-state="missing"]')
    expect(text(missingRow)).toContain('Age unavailable — no eligible reading returned.')
    expect(text(missingRow)).toContain('No reading returned.')
    expect(text(missingRow)).not.toContain('Last reading')
    expect(text(view.container)).toContain('Last reading 0 s ago.')
  })

  it('replaces a recovered explanation cleanly when props change back', async () => {
    view = await render(<EvidenceStatusPanel {...props({ state: EXAMPLE_A })} />)
    expect(text(view.container)).toContain('A detector reading is old.')

    await view.rerender(<EvidenceStatusPanel {...props({ state: RECOVERED })} />)
    expect(text(view.container)).toContain('The displayed detector readings are current under the demo freshness rule.')
    expect(text(view.container)).not.toContain('A detector reading is old.')
    expect(text(view.container)).not.toContain('Last reading 7 min 35 s ago.')

    await view.rerender(<EvidenceStatusPanel {...props({ state: EXAMPLE_A })} />)
    expect(text(view.container)).toContain('A detector reading is old.')
    expect(text(view.container)).toContain('Last reading 7 min 35 s ago.')
    // No future incident closure leaks into the earlier view (this panel never renders it).
    expect(text(view.container)).not.toContain('resolved')
  })
})

describe('disagreement', () => {
  it('makes no agreement claim when conflicting evidence is empty', async () => {
    view = await render(<EvidenceStatusPanel {...props({ state: EXAMPLE_A })} />)

    const content = text(view.container)
    expect(content).toContain('No conflicting evidence returned.')
    expect(content).not.toMatch(/sources agree|no conflicts detected/i)
    expect(content).toContain('Automatic conflict detection is not implemented in the current demo rules')
  })

  it('renders an artificial returned conflict and a missing evidence reference faithfully', async () => {
    view = await render(<EvidenceStatusPanel {...props({ state: ARTIFICIAL_EDGE })} />)

    const content = text(view.container)
    expect(content).toContain(
      'Placeholder conflicting entry. The contract reserves this state but defines no conflict rule.',
    )
    expect(content).toContain('conflicting_observations')
    expect(content).toContain('d2-232000')
    // The hand-edited fixture references d1-not-returned, which is absent from observations.
    expect(content).toContain('Evidence unavailable')
    expect(content).toContain('d1-not-returned')
  })
})

describe('actions and unknown identifiers', () => {
  it('keeps an unavailable action disabled with its reason and routes the fallback once', async () => {
    const onAction = vi.fn()
    const onOpenEvidence = vi.fn()
    view = await render(
      <EvidenceStatusPanel
        {...props({ state: UNAVAILABLE, onAction, onOpenEvidence })}
      />,
    )

    const unavailable = buttonByText(view.container, 'Run reaction check')
    expect(unavailable.disabled).toBe(true)
    const reasonId = unavailable.getAttribute('aria-describedby')
    expect(reasonId).not.toBeNull()
    expect(text(document.getElementById(reasonId!))).toBe('Reaction check unavailable')
    await click(unavailable)
    expect(onAction).not.toHaveBeenCalled()

    const fallback = buttonByText(view.container, 'Review available inputs')
    expect(fallback.disabled).toBe(false)
    await click(fallback)
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction).toHaveBeenCalledWith('review_available_inputs')

    await click(buttonByText(view.container, 'Why?'))
    expect(onOpenEvidence).toHaveBeenCalledTimes(1)
  })

  it('preserves unknown input and action identifiers without inventing controls', async () => {
    const unknown = structuredClone(EXAMPLE_B)
    unknown.assessments[0].missing_inputs = ['mystery_input', 'reaction_time']
    unknown.assessments[0].action_ids = ['start_reaction_check', 'mystery_action']

    const onAction = vi.fn()
    view = await render(<EvidenceStatusPanel {...props({ state: unknown, onAction })} />)

    const content = text(view.container)
    expect(content).toContain('mystery_input')
    expect(content).toContain('The engine named "mystery_input" as a missing input')
    expect(content).toContain('Action mystery_action unavailable')
    expect(view.container.querySelector('button#mystery_action')).toBeNull()

    const buttonLabels = Array.from(view.container.querySelectorAll('button')).map((button) =>
      text(button),
    )
    expect(buttonLabels).not.toContain('mystery_action')
    expect(buttonLabels).toContain('Run reaction check')

    await click(buttonByText(view.container, 'Run reaction check'))
    expect(onAction).toHaveBeenCalledWith('start_reaction_check')
  })
})

describe('modes, loading and empty state', () => {
  it('drops the previous conclusion immediately when state becomes null', async () => {
    view = await render(<EvidenceStatusPanel {...props({ state: WATCH_B })} />)
    expect(text(view.container)).toContain('Sleep and vigilance change')

    await view.rerender(<EvidenceStatusPanel {...props({ state: null, status: 'loading' })} />)
    const loading = text(view.container)
    expect(loading).toContain('Loading evidence status…')
    expect(loading).not.toContain('Sleep and vigilance change')
    expect(loading).not.toContain('310 ms')
    expect(view.container.querySelectorAll('button')).toHaveLength(0)

    await view.rerender(<EvidenceStatusPanel {...props({ state: null, status: 'error' })} />)
    const error = text(view.container)
    expect(error).toContain('Evidence status is unavailable for this time.')
    expect(error).not.toContain('Sleep and vigilance change')
    expect(view.container.querySelectorAll('button')).toHaveLength(0)
  })

  it('does not declare completeness when no assessment is returned', async () => {
    const empty = structuredClone(EXAMPLE_B)
    empty.assessments = []
    empty.actions = []

    view = await render(<EvidenceStatusPanel {...props({ state: empty })} />)
    const content = text(view.container)
    expect(content).toContain('No assessment was returned for this time')
    expect(content).not.toContain('Required inputs available for this demo rule.')
    expect(content).not.toContain('Reaction result missing.')
    expect(view.container.querySelectorAll('button')).toHaveLength(0)
  })

  it('labels a fixture preview as a fixed example', async () => {
    view = await render(
      <EvidenceStatusPanel {...props({ state: EXAMPLE_A, dataMode: 'fixture-preview' })} />,
    )
    const content = text(view.container)
    expect(content).toContain('Fixture preview — fixed example.')
    expect(content).toContain('not stored observations from a run')
    expect(content).toContain('fixed example, not proof that a run holds stored observations')
  })

  it('keeps unknown data mode honest and avoids integrated wording', async () => {
    view = await render(
      <EvidenceStatusPanel {...props({ state: WATCH_B, dataMode: 'unknown' })} />,
    )
    const content = text(view.container)
    expect(content).toContain('Data mode unknown.')
    expect(content).not.toContain('Integrated run')
    expect(content).not.toContain('verified')
  })

  it('lists multiple assessments separately instead of promoting the first to a verdict', async () => {
    const multiple = structuredClone(EXAMPLE_A)
    multiple.assessments = [
      multiple.assessments[0],
      {
        ...structuredClone(multiple.assessments[0]),
        id: 'second-assessment',
        title: 'Second assessment',
        state: 'observed',
        action_ids: ['view_source_history'],
      },
    ]
    view = await render(<EvidenceStatusPanel {...props({ state: multiple })} />)

    const content = text(view.container)
    expect(content).toContain('2 assessments returned; each is listed separately below.')
    expect(content).toContain('DosTel1 stale · DosTel2 current')
    expect(content).toContain('Second assessment')
    expect(view.container.querySelectorAll('.evidence-status__assessment')).toHaveLength(2)
    // A shared action reference is resolved once, not duplicated.
    const buttons = Array.from(view.container.querySelectorAll('button')).map((button) => text(button))
    expect(buttons.filter((label) => label === 'Review source history')).toHaveLength(1)
  })
})

describe('presenter helpers', () => {
  it('preserves zero and null ages without coercion', () => {
    expect(describeAge(0)).toBe('0 s')
    expect(describeAge(455)).toBe('7 min 35 s')
    expect(describeAge(7260)).toBe('2 h 1 min')
    const zeroAge = buildEvidenceStatus(fixture('state-2'), 'integrated', 'ready')
    expect(zeroAge.sources.map((source) => source.ageSeconds)).toEqual([0, 0])
    const noAge = buildEvidenceStatus(MISSING_READING, 'integrated', 'ready')
    const missing = noAge.sources.find((source) => source.sourceId === 'DosTel1')!
    expect(missing.ageSeconds).toBeNull()
    expect(missing.ageText).toBeNull()
  })

  it('distinguishes an absent reaction from a recorded incomparable reaction', () => {
    const absent = buildEvidenceStatus(EXAMPLE_B, 'integrated', 'ready')
    expect(absent.assessments[0].requirements[0]).toMatchObject({
      input: 'reaction_time',
      kind: 'missing',
      detail: 'Reaction result missing.',
    })

    const recorded = buildEvidenceStatus(INCOMPARABLE_B, 'integrated', 'ready')
    expect(recorded.assessments[0].requirements[0]).toMatchObject({
      input: 'reaction_time',
      kind: 'recorded',
      detail: 'Reaction result recorded; comparison with the demo baseline is unavailable.',
    })
    expect(recorded.assessments[0].requirements[0].observation?.observation?.id).toBe('browser-1')
    expect(recorded.assessments[0].requirements[0].observation?.observation?.provenance).toBe(
      'LIVE_MEASURED',
    )
  })

  it('maps null state to loading, error or unavailable without assessments', () => {
    expect(buildEvidenceStatus(null, 'integrated', 'loading').phase).toBe('loading')
    expect(buildEvidenceStatus(null, 'integrated', 'error').phase).toBe('error')
    expect(buildEvidenceStatus(null, 'integrated', 'idle').phase).toBe('unavailable')
    expect(buildEvidenceStatus(null, 'fixture-preview', 'loading').assessments).toEqual([])
  })
})
