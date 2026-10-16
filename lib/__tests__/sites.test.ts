import { describe, expect, it } from 'vitest'
import { validateSlug, mapCreateError, RESERVED_SLUGS } from '@/lib/sites'
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

describe('mapCreateError', () => {
  it('maps postgrest plain-object duplicate key errors to 409', () => {
    const err = {
      message: 'duplicate key value violates unique constraint "sites_slug_key"',
      code: '23505',
    }
    expect(mapCreateError(err)).toEqual({ status: 409, error: 'Slug already in use' })
  })

  it('maps by 23505 code even when message lacks constraint name', () => {
    expect(mapCreateError({ message: 'conflicting key', code: '23505' })).toEqual({
      status: 409,
      error: 'Slug already in use',
    })
  })

  it('maps non-duplicate errors to 500 preserving the message', () => {
    expect(mapCreateError({ message: 'permission denied for table sites' })).toEqual({
      status: 500,
      error: 'permission denied for table sites',
    })
  })

  it('falls back to 500 Create failed for non-object throws', () => {
    expect(mapCreateError('boom')).toEqual({ status: 500, error: 'Create failed' })
    expect(mapCreateError(null)).toEqual({ status: 500, error: 'Create failed' })
  })

  it('still maps Error instances with duplicate key messages to 409', () => {
    const err = new Error('insert into "sites": duplicate key value violates unique constraint "sites_slug_key"')
    expect(mapCreateError(err)).toEqual({ status: 409, error: 'Slug already in use' })
  })
})
