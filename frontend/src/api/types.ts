export type ScenarioId = 'radlab_stale' | 'sleep_vigilance'
export type Provenance = 'REAL_HISTORICAL' | 'SYNTHETIC' | 'LIVE_MEASURED'
export type SourceState = 'current' | 'stale' | 'missing' | 'invalid' | 'conflicting'
export type AssessmentState = 'observed' | 'watch' | 'insufficient_data'
export type IncidentState = 'open' | 'resolved'

export interface Observation {
  id: string
  subject_id: string | null
  metric: string
  value: number
  unit: string
  observed_at: string
  source_id: string
  provenance: Provenance
  source_timestamp?: string
  metadata?: Record<string, unknown>
}

export interface SourceStatus {
  source_id: string
  metric: string
  state: SourceState
  last_observation_id: string | null
  age_seconds: number | null
  reason_code: string
}

export interface Evidence {
  code: string
  observation_ids: string[]
  detail: string
  baseline_id?: string
}

export interface Assessment {
  id: string
  rule_id: string
  rule_version: number
  state: AssessmentState
  title: string
  supporting_evidence: Evidence[]
  conflicting_evidence: Evidence[]
  missing_inputs: string[]
  action_ids: string[]
}

export interface Action {
  id: string
  label: string
  required_resource_ids: string[]
  available: boolean
  unavailable_reason: string | null
}

export interface Incident {
  id: string
  source_id: string
  state: IncidentState
  opened_at: string
  closed_at: string | null
  last_observation_id: string
}

export interface StateEnvelope {
  schema_version: 1
  run_id: string
  scenario_id: ScenarioId
  as_of: string
  sources: SourceStatus[]
  observations: Observation[]
  assessments: Assessment[]
  actions: Action[]
  incidents: Incident[]
}

export interface Run {
  run_id: string
  scenario_id: ScenarioId
  initial_as_of: string
  range_start: string
  range_end: string
}

export interface ObservationHistory {
  observations: Observation[]
}

export interface SubmissionEntry {
  metric: string
  value: number
  unit: string
  source_id: string
  metadata?: Record<string, unknown>
}

export interface SubmissionRequest {
  submission_id: string
  observed_at: string
  entries: SubmissionEntry[]
}

export interface SubmissionResponse {
  submission_id: string
  observation_ids: string[]
}

export interface Checkpoint {
  id: string
  label: string
  as_of: string
}

export interface DashboardProps {
  state: StateEnvelope
  clock: string
  scenarioId: ScenarioId
  checkpoints: Checkpoint[]
  onScenarioChange(scenarioId: ScenarioId): void
  onSeek(asOf: string): void
  onAction(actionId: string): void
}

export interface CheckInProps {
  run: Run
  scenarioId: ScenarioId
  missionTime: string
  actions: Action[]
  onSubmit(submission: SubmissionRequest): Promise<SubmissionResponse>
}
