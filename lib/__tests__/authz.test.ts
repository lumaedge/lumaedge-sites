import { describe, expect, it } from 'vitest'
import { resolveSiteAccess } from '@/lib/authz'

const agency = { id: 'p1', role: 'agency' as const }
const client = { id: 'p2', role: 'client' as const }

const owned = { owned: true }
const notOwned = { owned: false }

const activeEditing = { plan: 'editing' as const, status: 'active' as const }
const pastDueEditing = { plan: 'editing' as const, status: 'past_due' as const }
const canceledEditing = { plan: 'editing' as const, status: 'canceled' as const }
const activeNone = { plan: 'none' as const, status: 'active' as const }

describe('resolveSiteAccess', () => {
  it('gives agency write access regardless of ownership or entitlement', () => {
    expect(resolveSiteAccess(agency, owned, null)).toBe('write')
    expect(resolveSiteAccess(agency, null, null)).toBe('write')
    expect(resolveSiteAccess(agency, owned, canceledEditing)).toBe('write')
  })

  it('denies clients that have no ownership record', () => {
    expect(resolveSiteAccess(client, null, null)).toBe('none')
    expect(resolveSiteAccess(client, null, activeEditing)).toBe('none')
    expect(resolveSiteAccess(client, notOwned, activeEditing)).toBe('none')
  })

  it('gives owning clients read-only access without an active editing plan', () => {
    expect(resolveSiteAccess(client, owned, null)).toBe('read')
    expect(resolveSiteAccess(client, owned, activeNone)).toBe('read')
    expect(resolveSiteAccess(client, owned, pastDueEditing)).toBe('read')
    expect(resolveSiteAccess(client, owned, canceledEditing)).toBe('read')
  })

  it('gives owning clients write access with an active editing plan', () => {
    expect(resolveSiteAccess(client, owned, activeEditing)).toBe('write')
  })

  it('grants agency write even when ownership is explicitly false', () => {
    expect(resolveSiteAccess(agency, notOwned, activeNone)).toBe('write')
  })
})