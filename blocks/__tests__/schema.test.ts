import { describe, expect, it } from 'vitest'
import { siteDocumentSchema, defaultDocument } from '@/blocks/schema'

const validDoc = {
  seo: { title: 'Acme Plumbing', description: 'Local plumbers' },
  theme: { primaryColor: '#0f766e', font: 'inter' },
  blocks: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      type: 'hero',
      props: {
        headline: 'Reliable plumbing',
        subtext: '24/7 emergency callouts',
        imageUrl: '',
        buttonLabel: 'Call us',
        buttonHref: 'tel:+15550100',
      },
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      type: 'services',
      props: {
        items: [{ icon: 'wrench', title: 'Repairs', description: 'All brands' }],
      },
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      type: 'contact',
      props: { title: 'Get a quote', buttonLabel: 'Send' },
    },
  ],
}

describe('siteDocumentSchema', () => {
  it('accepts a valid document', () => {
    expect(siteDocumentSchema.safeParse(validDoc).success).toBe(true)
  })

  it('rejects unknown block types', () => {
    const bad = {
      ...validDoc,
      blocks: [{ id: '44444444-4444-4444-8444-444444444444', type: 'carousel', props: {} }],
    }
    expect(siteDocumentSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects non-uuid block ids', () => {
    const bad = { ...validDoc, blocks: [{ ...validDoc.blocks[0], id: 'nope' }] }
    expect(siteDocumentSchema.safeParse(bad).success).toBe(false)
  })
})

describe('defaultDocument', () => {
  it('produces a valid document', () => {
    const doc = defaultDocument('Test Site')
    expect(siteDocumentSchema.safeParse(doc).success).toBe(true)
    expect(doc.seo.title).toBe('Test Site')
    expect(doc.blocks.length).toBeGreaterThan(0)
  })
})
