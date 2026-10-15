import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BlockRenderer } from '@/blocks/BlockRenderer'
import type { Block } from '@/blocks/schema'

describe('BlockRenderer', () => {
  it('renders hero headline', () => {
    const block: Block = {
      id: '11111111-1111-4111-8111-111111111111',
      type: 'hero',
      props: {
        headline: 'Hello trades',
        subtext: 'We fix things',
        imageUrl: '',
        buttonLabel: 'Call',
        buttonHref: 'tel:123',
      },
    }
    const html = renderToStaticMarkup(<BlockRenderer block={block} siteId="site-1" />)
    expect(html).toContain('Hello trades')
    expect(html).toContain('We fix things')
  })

  it('renders contact form with site id', () => {
    const block: Block = {
      id: '22222222-2222-4222-8222-222222222222',
      type: 'contact',
      props: { title: 'Contact us', buttonLabel: 'Send' },
    }
    const html = renderToStaticMarkup(<BlockRenderer block={block} siteId="site-abc" />)
    expect(html).toContain('Contact us')
    expect(html).toContain('site-abc')
  })
})
