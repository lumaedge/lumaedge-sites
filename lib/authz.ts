import type { Entitlement, Profile } from '@/lib/types'

export type SiteAccess = 'none' | 'read' | 'write'

export function resolveSiteAccess(
  profile: Pick<Profile, 'role'>,
  ownership: { owned: boolean } | null,
  entitlement: Entitlement | null
): SiteAccess {
  if (profile.role === 'agency') return 'write'
  if (!ownership || !ownership.owned) return 'none'
  if (entitlement?.plan === 'editing' && entitlement.status === 'active') return 'write'
  return 'read'
}