import {
  blockSchema,
  type BlockType,
  type SiteDocument,
} from '@/blocks/schema'

export function insertBlock(
  doc: SiteDocument,
  type: BlockType,
  index?: number
): SiteDocument {
  const parsed = blockSchema.parse({
    id: crypto.randomUUID(),
    type,
    props: {},
  })
  const blocks = [...doc.blocks]
  blocks.splice(index ?? blocks.length, 0, parsed)
  return { ...doc, blocks }
}

export function removeBlock(doc: SiteDocument, blockId: string): SiteDocument {
  return { ...doc, blocks: doc.blocks.filter((b) => b.id !== blockId) }
}

export function moveBlock(
  doc: SiteDocument,
  from: number,
  to: number
): SiteDocument {
  const blocks = [...doc.blocks]
  const [moved] = blocks.splice(from, 1)
  blocks.splice(to, 0, moved)
  return { ...doc, blocks }
}

export function updateBlockProps(
  doc: SiteDocument,
  blockId: string,
  props: Record<string, unknown>
): SiteDocument {
  return {
    ...doc,
    blocks: doc.blocks.map((b) => {
      if (b.id !== blockId) return b
      return blockSchema.parse({ ...b, props: { ...b.props, ...props } })
    }),
  }
}

export function updateMeta(
  doc: SiteDocument,
  patch: Partial<Pick<SiteDocument, 'seo' | 'theme'>>
): SiteDocument {
  return {
    ...doc,
    seo: { ...doc.seo, ...patch.seo },
    theme: { ...doc.theme, ...patch.theme },
  }
}
