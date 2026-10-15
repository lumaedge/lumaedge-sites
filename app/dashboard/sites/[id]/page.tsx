import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { getSite } from '@/lib/sites'
import { createServerSupabase } from '@/lib/supabase/server'
import { canEditSite } from '@/lib/entitlements'
import { siteDocumentSchema } from '@/blocks/schema'
import { SiteEditor } from '@/components/editor/site-editor'
import { PublishVersionButton } from '@/components/editor/publish-version-button'
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

  const { data: entitlementRow } = await supabase
    .from('entitlements')
    .select('plan, status')
    .eq('site_id', site.id)
    .maybeSingle()

  const doc = version ? siteDocumentSchema.parse(version.document) : null
  if (!doc) notFound()
  const canEdit = canEditSite(profile, entitlementRow)

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{site.name}</h1>
          <Badge variant={site.status === 'live' ? 'default' : 'secondary'}>{site.status}</Badge>
        </div>
        <div className="flex gap-2">
          <PublishVersionButton siteId={site.id} label="Publish" />
          <Button
            render={<Link href={`/dashboard/sites/${site.id}/versions`}>History</Link>}
            variant="outline"
          />
          <Button
            render={
              <a
                href={`http://${site.slug}.${process.env.NEXT_PUBLIC_BASE_DOMAIN ?? 'localhost'}:3000`}
                target="_blank"
                rel="noreferrer"
              >
                View live
              </a>
            }
            variant="outline"
          />
        </div>
      </div>
      <SiteEditor siteId={site.id} initialDocument={doc} canEdit={canEdit} />
    </div>
  )
}
