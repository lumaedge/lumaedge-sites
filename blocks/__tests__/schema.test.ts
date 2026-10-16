import { describe, expect, it } from 'vitest'
import {
  siteDocumentSchema,
  defaultDocument,
  contactBlock,
  ctaBlock,
  galleryBlock,
  heroBlock,
  hoursBlock,
  mapBlock,
  servicesBlock,
  textBlock,
  type BlockType,
} from '@/blocks/schema'
import { blockFields } from '@/blocks/fields'

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

describe('buttonHref schemes', () => {
  const heroWith = (buttonHref: string) => ({
    ...validDoc,
    blocks: [{ ...validDoc.blocks[0], props: { ...validDoc.blocks[0].props, buttonHref } }],
  })

  it('accepts safe schemes, anchors, relative paths and empty values', () => {
    for (const href of [
      '',
      '#contact',
      '/services',
      'services.html',
      'https://example.com',
      'http://example.com',
      'mailto:hi@example.com',
      'tel:+15550100',
    ]) {
      expect(siteDocumentSchema.safeParse(heroWith(href)).success, href).toBe(true)
    }
  })

  it('rejects script-bearing and unknown schemes', () => {
    for (const href of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'java\tscript:alert(1)',
      ' javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
    ]) {
      expect(siteDocumentSchema.safeParse(heroWith(href)).success, href).toBe(false)
    }
  })

  it('applies the same rule to cta buttons', () => {
    const cta = {
      id: '55555555-5555-4555-8555-555555555555',
      type: 'cta',
      props: { headline: 'Call now', buttonLabel: 'Call', buttonHref: 'javascript:alert(1)' },
    }
    const bad = { ...validDoc, blocks: [cta] }
    expect(siteDocumentSchema.safeParse(bad).success).toBe(false)
  })
})

const schemaPropsKeys: Record<BlockType, string[]> = {
  hero: Object.keys(heroBlock.shape.props.shape),
  text: Object.keys(textBlock.shape.props.shape),
  services: Object.keys(servicesBlock.shape.props.shape),
  gallery: Object.keys(galleryBlock.shape.props.shape),
  hours: Object.keys(hoursBlock.shape.props.shape),
  map: Object.keys(mapBlock.shape.props.shape),
  contact: Object.keys(contactBlock.shape.props.shape),
  cta: Object.keys(ctaBlock.shape.props.shape),
}

// Keys that deliberately do not render as a scalar field: listed with the kind they must use.
const FIELD_ALLOWANCES: Record<string, { kind: string; reason: string }> = {
  'gallery.images': {
    kind: 'imageList',
    reason: 'array of images edited by the imageList control',
  },
}

describe('schema/field parity', () => {
  it('covers all eight block types', () => {
    expect(Object.keys(schemaPropsKeys).sort()).toEqual(
      ['contact', 'cta', 'gallery', 'hero', 'hours', 'map', 'services', 'text']
    )
  })

  it('gives every schema props key an editor field', () => {
    for (const type of Object.keys(schemaPropsKeys) as BlockType[]) {
      const fields = blockFields[type]
      for (const key of schemaPropsKeys[type]) {
        const path = `${type}.${key}`
        const field = fields.find((f) => f.name === key)
        const allowance = FIELD_ALLOWANCES[path]
        if (allowance) {
          expect(
            field,
            `${path} allowance: ${allowance.reason}; expected kind ${allowance.kind}`
          ).toBeDefined()
          expect(field?.kind, `${path} allowance kind`).toBe(allowance.kind)
          continue
        }
        expect(field, `${path} has no entry in blockFields.${type}`).toBeDefined()
      }
    }
  })

  it('has no editor field without a schema key', () => {
    for (const type of Object.keys(schemaPropsKeys) as BlockType[]) {
      const keys = schemaPropsKeys[type]
      for (const field of blockFields[type]) {
        expect(keys, `${type}.${field.name} has no schema key`).toContain(field.name)
      }
    }
  })

  it('has no stale allowances', () => {
    for (const path of Object.keys(FIELD_ALLOWANCES)) {
      const [type, key] = path.split('.') as [BlockType, string]
      expect(schemaPropsKeys[type], `allowance ${path} is stale`).toContain(key)
    }
  })
})
