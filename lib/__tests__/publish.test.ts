import { describe, expect, it } from 'vitest'
import { assertPublishable } from '@/lib/publish'
import { defaultDocument } from '@/blocks/schema'

describe('assertPublishable', () => {
  it('returns parsed document for valid input', () => {
    const doc = defaultDocument('X')
    expect(assertPublishable(doc)).toEqual(doc)
  })

  it('throws on invalid input', () => {
    expect(() => assertPublishable({ blocks: 'nope' })).toThrow()
  })
})
