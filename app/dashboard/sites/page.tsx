import Link from 'next/link'
import { requireProfile } from '@/lib/auth'
import { listSites } from '@/lib/sites'
import { publicSiteUrl } from '@/lib/urls'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function SitesPage() {
  const profile = await requireProfile()
  const sites = await listSites(profile)
  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sites</h1>
        <Button render={<Link href="/dashboard/sites/new">New site</Link>} />
      </div>
      {sites.length === 0 ? (
        <p className="text-slate-600">No sites yet.</p>
      ) : (
        <div className="grid gap-4">
          {sites.map((site) => (
            <Card key={site.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>
                  <Link href={`/dashboard/sites/${site.id}`} className="hover:underline">
                    {site.name}
                  </Link>
                </CardTitle>
                <Badge variant={site.status === 'live' ? 'default' : 'secondary'}>
                  {site.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">{publicSiteUrl(site.slug)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
