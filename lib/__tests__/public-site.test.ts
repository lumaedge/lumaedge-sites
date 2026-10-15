import { describe, expect, it } from 'vitest'
import { matchPublicHost } from '@/lib/public-site'

describe('matchPublicHost', () => {
  it('extracts slug from client subdomain', () => {
    expect(matchPublicHost('acme.localhost', 'localhost')).toBe('acme')
    expect(matchPublicHost('acme.example.com', 'example.com')).toBe('acme')
  })

  it('returns null for base domain and reserved subdomains', () => {
    expect(matchPublicHost('localhost', 'localhost')).toBeNull()
    expect(matchPublicHost('app.localhost', 'localhost')).toBeNull()
    expect(matchPublicHost('you.example.com', 'example.com')).toBeNull()
  })

  it('returns null for unrelated hosts', () => {
    expect(matchPublicHost('evil.com', 'example.com')).toBeNull()
  })
})
