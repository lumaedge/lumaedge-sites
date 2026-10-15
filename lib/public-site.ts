import { createAdminClient } from '@/lib/supabase/admin'
import { siteDocumentSchema, type SiteDocument } from '@/blocks/schema'

const RESERVED_SUBDOMAINS = new Set(['app', 'you', 'api', 'admin', 'www'])

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

export async function getPublishedDocument(
  slug: string
): Promise<{ siteId: string; name: string; document: SiteDocument } | null> {
  const admin = createAdminClient()
  const { data: site } = await admin
    .from('sites')
    .select('id, name, status, published_version_id')
    .eq('slug', slug)
    .maybeSingle()
  if (!site || site.status !== 'live' || !site.published_version_id) return null

  const { data: version } = await admin
    .from('site_versions')
    .select('document')
    .eq('id', site.published_version_id)
    .maybeSingle()
  if (!version) return null

  const parsed = siteDocumentSchema.safeParse(version.document)
  if (!parsed.success) return null
  return { siteId: site.id, name: site.name, document: parsed.data }
}
