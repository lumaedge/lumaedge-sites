import { RESERVED_SLUGS } from '@/lib/sites'

export const RESERVED_SUBDOMAINS = new Set(RESERVED_SLUGS)

export function matchPublicHost(
  hostname: string,
  baseDomain: string
): string | null {
  const host = hostname.split(':')[0].toLowerCase()
  if (host === baseDomain) return null
  if (!host.endsWith(`.${baseDomain}`)) return null
  const slug = host.slice(0, -(baseDomain.length + 1))
  if (slug.includes('.') || RESERVED_SUBDOMAINS.has(slug)) return null
  return slug
}