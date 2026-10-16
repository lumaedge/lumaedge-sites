import { describe, expect, it, afterEach } from 'vitest'
import { publicSiteUrl } from '@/lib/urls'

const original = process.env.NEXT_PUBLIC_BASE_DOMAIN

afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_BASE_DOMAIN
  else process.env.NEXT_PUBLIC_BASE_DOMAIN = original
})

describe('publicSiteUrl', () => {
  it('adds port and http for localhost', () => {
    process.env.NEXT_PUBLIC_BASE_DOMAIN = 'localhost'
    expect(publicSiteUrl('acme')).toBe('http://acme.localhost:3000/')
  })

  it('defaults to localhost when the base domain is unset', () => {
    delete process.env.NEXT_PUBLIC_BASE_DOMAIN
    expect(publicSiteUrl('acme')).toBe('http://acme.localhost:3000/')
  })

  it('uses https and no port for a real domain', () => {
    process.env.NEXT_PUBLIC_BASE_DOMAIN = 'platform.example'
    expect(publicSiteUrl('acme')).toBe('https://acme.platform.example/')
  })
})