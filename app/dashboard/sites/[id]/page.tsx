import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { getSite } from '@/lib/sites'
import { createServerSupabase } from '@/lib/supabase/server'
import { canEditSite } from '@/lib/entitlements'
import { siteDocumentSchema } from '@/blocks/schema'
import { publicSiteUrl } from '@/lib/urls'
import { SiteWorkspace } from '@/components/editor/site-workspace'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const instant = false

export default async function SiteWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const profile = await requireProfile()
  const { id } = await params
  const site = await getSite(id, profile)
  if (!site) notFound()

  const supabase = await createServerSupabase()
  const { data: version } = await supabase
    .from('site_versions')
    .select('id, document, created_at')
    .eq('site_id', site.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!version) notFound()

  const { data: entitlementRow } = await supabase
    .from('entitlements')
    .select('plan, status')
    .eq('site_id', site.id)
    .maybeSingle()

  const parsed = siteDocumentSchema.safeParse(version.document)
  const doc = parsed.success ? parsed.data : null
  const canEdit = canEditSite(profile, entitlementRow)

  const siteActions = (
    <>
      <Button
        render={<Link href={`/dashboard/sites/${site.id}/versions`}>History</Link>}
        variant="outline"
      />
      <Button
        render={
          <a href={publicSiteUrl(site.slug)} target="_blank" rel="noreferrer">
            View live
          </a>
        }
        variant="outline"
      />
    </>
  )

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{site.name}</h1>
          <Badge variant={site.status === 'live' ? 'default' : 'secondary'}>{site.status}</Badge>
        </div>
        {doc ? (
          <SiteWorkspace
            siteId={site.id}
            initialDocument={doc}
            canEdit={canEdit}
            actions={siteActions}
          />
        ) : (
          <div className="flex gap-2">{siteActions}</div>
        )}
      </div>
      {doc ? null : (
        <p className="text-sm text-slate-600">
          This draft has invalid content and cannot be edited or published.
        </p>
      )}
    </div>
  )
}
