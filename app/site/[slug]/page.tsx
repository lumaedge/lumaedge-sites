import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cacheLife } from 'next/cache'
import { getPublishedDocument } from '@/lib/public-site'
import { BlockRenderer } from '@/blocks/BlockRenderer'

async function loadPublishedDocument(slug: string) {
  'use cache'
  cacheLife({ stale: 0, revalidate: 60 })
  return getPublishedDocument(slug)
}

export const instant = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const result = await loadPublishedDocument(slug)
  if (!result) return {}
  return {
    title: result.document.seo.title || result.name,
    description: result.document.seo.description,
  }
}

export default async function PublicSitePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const result = await loadPublishedDocument(slug)
  if (!result) notFound()
  const { document, siteId } = result

  return (
    <div style={{ ['--site-primary' as string]: document.theme.primaryColor }}>
      <header className="border-b bg-white px-6 py-4">
        <p className="mx-auto max-w-3xl font-semibold">{document.seo.title}</p>
      </header>
      {document.blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} siteId={siteId} />
      ))}
      <footer className="bg-slate-900 px-6 py-6 text-center text-sm text-slate-400">
        {document.seo.title}
      </footer>
    </div>
  )
}
