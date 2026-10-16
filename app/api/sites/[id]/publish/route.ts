import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { assertPublishable } from '@/lib/publish'
import { canEditSite } from '@/lib/entitlements'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = await createServerSupabase()
  const { data: site } = await supabase
    .from('sites')
    .select('id, slug, status, entitlements(plan, status)')
    .eq('id', id)
    .maybeSingle()
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const entitlement = Array.isArray(site.entitlements)
    ? (site.entitlements[0] ?? null)
    : site.entitlements
  if (!canEditSite(profile, entitlement))
    return NextResponse.json({ error: 'Editing not entitled' }, { status: 403 })

  let versionId: string | null = null
  const body = await request.json().catch(() => ({}))
  if (typeof body.versionId === 'string') {
    const { data: version } = await supabase
      .from('site_versions')
      .select('id, document')
      .eq('id', body.versionId)
      .eq('site_id', id)
      .maybeSingle()
    if (!version)
      return NextResponse.json({ error: 'Version not found for this site' }, { status: 400 })
    try {
      assertPublishable(version.document)
    } catch {
      return NextResponse.json({ error: 'Selected version is invalid' }, { status: 400 })
    }
    versionId = version.id
  } else {
    const { data: latest } = await supabase
      .from('site_versions')
      .select('id, document')
      .eq('site_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!latest)
      return NextResponse.json({ error: 'No versions to publish' }, { status: 400 })
    try {
      assertPublishable(latest.document)
    } catch {
      return NextResponse.json({ error: 'Latest draft is invalid' }, { status: 400 })
    }
    versionId = latest.id
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('sites')
    .update({ published_version_id: versionId, status: 'live' })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/')
  revalidatePath(`/site/${site.slug}`)
  return NextResponse.json({ status: 'live', versionId })
}
