export const ACTION_ROUTES = {
  view_source_history: 'history',
  start_reaction_check: 'checkin',
  review_available_inputs: 'evidence',
} as const

export type ActionRoute = (typeof ACTION_ROUTES)[keyof typeof ACTION_ROUTES]

export function routeAction(actionId: string): ActionRoute | null {
  return Object.hasOwn(ACTION_ROUTES, actionId)
    ? ACTION_ROUTES[actionId as keyof typeof ACTION_ROUTES]
    : null
}
