import type {
  ObservationHistory,
  Run,
  ScenarioId,
  StateEnvelope,
  SubmissionRequest,
  SubmissionResponse,
} from './types'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown }
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail)) {
      return body.detail
        .map((item) => (item as { msg?: string }).msg ?? String(item))
        .join('; ')
    }
  } catch {
    // Not a JSON error body; use the status fallback below.
  }
  return `Request failed (${response.status})`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    throw new ApiError(response.status, await errorMessage(response))
  }
  return (await response.json()) as T
}

export function createRun(scenarioId: ScenarioId): Promise<Run> {
  return request<Run>('/runs', {
    method: 'POST',
    body: JSON.stringify({ scenario_id: scenarioId }),
  })
}

export function getState(runId: string, asOf: string): Promise<StateEnvelope> {
  const params = new URLSearchParams({ as_of: asOf })
  return request<StateEnvelope>(`/runs/${encodeURIComponent(runId)}/state?${params}`)
}

export interface ObservationQuery {
  asOf: string
  sourceId?: string
  metric?: string
  limit?: number
}

export function getObservations(
  runId: string,
  query: ObservationQuery,
): Promise<ObservationHistory> {
  const params = new URLSearchParams({ as_of: query.asOf })
  if (query.sourceId) params.set('source_id', query.sourceId)
  if (query.metric) params.set('metric', query.metric)
  if (query.limit !== undefined) params.set('limit', String(query.limit))
  return request<ObservationHistory>(`/runs/${encodeURIComponent(runId)}/observations?${params}`)
}

export function submitObservations(
  runId: string,
  submission: SubmissionRequest,
): Promise<SubmissionResponse> {
  return request<SubmissionResponse>(`/runs/${encodeURIComponent(runId)}/observations`, {
    method: 'POST',
    body: JSON.stringify(submission),
  })
}
