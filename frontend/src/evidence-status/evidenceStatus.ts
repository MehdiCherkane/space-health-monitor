/**
 * Display model for the Evidence status panel.
 *
 * This module restates facts the engine already returned (source states, reasons,
 * evidence details, assessments and actions). It does not evaluate a rule, compare
 * detector values, calculate a probability/confidence score or make a diagnosis.
 */
import type {
  Action,
  Assessment,
  AssessmentState,
  DataMode,
  Evidence,
  LoadStatus,
  Observation,
  SourceState,
  SourceStatus,
  StateEnvelope,
} from '../api/types'
import { REASON_TEXT, humanize, stateLabel } from '../ui/format'

export type RequirementKind =
  | 'missing'
  | 'invalid'
  | 'recorded'
  | 'baseline'
  | 'available'
  | 'unspecified'

export interface ObservationRef {
  id: string
  /** Absent when the returned reference has no matching observation. */
  observation?: Observation
}

/** One returned requirement, explained from the engine's missing-inputs entry. */
export interface RequirementRow {
  input: string
  name: string
  detail: string
  kind: RequirementKind
  /** Present when a recorded result can be shown with its returned provenance. */
  observation?: ObservationRef
}

/** One returned source status, with its age and last reading joined by ID. */
export interface SourceRow {
  sourceId: string
  state: SourceState
  reasonCode: string
  reasonText: string
  ageSeconds: number | null
  /** Friendly age; null when the engine returned no age. Zero stays zero. */
  ageText: string | null
  last: ObservationRef | null
}

export interface AssessmentView {
  id: string
  title: string
  state: AssessmentState
  rule: string
  meaning: string
  requirements: RequirementRow[]
  supporting: Evidence[]
  conflicts: Evidence[]
}

export interface ActionRow {
  id: string
  label: string
  available: boolean
  unavailableReason: string | null
}

export type EvidenceStatusPhase = 'loading' | 'error' | 'unavailable' | 'ready'

export interface EvidenceStatusModel {
  phase: EvidenceStatusPhase
  asOf: string | null
  preview: boolean
  unknownMode: boolean
  notice: string | null
  summary: string
  assessments: AssessmentView[]
  sources: SourceRow[]
  actions: ActionRow[]
  unresolvedActions: string[]
  hasConflicts: boolean
  limits: string[]
}

const INPUT_NAMES: Record<string, string> = {
  sleep_duration: 'Required sleep log',
  reaction_time: 'Reaction result',
  sleep_baseline: 'Sleep baseline',
  reaction_baseline: 'Reaction baseline',
}

