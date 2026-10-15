import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Profile, SiteStatus } from '@/lib/types'
import type { SiteDocument } from '@/blocks/schema'

export const RESERVED_SLUGS = [
  'app',
  'you',
  'api',
  'admin',
  'www',
  'mail',
  'assets',
  'static',
]

const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

export function validateSlug(
  slug: string
): { ok: true } | { ok: false; error: string } {
  if (RESERVED_SLUGS.includes(slug)) return { ok: false, error: 'Reserved word' }
  if (slug.length < 3 || slug.length > 48)
    return { ok: false, error: 'Must be 3–48 characters' }
  if (!SLUG_RE.test(slug)) return { ok: false, error: 'Lowercase letters, numbers, hyphens' }
  return { ok: true }
}

export type SiteRow = {
  id: string
  slug: string
  name: string
  status: SiteStatus
  published_version_id: string | null
  created_at: string
}

export async function listSites(profile: Profile): Promise<SiteRow[]> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('sites')
    .select('id, slug, name, status, published_version_id, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getSite(
  id: string,
  profile: Profile
): Promise<SiteRow | null> {
  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from('sites')
    .select('id, slug, name, status, published_version_id, created_at')
    .eq('id', id)
    .maybeSingle()
  return data ?? null
}

export async function createSiteRow(input: {
  name: string
  slug: string
  ownerProfileId: string
  document: SiteDocument
  createdBy: string
}): Promise<SiteRow> {
  const admin = createAdminClient()
  const { data: site, error } = await admin
    .from('sites')
    .insert({
      name: input.name,
      slug: input.slug,
      owner_profile_id: input.ownerProfileId,
      status: 'draft',
    })
    .select('id, slug, name, status, published_version_id, created_at')
    .single()
  if (error) throw error
  const { error: versionError } = await admin.from('site_versions').insert({
    site_id: site.id,
    document: input.document,
    created_by: input.createdBy,
  })
  if (versionError) throw versionError
  return site
}
