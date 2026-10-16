import { resolveSiteAccess } from '@/lib/authz'
import type { Entitlement } from '@/lib/types'

export function canEditSite(
  profile: { role: 'agency' | 'client' },
  entitlement: Entitlement | null
): boolean {
  return resolveSiteAccess(profile, { owned: true }, entitlement) === 'write'
}