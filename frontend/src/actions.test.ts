import { describe, expect, it } from 'vitest'
import { routeAction } from './actions'

describe('action routing', () => {
  it('routes the three demo actions', () => {
    expect(routeAction('view_source_history')).toBe('history')
    expect(routeAction('start_reaction_check')).toBe('checkin')
    expect(routeAction('review_available_inputs')).toBe('evidence')
  })

  it('returns null for an unknown action', () => {
    expect(routeAction('unknown')).toBeNull()
  })
})
