import { describe, expect, it } from 'vitest'
import { insertBlock, moveBlock, removeBlock, updateBlockProps, updateMeta } from '@/lib/editor/ops'
import { defaultDocument, type SiteDocument } from '@/blocks/schema'

function doc(): SiteDocument {
  return defaultDocument('Test')
}

describe('editor ops', () => {
  it('inserts a block at the end by default', () => {
    const d = doc()
    const next = insertBlock(d, 'cta')
    expect(next.blocks.length).toBe(d.blocks.length + 1)
    expect(next.blocks.at(-1)?.type).toBe('cta')
  })

  it('removes a block by id', () => {
    const d = doc()
    const id = d.blocks[0].id
    const next = removeBlock(d, id)
    expect(next.blocks.find((b) => b.id === id)).toBeUndefined()
  })

  it('moves a block', () => {
    const d = doc()
    const firstId = d.blocks[0].id
    const next = moveBlock(d, 0, d.blocks.length - 1)
    expect(next.blocks.at(-1)?.id).toBe(firstId)
  })

  it('updates block props immutably', () => {
    const d = doc()
    const id = d.blocks[0].id
    const next = updateBlockProps(d, id, { headline: 'New' })
    expect((next.blocks[0].props as { headline: string }).headline).toBe('New')
    expect((d.blocks[0].props as { headline: string }).headline).not.toBe('New')
  })

  it('updates meta', () => {
    const d = doc()
    const next = updateMeta(d, { seo: { title: 'X', description: 'Y' } })
    expect(next.seo.title).toBe('X')
  })
})
