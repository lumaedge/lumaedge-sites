import { describe, expect, it } from 'vitest'
import { canEditSite } from '@/lib/entitlements'

const agency = { role: 'agency' as const }
const client = { role: 'client' as const }

describe('canEditSite', () => {
  it('lets agency edit regardless of entitlement', () => {
    expect(canEditSite(agency, null)).toBe(true)
    expect(canEditSite(agency, { plan: 'none', status: 'canceled' })).toBe(true)
  })

  it('lets clients edit only with active editing plan', () => {
    expect(canEditSite(client, { plan: 'editing', status: 'active' })).toBe(true)
    expect(canEditSite(client, { plan: 'editing', status: 'past_due' })).toBe(false)
    expect(canEditSite(client, { plan: 'none', status: 'active' })).toBe(false)
    expect(canEditSite(client, null)).toBe(false)
  })
})
