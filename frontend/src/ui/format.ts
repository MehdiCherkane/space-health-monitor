import type { Observation, Provenance } from '../api/types'

/** Contract provenance labels (contracts/v1.md, evidence/demo-claims.md). */
export const PROVENANCE_LABEL: Record<Provenance, string> = {
  REAL_HISTORICAL: 'Historical NASA telemetry',
  SYNTHETIC: 'Synthetic crew scenario',
  LIVE_MEASURED: 'Recorded on this device',
}

/** `2022-04-01T23:20:00Z` → `2022-04-01 23:20:00 UTC`. Leaves anything else untouched. */
export function formatUtc(iso: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})Z$/.exec(iso)
  return match ? `${match[1]} ${match[2]} UTC` : iso
}

/** Time of day only, for compact checkpoint and row labels. */
export function formatTime(iso: string): string {
  const match = /T(\d{2}:\d{2}:\d{2})Z$/.exec(iso)
  return match ? match[1] : iso
}

/** Age is shown exactly as returned; 0 is a real age. Null means no reading, so no age. */
export function formatAge(seconds: number | null): string | null {
  if (seconds === null) return null
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  const friendly =
    minutes < 60
      ? `${minutes} min${rest ? ` ${rest} s` : ''}`
      : `${Math.floor(minutes / 60)} h ${minutes % 60} min`
  return `${seconds} s · ${friendly}`
}

export function formatValue(observation: Pick<Observation, 'value' | 'unit'>): string {
  return `${observation.value} ${observation.unit}`
}

/** Join by ID, never by array position. */
export function indexObservations(observations: Observation[]): Map<string, Observation> {
  return new Map(observations.map((observation) => [observation.id, observation]))
}

/** Engine snake_case states become readable words without changing their meaning. */
export function stateLabel(state: string): string {
  return state.replace(/_/g, ' ')
}

/** Plain-language meaning of each source reason code, from the contracts/v1.md D5 table. */
export const REASON_TEXT: Record<string, string> = {
  within_demo_window: 'Latest reading is at most 300 s old',
  older_than_demo_window: 'Latest reading is at least 301 s old',
  no_eligible_observation: 'No visible reading for this detector',
  scheduled_input_received: 'Scheduled input received',
  current_session_missing: 'No completed reaction result this session',
  scheduled_input_missing: 'A required scheduled sleep input is absent',
  invalid_observation: 'The relevant reading is invalid',
  incomparable_reaction_result: 'Result uses a different task or input profile than the baseline',
  conflicting_observations: 'Evidence disagrees; cause unresolved',
}

/** `absorbed_dose_rate` → `Absorbed dose rate`. */
export function humanize(code: string): string {
  const words = code.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
