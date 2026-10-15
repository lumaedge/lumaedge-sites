import { notFound } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createServerSupabase } from '@/lib/supabase/server'
import { siteDocumentSchema } from '@/blocks/schema'
import { BlockRenderer } from '@/blocks/BlockRenderer'

export const instant = false

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const profile = await getProfile()
  if (!profile) notFound()
  const { id } = await params
  const supabase = await createServerSupabase()
  const { data: site } = await supabase
    .from('sites')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (!site) notFound()

  const { data: version } = await supabase
    .from('site_versions')
    .select('document')
    .eq('site_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!version) notFound()

  const doc = siteDocumentSchema.parse(version.document)
  return (
    <div style={{ ['--site-primary' as string]: doc.theme.primaryColor }}>
      <title>{doc.seo.title}</title>
      {doc.blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} siteId={site.id} />
      ))}
    </div>
  )
}
