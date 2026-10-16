import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getProfile } from '@/lib/auth'
import { createSiteRow, mapCreateError, validateSlug } from '@/lib/sites'
import { templates, type TemplateId } from '@/lib/templates'
import { defaultDocument } from '@/blocks/schema'

const bodySchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(3).max(48),
  template: z.enum(['blank', 'trades', 'clinic']),
})

export async function POST(request: Request) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (profile.role !== 'agency')
    return NextResponse.json({ error: 'Only agency users can create sites' }, { status: 403 })

  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { name, slug, template } = parsed.data
  const slugCheck = validateSlug(slug)
  if (!slugCheck.ok)
    return NextResponse.json({ error: slugCheck.error }, { status: 400 })

  const doc = (templates[template as TemplateId] ?? { document: defaultDocument }).document(name)

  try {
    const site = await createSiteRow({
      name,
      slug,
      ownerProfileId: profile.id,
      document: doc,
      createdBy: profile.id,
    })
    return NextResponse.json({ site }, { status: 201 })
  } catch (e) {
    const { status, error } = mapCreateError(e)
    return NextResponse.json({ error }, { status })
  }
}
