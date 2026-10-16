export const LOCALHOST_BASE_DOMAIN = 'localhost'

export function baseDomain(): string {
  return process.env.NEXT_PUBLIC_BASE_DOMAIN ?? LOCALHOST_BASE_DOMAIN
}

export function publicSiteUrl(slug: string): string {
  const base = baseDomain()
  const isLocal = base === LOCALHOST_BASE_DOMAIN
  const scheme = isLocal ? 'http' : 'https'
  const port = isLocal ? ':3000' : ''
  return `${scheme}://${slug}.${base}${port}/`
}