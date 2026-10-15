import type { Entitlement } from '@/lib/types'

export function canEditSite(
  profile: { role: 'agency' | 'client' },
  entitlement: Entitlement | null
): boolean {
  if (profile.role === 'agency') return true
  return entitlement?.plan === 'editing' && entitlement.status === 'active'
}
