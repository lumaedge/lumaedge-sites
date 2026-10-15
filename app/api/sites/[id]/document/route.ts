import { NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { canEditSite } from '@/lib/entitlements'
import { siteDocumentSchema } from '@/blocks/schema'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = await createServerSupabase()
  const { data: site } = await supabase
    .from('sites')
    .select('id, owner_profile_id, entitlements(plan, status)')
    .eq('id', id)
    .maybeSingle()
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const entitlement = Array.isArray(site.entitlements)
    ? (site.entitlements[0] ?? null)
    : site.entitlements
  if (!canEditSite(profile, entitlement))
    return NextResponse.json({ error: 'Editing not entitled' }, { status: 403 })

  const parsed = siteDocumentSchema.safeParse((await request.json()).document)
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid document' }, { status: 400 })

  const admin = createAdminClient()
  const { data: version, error } = await admin
    .from('site_versions')
    .insert({ site_id: id, document: parsed.data, created_by: profile.id })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ versionId: version.id })
}
