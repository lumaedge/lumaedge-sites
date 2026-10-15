import { z } from 'zod'

const id = z.string().uuid()

export const heroBlock = z.object({
  id,
  type: z.literal('hero'),
  props: z.object({
    headline: z.string().default(''),
    subtext: z.string().default(''),
    imageUrl: z.string().default(''),
    buttonLabel: z.string().default(''),
    buttonHref: z.string().default(''),
  }),
})

export const textBlock = z.object({
  id,
  type: z.literal('text'),
  props: z.object({
    heading: z.string().default(''),
    body: z.string().default(''),
  }),
})

export const servicesBlock = z.object({
  id,
  type: z.literal('services'),
  props: z.object({
    items: z
      .array(
        z.object({
          icon: z.string().default(''),
          title: z.string().default(''),
          description: z.string().default(''),
        })
      )
      .default([]),
  }),
})

export const galleryBlock = z.object({
  id,
  type: z.literal('gallery'),
  props: z.object({
    images: z
      .array(z.object({ url: z.string().default(''), alt: z.string().default('') }))
      .default([]),
  }),
})

export const hoursBlock = z.object({
  id,
  type: z.literal('hours'),
  props: z.object({
    rows: z
      .array(
        z.object({
          day: z.string().default(''),
          open: z.string().default(''),
          close: z.string().default(''),
        })
      )
      .default([]),
  }),
})

export const mapBlock = z.object({
  id,
  type: z.literal('map'),
  props: z.object({
    address: z.string().default(''),
  }),
})

export const contactBlock = z.object({
  id,
  type: z.literal('contact'),
  props: z.object({
    title: z.string().default(''),
    buttonLabel: z.string().default('Send'),
  }),
})

export const ctaBlock = z.object({
  id,
  type: z.literal('cta'),
  props: z.object({
    headline: z.string().default(''),
    buttonLabel: z.string().default(''),
    buttonHref: z.string().default(''),
  }),
})

export const blockSchema = z.discriminatedUnion('type', [
  heroBlock,
  textBlock,
  servicesBlock,
  galleryBlock,
  hoursBlock,
  mapBlock,
  contactBlock,
  ctaBlock,
])

export const siteDocumentSchema = z.object({
  seo: z.object({
    title: z.string().default(''),
    description: z.string().default(''),
  }),
  theme: z.object({
    primaryColor: z.string().default('#0f766e'),
    font: z.string().default('inter'),
  }),
  blocks: z.array(blockSchema).default([]),
})

export type Block = z.infer<typeof blockSchema>
export type BlockType = Block['type']
export type SiteDocument = z.infer<typeof siteDocumentSchema>

export function defaultDocument(name: string): SiteDocument {
  return {
    seo: { title: name, description: '' },
    theme: { primaryColor: '#0f766e', font: 'inter' },
    blocks: [
      {
        id: crypto.randomUUID(),
        type: 'hero',
        props: {
          headline: name,
          subtext: '',
          imageUrl: '',
          buttonLabel: 'Contact us',
          buttonHref: '#contact',
        },
      },
      {
        id: crypto.randomUUID(),
        type: 'text',
        props: { heading: 'About us', body: '' },
      },
      {
        id: crypto.randomUUID(),
        type: 'contact',
        props: { title: 'Get in touch', buttonLabel: 'Send' },
      },
    ],
  }
}