/** Friendly age words. The exact second count is still shown in the source age row. */
export function describeAge(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (minutes < 60) return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`
  const hours = Math.floor(minutes / 60)
  const leftover = minutes % 60
  return leftover === 0 ? `${hours} h` : `${hours} h ${leftover} min`
}

function observationRef(
  observations: Map<string, Observation>,
  id: string | null,
): ObservationRef | null {
  if (id === null) return null
  return { id, observation: observations.get(id) }
}

function sourceForMetric(state: StateEnvelope, metric: string): SourceStatus | undefined {
  return state.sources.find((source) => source.metric === metric)
}

/**
 * The engine uses `reaction_time` for both an absent result and a recorded but
 * incomparable result. The returned source reason code distinguishes them.
 */
function describeReactionRequirement(
  state: StateEnvelope,
  observations: Map<string, Observation>,
): RequirementRow {
  const source = sourceForMetric(state, 'reaction_time')
  const input = 'reaction_time'
  const name = INPUT_NAMES[input]
  const last = observationRef(observations, source?.last_observation_id ?? null)

  if (
    source === undefined ||
    source.last_observation_id === null ||
    source.reason_code === 'current_session_missing'
  ) {
    return { input, name, kind: 'missing', detail: 'Reaction result missing.' }
  }
  if (source.reason_code === 'incomparable_reaction_result') {
    return {
      input,
      name,
      kind: 'recorded',
      detail: 'Reaction result recorded; comparison with the demo baseline is unavailable.',
      observation: last ?? undefined,
    }
  }
  if (source.state === 'invalid' || source.reason_code === 'invalid_observation') {
    return {
      input,
      name,
      kind: 'invalid',
      detail: 'Reaction result recorded but unusable for the comparison.',
      observation: last ?? undefined,
    }
  }
  return {
    input,
    name,
    kind: 'recorded',
    detail: 'Reaction result recorded, but it is not comparable with the demo baseline.',
    observation: last ?? undefined,
  }
}

function describeSleepRequirement(state: StateEnvelope): RequirementRow {
  const input = 'sleep_duration'
  const name = INPUT_NAMES[input]
  const source = sourceForMetric(state, input)
  if (
    source === undefined ||
    source.last_observation_id === null ||
    source.reason_code === 'scheduled_input_missing'
  ) {
    return { input, name, kind: 'missing', detail: 'A required sleep log is missing.' }
  }
  if (source.state === 'invalid' || source.reason_code === 'invalid_observation') {
    return { input, name, kind: 'invalid', detail: 'A required sleep log is invalid.' }
  }
  return {
    input,
    name,
    kind: 'missing',
    detail: 'A required sleep log is not available for this assessment.',
  }
}

function describeMissingInput(
  input: string,
  state: StateEnvelope,
  observations: Map<string, Observation>,
): RequirementRow {
  const knownName = INPUT_NAMES[input]
  if (knownName !== undefined) {
    if (input === 'reaction_time') return describeReactionRequirement(state, observations)
    if (input === 'sleep_duration') return describeSleepRequirement(state)
    return { input, name: knownName, kind: 'baseline', detail: knownName + ' incomplete.' }
  }

  // Freshness missing inputs name the affected detector (e.g. DosTel1).
  const source = state.sources.find((candidate) => candidate.source_id === input)
  if (source !== undefined) {
    const name = input
    const last = observationRef(observations, source.last_observation_id)
    if (source.state === 'invalid' || source.reason_code === 'invalid_observation') {
      return {
        input,
        name,
        kind: 'invalid',
        detail: `${input} has an unusable reading.`,
        observation: last ?? undefined,
      }
    }
    if (source.last_observation_id === null || source.state === 'missing') {
      return { input, name, kind: 'missing', detail: `${input} has no eligible reading at this time.` }
    }
    return {
      input,
      name,
      kind: 'missing',
      detail: `${input} is listed as a missing input for this assessment.`,
      observation: last ?? undefined,
    }
  }

  // Keep an unknown identifier visible instead of hiding it or inventing a meaning.
  return {
    input,
    name: humanize(input),
    kind: 'unspecified',
    detail: `The engine named "${input}" as a missing input; no readable description is available here.`,
  }
}

function requirementsFor(
  assessment: Assessment,
  state: StateEnvelope,
  observations: Map<string, Observation>,
): RequirementRow[] {
  const missing = Array.from(new Set(assessment.missing_inputs))
  if (missing.length > 0) {
    return missing.map((input) => describeMissingInput(input, state, observations))
  }
  if (assessment.state === 'insufficient_data') {
    // An empty missing-inputs list is not proof the system checked everything.
    return [
      {
        input: '',
        name: 'Input availability',
        kind: 'unspecified',
        detail:
          'The assessment is incomplete, but the engine did not name a specific missing input.',
      },
    ]
  }
  return [
    {
      input: '',
      name: 'Input availability',
      kind: 'available',
      detail: 'Required inputs available for this demo rule.',
    },
  ]
}

function meaningFor(assessment: Assessment, state: StateEnvelope): string {
  const reaction = sourceForMetric(state, 'reaction_time')
  const incomparable = reaction?.reason_code === 'incomparable_reaction_result'
  const reactionMissing =
    assessment.missing_inputs.includes('reaction_time') &&
    (reaction === undefined ||
      reaction.last_observation_id === null ||
      reaction.reason_code === 'current_session_missing')

  if (state.scenario_id === 'sleep_vigilance') {
    if (assessment.state === 'insufficient_data') {
      if (incomparable) {
        return 'The result was recorded, but its task or input setup differs from the demo baseline.'
      }
      if (reactionMissing) {
        return 'A comparable reaction result is needed before this comparison can be completed.'
      }
      if (assessment.missing_inputs.some((input) => input.startsWith('sleep_'))) {
        return 'A required sleep input is missing, so the comparison cannot be completed.'
      }
      const returned = assessment.supporting_evidence.find(
        (item) => item.code === 'sleep_inputs_incomplete',
      )
      return returned?.detail ?? 'The comparison cannot be completed with the returned inputs.'
    }
    if (assessment.state === 'watch') {
      return 'The configured sleep and reaction conditions matched. The cause is not established.'
    }
    return 'The configured watch pattern was not observed. This is not a general health assessment.'
  }

  if (state.scenario_id === 'radlab_stale') {
    if (assessment.state === 'insufficient_data') {
      return 'A required detector reading is missing or unusable, so the freshness assessment is incomplete.'
    }
    if (assessment.state === 'watch' || state.sources.some((source) => source.state === 'stale')) {
      return 'A detector reading is old. The cause of the gap is unknown.'
    }
    return 'The displayed detector readings are current under the demo freshness rule.'
  }

  return 'The engine returned this assessment at the displayed time. Read it together with the source states below.'
}

function sourceRows(
  state: StateEnvelope,
  observations: Map<string, Observation>,
): SourceRow[] {
  return state.sources.map((source) => ({
    sourceId: source.source_id,
    state: source.state,
    reasonCode: source.reason_code,
    reasonText: REASON_TEXT[source.reason_code] ?? humanize(source.reason_code),
    ageSeconds: source.age_seconds,
    ageText: source.age_seconds === null ? null : describeAge(source.age_seconds),
    last: observationRef(observations, source.last_observation_id),
  }))
}

function actionRows(state: StateEnvelope): {
  actions: ActionRow[]
  unresolved: string[]
} {
  const byId = new Map(state.actions.map((action) => [action.id, action]))
  const seen = new Set<string>()
  const actions: ActionRow[] = []
  const unresolved: string[] = []
  for (const assessment of state.assessments) {
    for (const id of assessment.action_ids) {
      if (seen.has(id)) continue
      seen.add(id)
      const action: Action | undefined = byId.get(id)
      if (action === undefined) {
        unresolved.push(id)
        continue
      }
      actions.push({
        id: action.id,
        label: action.label,
        available: action.available,
        unavailableReason: action.unavailable_reason,
      })
    }
  }
  return { actions, unresolved }
}

function summaryFor(assessments: AssessmentView[]): string {
  if (assessments.length === 0) {
    return 'No assessment was returned for this time, so evidence completeness cannot be confirmed.'
  }
  if (assessments.length === 1) {
    return `One assessment returned: ${assessments[0].title} (${stateLabel(assessments[0].state)}).`
  }
  return `${assessments.length} assessments returned; each is listed separately below.`
}

function limitsFor(preview: boolean, unknownMode: boolean, hasConflicts: boolean): string[] {
  const limits = [
    'Medical certainty is not assessed by this prototype.',
    'This panel restates returned states, evidence and rule IDs. It does not calculate a probability, confidence score or diagnosis.',
    'Thresholds, windows and baselines are fixed demo settings, not clinical cutoffs.',
  ]
  if (hasConflicts) {
    limits.push(
      'The contract reserves conflict states; this panel renders a returned conflict but does not infer disagreement from differing values.',
    )
  } else {
    limits.push(
      'Automatic conflict detection is not implemented in the current demo rules; "No conflicting evidence returned" does not establish agreement between sources.',
    )
  }
  if (preview) {
    limits.push('Fixture preview values are a fixed example, not proof that a run holds stored observations.')
  }
  if (unknownMode) {
    limits.push(
      'The data mode is unknown; these values are not confirmed as backend-evaluated stored observations.',
    )
  }
  return limits
}

function noticeFor(dataMode: DataMode): string | null {
  if (dataMode === 'fixture-preview') {
    return 'Fixture preview — fixed example. These values are a fixed contract example, not stored observations from a run.'
  }
  if (dataMode === 'unknown') {
    return 'Data mode unknown. These values are not confirmed as backend-evaluated stored observations.'
  }
  return null
}

/** Build the complete display model from props. Pure and side-effect free. */
export function buildEvidenceStatus(
  state: StateEnvelope | null,
  dataMode: DataMode,
  status: LoadStatus,
): EvidenceStatusModel {
  const preview = dataMode === 'fixture-preview'
  const unknownMode = dataMode === 'unknown'

  if (state === null) {
    const phase: EvidenceStatusPhase =
      status === 'loading' ? 'loading' : status === 'error' ? 'error' : 'unavailable'
    return {
      phase,
      asOf: null,
      preview,
      unknownMode,
      notice: null,
      summary: '',
      assessments: [],
      sources: [],
      actions: [],
      unresolvedActions: [],
      hasConflicts: false,
      limits: [],
    }
  }

  const observations = new Map(state.observations.map((observation) => [observation.id, observation]))
  const assessments: AssessmentView[] = state.assessments.map((assessment) => ({
    id: assessment.id,
    title: assessment.title,
    state: assessment.state,
    rule: `${assessment.rule_id}@${assessment.rule_version}`,
    meaning: meaningFor(assessment, state),
    requirements: requirementsFor(assessment, state, observations),
    supporting: assessment.supporting_evidence,
    conflicts: assessment.conflicting_evidence,
  }))
  const { actions, unresolved } = actionRows(state)
  const hasConflicts = assessments.some((assessment) => assessment.conflicts.length > 0)

  return {
    phase: 'ready',
    asOf: state.as_of,
    preview,
    unknownMode,
    notice: noticeFor(dataMode),
    summary: summaryFor(assessments),
    assessments,
    sources: sourceRows(state, observations),
    actions,
    unresolvedActions: unresolved,
    hasConflicts,
    limits: limitsFor(preview, unknownMode, hasConflicts),
  }
}
