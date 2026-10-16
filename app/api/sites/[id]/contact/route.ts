import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { publicSiteUrl } from '@/lib/urls'

const submissions = new Map<string, number[]>()
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 5
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, '')
}

function rateLimited(key: string): boolean {
  const now = Date.now()
  const hits = (submissions.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  if (hits.length >= MAX_PER_WINDOW) return true
  hits.push(now)
  submissions.set(key, hits)
  return false
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  if (rateLimited(`${id}:${ip}`)) {
    return new NextResponse('Too many submissions', { status: 429 })
  }

  const form = await request.formData()
  const name = stripTags(String(form.get('name') ?? '')).slice(0, 200)
  const email = stripTags(String(form.get('email') ?? '')).slice(0, 320)
  const phone = stripTags(String(form.get('phone') ?? '')).slice(0, 50)
  const message = stripTags(String(form.get('message') ?? '')).slice(0, 4000)
  if (!name || !email || !message) {
    return new NextResponse('Missing fields', { status: 400 })
  }
  if (!EMAIL_RE.test(email)) {
    return new NextResponse('Invalid email', { status: 400 })
  }

  const admin = createAdminClient()
  const { data: site } = await admin
    .from('sites')
    .select('id, status, slug')
    .eq('id', id)
    .maybeSingle()
  if (!site || site.status !== 'live') {
    return new NextResponse('Not available', { status: 404 })
  }

  const { error } = await admin.from('form_submissions').insert({
    site_id: id,
    name,
    email,
    phone: phone || null,
    message,
  })
  if (error) return new NextResponse('Failed', { status: 500 })

  return NextResponse.redirect(publicSiteUrl(site.slug), 303)
}
