import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { getSite } from '@/lib/sites'
import { createServerSupabase } from '@/lib/supabase/server'
import { PublishVersionButton } from '@/components/editor/publish-version-button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function VersionsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const profile = await requireProfile()
  const { id } = await params
  const site = await getSite(id, profile)
  if (!site) notFound()

  const supabase = await createServerSupabase()
  const { data: versions } = await supabase
    .from('site_versions')
    .select('id, created_at, created_by')
    .eq('site_id', id)
    .order('created_at', { ascending: false })

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Version history — {site.name}</h1>
        <PublishVersionButton siteId={site.id} label="Publish latest" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Versions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {(versions ?? []).map((version) => (
            <div key={version.id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <div className="flex items-center gap-3">
                <p className="font-mono text-xs">{version.id.slice(0, 8)}</p>
                <p className="text-sm text-slate-600">
                  {new Date(version.created_at).toLocaleString()}
                </p>
                {site.published_version_id === version.id ? (
                  <Badge>Published</Badge>
                ) : null}
              </div>
              <PublishVersionButton siteId={site.id} versionId={version.id} label="Publish this" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
