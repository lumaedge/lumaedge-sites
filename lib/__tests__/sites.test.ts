import { describe, expect, it } from 'vitest'
import { validateSlug, RESERVED_SLUGS } from '@/lib/sites'
import { siteDocumentSchema } from '@/blocks/schema'
import { templates } from '@/lib/templates'

describe('validateSlug', () => {
  it('accepts valid slugs', () => {
    expect(validateSlug('acme-plumbing')).toEqual({ ok: true })
  })

  it('rejects reserved words', () => {
    expect(RESERVED_SLUGS).toContain('app')
    expect(validateSlug('app').ok).toBe(false)
  })

  it('rejects invalid formats', () => {
    expect(validateSlug('-nope').ok).toBe(false)
    expect(validateSlug('No Spaces').ok).toBe(false)
    expect(validateSlug('ab').ok).toBe(false)
  })
})

describe('templates', () => {
  it('every template produces a valid document', () => {
    for (const template of Object.values(templates)) {
      const doc = template.document('Test Business')
      expect(siteDocumentSchema.safeParse(doc).success).toBe(true)
    }
  })
})
