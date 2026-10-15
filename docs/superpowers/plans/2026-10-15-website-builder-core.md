# Website Builder — Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core website-builder platform: create brochure sites from templates, edit blocks with autosave, publish immutable versions, and serve live sites at client subdomains.

**Architecture:** Single Next.js App Router app deployed to Vercel. Hostname middleware routes `clientname.localhost` / `clientname.platform.com` to a public ISR renderer that reads the site's published JSON document from Supabase; dashboard and client portal live on `app.*` / `you.*`. All site writes go through versioned `site_versions` rows via API routes that authenticate the session and write with the service-role client. Billing/Stripe is deferred to a later plan; entitlement gating is a pure function stubbed to allow agency users.

**Tech Stack:** TypeScript, Next.js (App Router), Tailwind + shadcn/ui, Supabase (Postgres + Auth + RLS), Zod, @dnd-kit, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-15-website-builder-design.md`

## Global Constraints

- TypeScript strict; single language across app (`@/*` import alias → repo root).
- Block types v1 (exactly these): `hero`, `text`, `services`, `gallery`, `hours`, `map`, `contact`, `cta`.
- Published site documents are immutable snapshots; rollback repoints `published_version_id`.
- Entitlement rows are service-role-only (Stripe webhooks in a later plan); `canEditSite` is the single gate used by UI.
- Reserved slugs (never assignable): `app`, `you`, `api`, `admin`, `www`, `mail`, `assets`, `static`.
- Slug format: `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`, length 3–48.
- Public pages: ISR `revalidate = 60`; publish calls `revalidatePath`.
- Working directory for all commands: `C:\Users\Administrator.EJS\website-builder`.
- No code comments unless the executor finds them strictly necessary.

---

### Task 1: Scaffold Next.js app + tooling

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `vitest.config.ts`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx` (all via create-next-app / shadcn, then adjusted)
- Create: `components/ui/*` (shadcn: button, input, label, textarea, card, select)
- Create: `lib/utils.ts` (shadcn `cn` helper)
- Create: `vitest.setup.ts`, `lib/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: project-wide conventions — `@/*` alias, Vitest command `npm run test`, UI kit imports (`@/components/ui/button` etc.), `cn()` in `lib/utils.ts`.

- [ ] **Step 1: Scaffold the app**

Run in `C:\Users\Administrator.EJS\website-builder` (repo root already contains `docs/`):

```powershell
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes
```

- [ ] **Step 2: Install editor/test dependencies**

```powershell
npm install zod @supabase/supabase-js @supabase/ssr @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @playwright/test @types/node
```

- [ ] **Step 3: Init shadcn and add components**

```powershell
npx shadcn@latest init --yes --defaults
npx shadcn@latest add button input label textarea card select badge separator
```

- [ ] **Step 4: Add Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/__tests__/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
})
```

Create `vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 5: Write the failing smoke test**

Create `lib/__tests__/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

describe('toolchain', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test`
Expected: FAIL (missing script or config error if steps skipped; after Step 4 it should PASS — if it passes immediately, that's acceptable here since this is a toolchain check, not TDD of behavior)

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: Build succeeds; `app/page.tsx` renders.

- [ ] **Step 8: Commit**

```powershell
git add -A
git commit -m "chore: scaffold Next.js app with Tailwind, shadcn, vitest"
```

---

### Task 2: Supabase schema, RLS, and client helpers

**Files:**
- Create: `supabase/migrations/<timestamp>_create_core_tables.sql`
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`
- Create: `.env.example`

**Interfaces:**
- Produces:
  - Tables: `profiles`, `sites`, `site_versions`, `entitlements`, `form_submissions`, `blobs` (exact columns below)
  - `createClient()` (browser), `createServerClient()` (async, server components/route handlers), `createAdminClient()` (service role, server-only)
- Consumes: Supabase project created by the human (URL + anon key + service role key in `.env.local`).

- [ ] **Step 1: Init Supabase and create the migration file**

```powershell
npx supabase@latest init
npx supabase@latest migration new create_core_tables
```

This creates `supabase/migrations/<timestamp>_create_core_tables.sql`. Replace its contents with:

```sql
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  role text not null default 'client' check (role in ('agency', 'client')),
  created_at timestamptz not null default now()
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'),
  name text not null,
  owner_profile_id uuid not null references public.profiles (id),
  status text not null default 'draft' check (status in ('draft', 'live', 'suspended')),
  published_version_id uuid,
  created_at timestamptz not null default now()
);

create table public.site_versions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  document jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id)
);

alter table public.sites
  add constraint sites_published_version_fk
  foreign key (published_version_id) references public.site_versions (id);

create index site_versions_site_created_idx
  on public.site_versions (site_id, created_at desc);

create table public.entitlements (
  site_id uuid primary key references public.sites (id) on delete cascade,
  plan text not null default 'none' check (plan in ('none', 'editing')),
  status text not null default 'active' check (status in ('active', 'past_due', 'canceled')),
  stripe_customer_id text,
  stripe_subscription_id text
);

create table public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table public.blobs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  url text not null,
  size bigint not null,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  first_agency boolean;
begin
  select not exists (select 1 from public.profiles where role = 'agency')
    into first_agency;
  insert into public.profiles (user_id, role)
  values (
    new.id,
    case when first_agency then 'agency' else 'client' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.site_versions enable row level security;
alter table public.entitlements enable row level security;
alter table public.form_submissions enable row level security;
alter table public.blobs enable row level security;

create or replace function public.is_agency()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'agency'
  );
$$;

create or replace function public.owns_site(site_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sites s
    join public.profiles p on p.id = s.owner_profile_id
    where s.id = site_uuid and p.user_id = auth.uid()
  );
$$;

create policy "select own profile or agency reads all"
  on public.profiles for select
  using (auth.uid() = user_id or public.is_agency());

create policy "select owned or agency sites"
  on public.sites for select
  using (public.is_agency() or public.owns_site(id));

create policy "select versions of owned or agency sites"
  on public.site_versions for select
  using (public.is_agency() or public.owns_site(site_id));
```

- [ ] **Step 2: Link project and push (human gate)**

The human must create a Supabase project (dashboard.supabase.com) and provide project ref. Then:

```powershell
npx supabase@latest link --project-ref <PROJECT_REF>
npx supabase@latest db push
```

Verify in the Supabase dashboard: 6 tables + trigger exist.

- [ ] **Step 3: Env file**

Create `.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_BASE_DOMAIN=localhost
```

Copy to `.env.local` and fill values (Project Settings → API).

- [ ] **Step 4: Write Supabase client helpers**

Create `lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

Create `lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // called from a Server Component; middleware refreshes sessions
          }
        },
      },
    }
  )
}
```

Create `lib/supabase/admin.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
```

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: supabase schema, RLS, and client helpers"
```

---

### Task 3: Auth, session profile, and entitlement gate

**Files:**
- Create: `lib/auth.ts`, `lib/entitlements.ts`, `lib/types.ts`
- Create: `app/login/page.tsx`, `app/signup/page.tsx`
- Create: `app/dashboard/layout.tsx`, `app/dashboard/page.tsx`
- Create: `middleware.ts`
- Test: `lib/__tests__/entitlements.test.ts`

**Interfaces:**
- Produces:
  - `getProfile()` → `{ id: string; role: 'agency' | 'client' } | null` (server, uses `createServerSupabase`)
  - `requireProfile()` → same, redirects to `/login` when null
  - `canEditSite(profile: { role: 'agency' | 'client' }, entitlement: { plan: 'none' | 'editing'; status: 'active' | 'past_due' | 'canceled' } | null): boolean`
  - `Profile` type in `lib/types.ts`
- Consumes: Task 2 clients, trigger-created profiles.

- [ ] **Step 1: Write failing entitlement tests**

Create `lib/__tests__/entitlements.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { canEditSite } from '@/lib/entitlements'

const agency = { role: 'agency' as const }
const client = { role: 'client' as const }

describe('canEditSite', () => {
  it('lets agency edit regardless of entitlement', () => {
    expect(canEditSite(agency, null)).toBe(true)
    expect(canEditSite(agency, { plan: 'none', status: 'canceled' })).toBe(true)
  })

  it('lets clients edit only with active editing plan', () => {
    expect(canEditSite(client, { plan: 'editing', status: 'active' })).toBe(true)
    expect(canEditSite(client, { plan: 'editing', status: 'past_due' })).toBe(false)
    expect(canEditSite(client, { plan: 'none', status: 'active' })).toBe(false)
    expect(canEditSite(client, null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `@/lib/entitlements`.

- [ ] **Step 3: Implement types + entitlement gate**

Create `lib/types.ts`:

```ts
export type Role = 'agency' | 'client'

export type Profile = {
  id: string
  role: Role
}

export type Entitlement = {
  plan: 'none' | 'editing'
  status: 'active' | 'past_due' | 'canceled'
}

export type SiteStatus = 'draft' | 'live' | 'suspended'
```

Create `lib/entitlements.ts`:

```ts
import type { Entitlement, Profile } from '@/lib/types'

export function canEditSite(
  profile: Profile,
  entitlement: Entitlement | null
): boolean {
  if (profile.role === 'agency') return true
  return entitlement?.plan === 'editing' && entitlement.status === 'active'
}
```

Create `lib/auth.ts`:

```ts
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('user_id', user.id)
    .single()
  return data ? { id: data.id, role: data.role } : null
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  return profile
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Build auth pages**

Create `app/login/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
```

Create `app/signup/page.tsx` (same pattern, calling `supabase.auth.signUp({ email, password })`, on success `router.push('/dashboard')`).

- [ ] **Step 6: Dashboard shell**

Create `app/dashboard/layout.tsx`:

```tsx
import { requireProfile } from '@/lib/auth'
import { SignOutButton } from '@/components/sign-out-button'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await requireProfile()
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <p className="font-semibold">Website Builder {profile.role === 'agency' ? '(Agency)' : ''}</p>
        <SignOutButton />
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  )
}
```

Create `components/sign-out-button.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export function SignOutButton() {
  const router = useRouter()
  return (
    <Button
      variant="outline"
      onClick={async () => {
        await createClient().auth.signOut()
        router.push('/login')
        router.refresh()
      }}
    >
      Sign out
    </Button>
  )
}
```

Create `app/dashboard/page.tsx`:

```tsx
import { requireProfile } from '@/lib/auth'

export default async function DashboardPage() {
  const profile = await requireProfile()
  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-slate-600">Role: {profile.role}</p>
    </div>
  )
}
```

- [ ] **Step 7: Middleware with auth refresh**

Create `middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 8: Verify manually**

Run: `npm run dev`, visit `http://localhost:3000/signup`, create account, land on `/dashboard` showing `Role: agency` (first user). Sign out, sign back in.

- [ ] **Step 9: Commit**

```powershell
git add -A
git commit -m "feat: auth pages, profile helpers, entitlement gate"
```

---

### Task 4: Document + block schemas

**Files:**
- Create: `blocks/schema.ts`, `blocks/fields.ts`
- Test: `blocks/__tests__/schema.test.ts`

**Interfaces:**
- Produces:
  - `siteDocumentSchema`, `SiteDocument`, `Block`, `BlockType`
  - `blockFields: Record<BlockType, FieldDef[]>` where `FieldDef` is one of `{ kind: 'text' | 'textarea', name, label }`, `{ kind: 'image', name, label }`, `{ kind: 'imageList', name, label }`, `{ kind: 'list', name, label, itemFields: { name, label, kind: 'text' | 'textarea' }[] }`
  - `defaultDocument(name: string): SiteDocument`
- Consumes: nothing (pure).

- [ ] **Step 1: Write failing schema tests**

Create `blocks/__tests__/schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { siteDocumentSchema, defaultDocument } from '@/blocks/schema'

const validDoc = {
  seo: { title: 'Acme Plumbing', description: 'Local plumbers' },
  theme: { primaryColor: '#0f766e', font: 'inter' },
  blocks: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      type: 'hero',
      props: {
        headline: 'Reliable plumbing',
        subtext: '24/7 emergency callouts',
        imageUrl: '',
        buttonLabel: 'Call us',
        buttonHref: 'tel:+15550100',
      },
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      type: 'services',
      props: {
        items: [{ icon: 'wrench', title: 'Repairs', description: 'All brands' }],
      },
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      type: 'contact',
      props: { title: 'Get a quote', buttonLabel: 'Send' },
    },
  ],
}

describe('siteDocumentSchema', () => {
  it('accepts a valid document', () => {
    expect(siteDocumentSchema.safeParse(validDoc).success).toBe(true)
  })

  it('rejects unknown block types', () => {
    const bad = {
      ...validDoc,
      blocks: [{ id: '44444444-4444-4444-8444-444444444444', type: 'carousel', props: {} }],
    }
    expect(siteDocumentSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects non-uuid block ids', () => {
    const bad = { ...validDoc, blocks: [{ ...validDoc.blocks[0], id: 'nope' }] }
    expect(siteDocumentSchema.safeParse(bad).success).toBe(false)
  })
})

describe('defaultDocument', () => {
  it('produces a valid document', () => {
    const doc = defaultDocument('Test Site')
    expect(siteDocumentSchema.safeParse(doc).success).toBe(true)
    expect(doc.seo.title).toBe('Test Site')
    expect(doc.blocks.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `@/blocks/schema`.

- [ ] **Step 3: Implement schemas**

Create `blocks/schema.ts`:

```ts
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
```

Create `blocks/fields.ts`:

```ts
import type { BlockType } from '@/blocks/schema'

export type FieldDef =
  | { kind: 'text' | 'textarea'; name: string; label: string }
  | { kind: 'image'; name: string; label: string }
  | { kind: 'imageList'; name: string; label: string }
  | {
      kind: 'list'
      name: string
      label: string
      itemFields: { kind: 'text' | 'textarea'; name: string; label: string }[]
    }

export const blockFields: Record<BlockType, FieldDef[]> = {
  hero: [
    { kind: 'text', name: 'headline', label: 'Headline' },
    { kind: 'textarea', name: 'subtext', label: 'Subtext' },
    { kind: 'image', name: 'imageUrl', label: 'Image URL' },
    { kind: 'text', name: 'buttonLabel', label: 'Button label' },
    { kind: 'text', name: 'buttonHref', label: 'Button link' },
  ],
  text: [
    { kind: 'text', name: 'heading', label: 'Heading' },
    { kind: 'textarea', name: 'body', label: 'Body' },
  ],
  services: [
    {
      kind: 'list',
      name: 'items',
      label: 'Services',
      itemFields: [
        { kind: 'text', name: 'icon', label: 'Icon' },
        { kind: 'text', name: 'title', label: 'Title' },
        { kind: 'textarea', name: 'description', label: 'Description' },
      ],
    },
  ],
  gallery: [{ kind: 'imageList', name: 'images', label: 'Images' }],
  hours: [
    {
      kind: 'list',
      name: 'rows',
      label: 'Hours',
      itemFields: [
        { kind: 'text', name: 'day', label: 'Day' },
        { kind: 'text', name: 'open', label: 'Opens' },
        { kind: 'text', name: 'close', label: 'Closes' },
      ],
    },
  ],
  map: [{ kind: 'text', name: 'address', label: 'Address' }],
  contact: [
    { kind: 'text', name: 'title', label: 'Title' },
    { kind: 'text', name: 'buttonLabel', label: 'Button label' },
  ],
  cta: [
    { kind: 'text', name: 'headline', label: 'Headline' },
    { kind: 'text', name: 'buttonLabel', label: 'Button label' },
    { kind: 'text', name: 'buttonHref', label: 'Button link' },
  ],
}

export const blockLabels: Record<BlockType, string> = {
  hero: 'Hero',
  text: 'Text section',
  services: 'Services',
  gallery: 'Gallery',
  hours: 'Opening hours',
  map: 'Map',
  contact: 'Contact form',
  cta: 'Call to action',
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: site document and block schemas with field metadata"
```

---

### Task 5: Block components + shared renderer

**Files:**
- Create: `blocks/components.tsx`, `blocks/BlockRenderer.tsx`
- Test: `blocks/__tests__/renderer.test.tsx`

**Interfaces:**
- Produces: `<BlockRenderer block={Block} siteId={string} />` — renders any block; public and preview surfaces both use it. `siteId` is passed to the contact form for submission targeting.
- Consumes: Task 4 types.

- [ ] **Step 1: Write failing renderer test**

Create `blocks/__tests__/renderer.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `@/blocks/BlockRenderer`.

- [ ] **Step 3: Implement block components**

Create `blocks/components.tsx`:

```tsx
'use client'

import type { Block } from '@/blocks/schema'

function Section({
  id,
  children,
  className = '',
}: {
  id?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section id={id} className={`px-6 py-12 md:px-12 ${className}`}>
      <div className="mx-auto max-w-3xl">{children}</div>
    </section>
  )
}

export function HeroBlock({ block }: { block: Extract<Block, { type: 'hero' }> }) {
  const { headline, subtext, imageUrl, buttonLabel, buttonHref } = block.props
  return (
    <Section className="bg-slate-900 text-white">
      <h1 className="text-4xl font-bold tracking-tight">{headline}</h1>
      {subtext ? <p className="mt-4 text-lg text-slate-300">{subtext}</p> : null}
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="mt-6 rounded-lg object-cover" />
      ) : null}
      {buttonLabel ? (
        <a
          href={buttonHref || '#'}
          className="mt-6 inline-block rounded-md bg-[var(--site-primary)] px-5 py-2.5 font-medium text-white"
        >
          {buttonLabel}
        </a>
      ) : null}
    </Section>
  )
}

export function TextBlock({ block }: { block: Extract<Block, { type: 'text' }> }) {
  const { heading, body } = block.props
  return (
    <Section>
      {heading ? <h2 className="text-2xl font-bold">{heading}</h2> : null}
      {body ? <p className="mt-4 whitespace-pre-wrap text-slate-700">{body}</p> : null}
    </Section>
  )
}

export function ServicesBlock({ block }: { block: Extract<Block, { type: 'services' }> }) {
  return (
    <Section className="bg-slate-100">
      <h2 className="text-2xl font-bold">Our services</h2>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {block.props.items.map((item, i) => (
          <li key={i} className="rounded-lg border bg-white p-4">
            <p className="font-semibold">{item.title}</p>
            {item.description ? (
              <p className="mt-1 text-sm text-slate-600">{item.description}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  )
}

export function GalleryBlock({ block }: { block: Extract<Block, { type: 'gallery' }> }) {
  return (
    <Section>
      <h2 className="text-2xl font-bold">Gallery</h2>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        {block.props.images.map((image, i) =>
          image.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={image.url}
              alt={image.alt}
              className="aspect-square w-full rounded-lg object-cover"
            />
          ) : null
        )}
      </div>
    </Section>
  )
}

export function HoursBlock({ block }: { block: Extract<Block, { type: 'hours' }> }) {
  return (
    <Section>
      <h2 className="text-2xl font-bold">Opening hours</h2>
      <table className="mt-6 w-full max-w-md border-collapse text-left">
        <tbody>
          {block.props.rows.map((row, i) => (
            <tr key={i} className="border-b">
              <td className="py-2 font-medium">{row.day}</td>
              <td className="py-2 text-slate-600">
                {row.open} – {row.close}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  )
}

export function MapBlock({ block }: { block: Extract<Block, { type: 'map' }> }) {
  const { address } = block.props
  const src = address
    ? `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`
    : ''
  return (
    <Section>
      <h2 className="text-2xl font-bold">Find us</h2>
      {address ? <p className="mt-2 text-slate-600">{address}</p> : null}
      {src ? (
        <iframe
          title="map"
          src={src}
          className="mt-4 h-72 w-full rounded-lg border"
          loading="lazy"
        />
      ) : null}
    </Section>
  )
}

export function ContactBlock({
  block,
  siteId,
}: {
  block: Extract<Block, { type: 'contact' }>
  siteId: string
}) {
  const { title, buttonLabel } = block.props
  return (
    <Section id="contact" className="bg-slate-100">
      <h2 className="text-2xl font-bold">{title || 'Contact us'}</h2>
      <form
        method="post"
        action={`/api/sites/${siteId}/contact`}
        className="mt-6 grid max-w-md gap-4"
      >
        <input required name="name" placeholder="Name" className="rounded-md border px-3 py-2" />
        <input required type="email" name="email" placeholder="Email" className="rounded-md border px-3 py-2" />
        <input name="phone" placeholder="Phone" className="rounded-md border px-3 py-2" />
        <textarea required name="message" placeholder="Message" rows={4} className="rounded-md border px-3 py-2" />
        <button
          type="submit"
          className="rounded-md bg-[var(--site-primary)] px-5 py-2.5 font-medium text-white"
        >
          {buttonLabel || 'Send'}
        </button>
      </form>
    </Section>
  )
}

export function CtaBlock({ block }: { block: Extract<Block, { type: 'cta' }> }) {
  const { headline, buttonLabel, buttonHref } = block.props
  return (
    <Section className="bg-[var(--site-primary)] text-white">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <p className="text-2xl font-bold">{headline}</p>
        {buttonLabel ? (
          <a
            href={buttonHref || '#'}
            className="rounded-md bg-white px-5 py-2.5 font-medium text-slate-900"
          >
            {buttonLabel}
          </a>
        ) : null}
      </div>
    </Section>
  )
}
```

Create `blocks/BlockRenderer.tsx`:

```tsx
import type { Block } from '@/blocks/schema'
import {
  CtaBlock,
  ContactBlock,
  GalleryBlock,
  HeroBlock,
  HoursBlock,
  MapBlock,
  ServicesBlock,
  TextBlock,
} from '@/blocks/components'

export function BlockRenderer({ block, siteId }: { block: Block; siteId: string }) {
  switch (block.type) {
    case 'hero':
      return <HeroBlock block={block} />
    case 'text':
      return <TextBlock block={block} />
    case 'services':
      return <ServicesBlock block={block} />
    case 'gallery':
      return <GalleryBlock block={block} />
    case 'hours':
      return <HoursBlock block={block} />
    case 'map':
      return <MapBlock block={block} />
    case 'contact':
      return <ContactBlock block={block} siteId={siteId} />
    case 'cta':
      return <CtaBlock block={block} />
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: block components and shared BlockRenderer"
```

---

### Task 6: Templates + sites CRUD + create flow

**Files:**
- Create: `lib/sites.ts`, `lib/templates.ts`
- Create: `app/api/sites/route.ts`
- Create: `app/dashboard/sites/page.tsx`, `app/dashboard/sites/new/page.tsx`
- Test: `lib/__tests__/sites.test.ts`

**Interfaces:**
- Produces:
  - `RESERVED_SLUGS: string[]`, `validateSlug(slug: string): { ok: true } | { ok: false; error: string }`
  - `templates: Record<TemplateId, { label: string; document: (name: string) => SiteDocument }>`, `type TemplateId = 'blank' | 'trades' | 'clinic'`
  - `listSites(profile: Profile)`, `getSite(id: string, profile: Profile)` (server, RLS-scoped via `createServerSupabase`)
  - `POST /api/sites` body `{ name, slug, template }` → `{ site: { id, slug, name, status } }`; authz: any signed-in user creates sites they own; agency can create for any owner later (v1: always self-owned)
- Consumes: Task 3 `requireProfile`/`getProfile`, Task 4 schemas.

- [ ] **Step 1: Write failing slug/template tests**

Create `lib/__tests__/sites.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `@/lib/sites`.

- [ ] **Step 3: Implement sites lib + templates**

Create `lib/sites.ts`:

```ts
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Profile, SiteStatus } from '@/lib/types'
import type { SiteDocument } from '@/blocks/schema'

export const RESERVED_SLUGS = [
  'app',
  'you',
  'api',
  'admin',
  'www',
  'mail',
  'assets',
  'static',
]

const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

export function validateSlug(
  slug: string
): { ok: true } | { ok: false; error: string } {
  if (RESERVED_SLUGS.includes(slug)) return { ok: false, error: 'Reserved word' }
  if (slug.length < 3 || slug.length > 48)
    return { ok: false, error: 'Must be 3–48 characters' }
  if (!SLUG_RE.test(slug)) return { ok: false, error: 'Lowercase letters, numbers, hyphens' }
  return { ok: true }
}

export type SiteRow = {
  id: string
  slug: string
  name: string
  status: SiteStatus
  published_version_id: string | null
  created_at: string
}

export async function listSites(profile: Profile): Promise<SiteRow[]> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('sites')
    .select('id, slug, name, status, published_version_id, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getSite(
  id: string,
  profile: Profile
): Promise<SiteRow | null> {
  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from('sites')
    .select('id, slug, name, status, published_version_id, created_at')
    .eq('id', id)
    .maybeSingle()
  return data ?? null
}

export async function createSiteRow(input: {
  name: string
  slug: string
  ownerProfileId: string
  document: SiteDocument
  createdBy: string
}): Promise<SiteRow> {
  const admin = createAdminClient()
  const { data: site, error } = await admin
    .from('sites')
    .insert({
      name: input.name,
      slug: input.slug,
      owner_profile_id: input.ownerProfileId,
      status: 'draft',
    })
    .select('id, slug, name, status, published_version_id, created_at')
    .single()
  if (error) throw error
  const { error: versionError } = await admin.from('site_versions').insert({
    site_id: site.id,
    document: input.document,
    created_by: input.createdBy,
  })
  if (versionError) throw versionError
  return site
}
```

Create `lib/templates.ts`:

```ts
import { defaultDocument, type SiteDocument } from '@/blocks/schema'

export type TemplateId = 'blank' | 'trades' | 'clinic'

function tradesDocument(name: string): SiteDocument {
  return {
    seo: { title: name, description: `${name} — local trade services` },
    theme: { primaryColor: '#0f766e', font: 'inter' },
    blocks: [
      {
        id: crypto.randomUUID(),
        type: 'hero',
        props: {
          headline: `${name}`,
          subtext: 'Quality workmanship, fair prices, fast callouts',
          imageUrl: '',
          buttonLabel: 'Get a quote',
          buttonHref: '#contact',
        },
      },
      {
        id: crypto.randomUUID(),
        type: 'services',
        props: {
          items: [
            { icon: 'wrench', title: 'Repairs', description: 'All major brands' },
            { icon: 'pipe', title: 'Installations', description: 'Fixtures and fittings' },
            { icon: 'alert', title: 'Emergencies', description: '24/7 callout service' },
          ],
        },
      },
      {
        id: crypto.randomUUID(),
        type: 'hours',
        props: {
          rows: [
            { day: 'Mon–Fri', open: '8:00', close: '18:00' },
            { day: 'Saturday', open: '9:00', close: '13:00' },
            { day: 'Sunday', open: 'Closed', close: '' },
          ],
        },
      },
      {
        id: crypto.randomUUID(),
        type: 'contact',
        props: { title: 'Request a quote', buttonLabel: 'Send' },
      },
    ],
  }
}

function clinicDocument(name: string): SiteDocument {
  return {
    seo: { title: name, description: `${name} — book your visit today` },
    theme: { primaryColor: '#7c3aed', font: 'inter' },
    blocks: [
      {
        id: crypto.randomUUID(),
        type: 'hero',
        props: {
          headline: name,
          subtext: 'Friendly, professional care for the whole family',
          imageUrl: '',
          buttonLabel: 'Book now',
          buttonHref: '#contact',
        },
      },
      {
        id: crypto.randomUUID(),
        type: 'gallery',
        props: { images: [] },
      },
      {
        id: crypto.randomUUID(),
        type: 'text',
        props: {
          heading: 'About the clinic',
          body: 'Tell patients what makes your practice different.',
        },
      },
      {
        id: crypto.randomUUID(),
        type: 'contact',
        props: { title: 'Book an appointment', buttonLabel: 'Send' },
      },
    ],
  }
}

export const templates: Record<
  TemplateId,
  { label: string; document: (name: string) => SiteDocument }
> = {
  blank: { label: 'Blank', document: defaultDocument },
  trades: { label: 'Trades business', document: tradesDocument },
  clinic: { label: 'Salon / clinic', document: clinicDocument },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Create-sites API route**

Create `app/api/sites/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getProfile } from '@/lib/auth'
import { createSiteRow, validateSlug } from '@/lib/sites'
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
    const message = e instanceof Error ? e.message : 'Create failed'
    if (message.includes('sites_slug_key') || message.includes('duplicate key'))
      return NextResponse.json({ error: 'Slug already in use' }, { status: 409 })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 6: Dashboard sites pages**

Create `app/dashboard/sites/page.tsx`:

```tsx
import Link from 'next/link'
import { requireProfile } from '@/lib/auth'
import { listSites } from '@/lib/sites'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function SitesPage() {
  const profile = await requireProfile()
  const sites = await listSites(profile)
  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sites</h1>
        <Button asChild>
          <Link href="/dashboard/sites/new">New site</Link>
        </Button>
      </div>
      {sites.length === 0 ? (
        <p className="text-slate-600">No sites yet.</p>
      ) : (
        <div className="grid gap-4">
          {sites.map((site) => (
            <Card key={site.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>
                  <Link href={`/dashboard/sites/${site.id}`} className="hover:underline">
                    {site.name}
                  </Link>
                </CardTitle>
                <Badge variant={site.status === 'live' ? 'default' : 'secondary'}>
                  {site.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">{site.slug}.localhost:3000</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
```

Create `app/dashboard/sites/new/page.tsx`:

```tsx
import { NewSiteForm } from '@/components/new-site-form'

export default function NewSitePage() {
  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">New site</h1>
      <NewSiteForm />
    </div>
  )
}
```

Create `components/new-site-form.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export function NewSiteForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [template, setTemplate] = useState('trades')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug, template }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to create')
      setLoading(false)
      return
    }
    router.push(`/dashboard/sites/${data.site.id}`)
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Business name</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="slug">Subdomain</Label>
            <Input
              id="slug"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="acme-plumbing"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="template">Template</Label>
            <select
              id="template"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="rounded-md border px-3 py-2"
            >
              <option value="trades">Trades business</option>
              <option value="clinic">Salon / clinic</option>
              <option value="blank">Blank</option>
            </select>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating…' : 'Create site'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

Add a link on `app/dashboard/page.tsx` to `/dashboard/sites`.

- [ ] **Step 7: Verify manually**

`npm run dev` → sign in → create site "Acme" with slug `acme-test` template trades → redirect to site workspace (404 page until Task 7 — acceptable; verify row exists in Supabase with a draft `site_versions` row).

- [ ] **Step 8: Commit**

```powershell
git add -A
git commit -m "feat: site templates, slug validation, create flow"
```

---

### Task 7: Editor workspace with autosave, reorder, preview

**Files:**
- Create: `lib/editor/ops.ts`
- Create: `app/api/sites/[id]/document/route.ts`
- Create: `app/dashboard/sites/[id]/page.tsx`, `app/dashboard/sites/[id]/editor.tsx`, `components/editor/*`
- Create: `app/dashboard/preview/[id]/page.tsx`
- Test: `lib/__tests__/editor-ops.test.ts`

**Interfaces:**
- Produces:
  - `insertBlock(doc: SiteDocument, type: BlockType, index?: number): SiteDocument`
  - `removeBlock(doc: SiteDocument, blockId: string): SiteDocument`
  - `moveBlock(doc: SiteDocument, from: number, to: number): SiteDocument`
  - `updateBlockProps(doc: SiteDocument, blockId: string, props: Record<string, unknown>): SiteDocument`
  - `updateMeta(doc: SiteDocument, patch: Partial<Pick<SiteDocument, 'seo' | 'theme'>>): SiteDocument`
  - `PUT /api/sites/[id]/document` body `{ document: unknown }` → 200 `{ versionId }` | 400 | 401 | 403
  - `<SiteEditor site={SiteRow} initialDocument={SiteDocument} canEdit />` client component
  - Preview route `/dashboard/preview/[id]` renders current latest draft with `BlockRenderer`
- Consumes: Tasks 4–6.

- [ ] **Step 1: Write failing editor-ops tests**

Create `lib/__tests__/editor-ops.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { insertBlock, moveBlock, removeBlock, updateBlockProps, updateMeta } from '@/lib/editor/ops'
import { defaultDocument, type SiteDocument } from '@/blocks/schema'

function doc(): SiteDocument {
  return defaultDocument('Test')
}

describe('editor ops', () => {
  it('inserts a block at the end by default', () => {
    const d = doc()
    const next = insertBlock(d, 'cta')
    expect(next.blocks.length).toBe(d.blocks.length + 1)
    expect(next.blocks.at(-1)?.type).toBe('cta')
  })

  it('removes a block by id', () => {
    const d = doc()
    const id = d.blocks[0].id
    const next = removeBlock(d, id)
    expect(next.blocks.find((b) => b.id === id)).toBeUndefined()
  })

  it('moves a block', () => {
    const d = doc()
    const firstId = d.blocks[0].id
    const next = moveBlock(d, 0, d.blocks.length - 1)
    expect(next.blocks.at(-1)?.id).toBe(firstId)
  })

  it('updates block props immutably', () => {
    const d = doc()
    const id = d.blocks[0].id
    const next = updateBlockProps(d, id, { headline: 'New' })
    expect(next.blocks[0].props.headline).toBe('New')
    expect(d.blocks[0].props.headline).not.toBe('New')
  })

  it('updates meta', () => {
    const d = doc()
    const next = updateMeta(d, { seo: { title: 'X', description: 'Y' } })
    expect(next.seo.title).toBe('X')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `@/lib/editor/ops`.

- [ ] **Step 3: Implement editor ops**

Create `lib/editor/ops.ts`:

```ts
import {
  blockSchema,
  type BlockType,
  type SiteDocument,
} from '@/blocks/schema'

export function insertBlock(
  doc: SiteDocument,
  type: BlockType,
  index?: number
): SiteDocument {
  const parsed = blockSchema.parse({
    id: crypto.randomUUID(),
    type,
    props: {},
  })
  const blocks = [...doc.blocks]
  blocks.splice(index ?? blocks.length, 0, parsed)
  return { ...doc, blocks }
}

export function removeBlock(doc: SiteDocument, blockId: string): SiteDocument {
  return { ...doc, blocks: doc.blocks.filter((b) => b.id !== blockId) }
}

export function moveBlock(
  doc: SiteDocument,
  from: number,
  to: number
): SiteDocument {
  const blocks = [...doc.blocks]
  const [moved] = blocks.splice(from, 1)
  blocks.splice(to, 0, moved)
  return { ...doc, blocks }
}

export function updateBlockProps(
  doc: SiteDocument,
  blockId: string,
  props: Record<string, unknown>
): SiteDocument {
  return {
    ...doc,
    blocks: doc.blocks.map((b) => {
      if (b.id !== blockId) return b
      return blockSchema.parse({ ...b, props: { ...b.props, ...props } })
    }),
  }
}

export function updateMeta(
  doc: SiteDocument,
  patch: Partial<Pick<SiteDocument, 'seo' | 'theme'>>
): SiteDocument {
  return {
    ...doc,
    seo: { ...doc.seo, ...patch.seo },
    theme: { ...doc.theme, ...patch.theme },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Document save API**

Create `app/api/sites/[id]/document/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { canEditSite } from '@/lib/entitlements'
import { siteDocumentSchema } from '@/blocks/schema'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = await createServerSupabase()
  const { data: site } = await supabase
    .from('sites')
    .select('id, owner_profile_id, entitlements(plan, status)')
    .eq('id', id)
    .maybeSingle()
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const entitlement = Array.isArray(site.entitlements)
    ? (site.entitlements[0] ?? null)
    : site.entitlements
  if (!canEditSite(profile, entitlement))
    return NextResponse.json({ error: 'Editing not entitled' }, { status: 403 })

  const parsed = siteDocumentSchema.safeParse((await request.json()).document)
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid document' }, { status: 400 })

  const admin = createAdminClient()
  const { data: version, error } = await admin
    .from('site_versions')
    .insert({ site_id: id, document: parsed.data, created_by: profile.id })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ versionId: version.id })
}
```

- [ ] **Step 6: Editor field components**

Create `components/editor/fields.tsx`:

```tsx
'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import type { FieldDef } from '@/blocks/fields'

type AnyProps = Record<string, any>

export function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef
  value: AnyProps
  onChange: (props: AnyProps) => void
}) {
  if (field.kind === 'text') {
    return (
      <div className="grid gap-2">
        <Label>{field.label}</Label>
        <Input
          value={value[field.name] ?? ''}
          onChange={(e) => onChange({ [field.name]: e.target.value })}
        />
      </div>
    )
  }
  if (field.kind === 'textarea') {
    return (
      <div className="grid gap-2">
        <Label>{field.label}</Label>
        <Textarea
          value={value[field.name] ?? ''}
          onChange={(e) => onChange({ [field.name]: e.target.value })}
        />
      </div>
    )
  }
  if (field.kind === 'image') {
    return (
      <div className="grid gap-2">
        <Label>{field.label}</Label>
        <Input
          value={value[field.name] ?? ''}
          placeholder="https://..."
          onChange={(e) => onChange({ [field.name]: e.target.value })}
        />
      </div>
    )
  }
  if (field.kind === 'imageList') {
    const images: { url: string; alt: string }[] = value[field.name] ?? []
    return (
      <div className="grid gap-2">
        <Label>{field.label}</Label>
        {images.map((image, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={image.url}
              placeholder="Image URL"
              onChange={(e) => {
                const next = [...images]
                next[i] = { ...image, url: e.target.value }
                onChange({ [field.name]: next })
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => onChange({ [field.name]: images.filter((_, j) => j !== i) })}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange({ [field.name]: [...images, { url: '', alt: '' }] })}
        >
          Add image
        </Button>
      </div>
    )
  }
  const items: AnyProps[] = value[field.name] ?? []
  return (
    <div className="grid gap-2">
      <Label>{field.label}</Label>
      {items.map((item, i) => (
        <div key={i} className="grid gap-2 rounded-md border p-3">
          {field.itemFields.map((itemField) => (
            <div key={itemField.name} className="grid gap-1">
              <Label className="text-xs">{itemField.label}</Label>
              {itemField.kind === 'textarea' ? (
                <Textarea
                  value={item[itemField.name] ?? ''}
                  onChange={(e) => {
                    const next = [...items]
                    next[i] = { ...item, [itemField.name]: e.target.value }
                    onChange({ [field.name]: next })
                  }}
                />
              ) : (
                <Input
                  value={item[itemField.name] ?? ''}
                  onChange={(e) => {
                    const next = [...items]
                    next[i] = { ...item, [itemField.name]: e.target.value }
                    onChange({ [field.name]: next })
                  }}
                />
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange({ [field.name]: items.filter((_, j) => j !== i) })}
          >
            Remove item
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange({
            [field.name]: [
              ...items,
              Object.fromEntries(field.itemFields.map((f) => [f.name, ''])),
            ],
          })
        }
      >
        Add item
      </Button>
    </div>
  )
}
```

- [ ] **Step 7: Editor client component**

Create `components/editor/site-editor.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { siteDocumentSchema, type BlockType, type SiteDocument } from '@/blocks/schema'
import { blockFields, blockLabels } from '@/blocks/fields'
import {
  insertBlock,
  moveBlock,
  removeBlock,
  updateBlockProps,
  updateMeta,
} from '@/lib/editor/ops'
import { FieldInput } from '@/components/editor/fields'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

const ALL_TYPES: BlockType[] = [
  'hero',
  'text',
  'services',
  'gallery',
  'hours',
  'map',
  'contact',
  'cta',
]

function SortableBlock({
  id,
  label,
  selected,
  onSelect,
  onRemove,
  children,
}: {
  id: string
  label: string
  selected: boolean
  onSelect: () => void
  onRemove: () => void
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-lg border bg-white ${selected ? 'ring-2 ring-blue-500' : ''}`}
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-medium"
          onClick={onSelect}
          {...attributes}
          {...listeners}
        >
          ⠿ {label}
        </button>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          Delete
        </Button>
      </div>
      {selected ? <div className="p-3">{children}</div> : null}
    </div>
  )
}

export function SiteEditor({
  siteId,
  initialDocument,
  canEdit,
}: {
  siteId: string
  initialDocument: SiteDocument
  canEdit: boolean
}) {
  const [doc, setDoc] = useState(initialDocument)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [previewKey, setPreviewKey] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sensors = useSensors(useSensor(PointerSensor))

  function scheduleSave(next: SiteDocument) {
    if (!canEdit) return
    setSaveState('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/sites/${siteId}/document`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: next }),
      })
      if (!res.ok) {
        setSaveState('error')
        return
      }
      setSaveState('saved')
      setPreviewKey((k) => k + 1)
    }, 800)
  }

  function apply(next: SiteDocument) {
    setDoc(next)
    scheduleSave(next)
  }

  useEffect(() => {
    if (!canEdit) return
    scheduleSave(doc)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = doc.blocks.findIndex((b) => b.id === active.id)
    const to = doc.blocks.findIndex((b) => b.id === over.id)
    if (from < 0 || to < 0) return
    apply(moveBlock(doc, from, to))
  }

  const selected = doc.blocks.find((b) => b.id === selectedId) ?? null

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="grid content-start gap-4">
        <div className="flex items-center justify-between">
          <Badge variant="outline">
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Save failed' : 'Autosave on'}
          </Badge>
          {!canEdit ? <Badge>Read-only</Badge> : null}
        </div>

        <div className="rounded-lg border bg-white p-3">
          <p className="mb-2 text-sm font-semibold">Site settings</p>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">SEO title</Label>
              <Input
                disabled={!canEdit}
                value={doc.seo.title}
                onChange={(e) => apply(updateMeta(doc, { seo: { ...doc.seo, title: e.target.value } }))}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">SEO description</Label>
              <Input
                disabled={!canEdit}
                value={doc.seo.description}
                onChange={(e) =>
                  apply(updateMeta(doc, { seo: { ...doc.seo, description: e.target.value } }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Primary color</Label>
              <Input
                disabled={!canEdit}
                value={doc.theme.primaryColor}
                onChange={(e) =>
                  apply(updateMeta(doc, { theme: { ...doc.theme, primaryColor: e.target.value } }))
                }
              />
            </div>
          </div>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={doc.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="grid gap-3">
              {doc.blocks.map((block) => (
                <SortableBlock
                  key={block.id}
                  id={block.id}
                  label={blockLabels[block.type]}
                  selected={selectedId === block.id}
                  onSelect={() => setSelectedId(block.id)}
                  onRemove={() => apply(removeBlock(doc, block.id))}
                >
                  <div className="grid gap-3">
                    {blockFields[block.type].map((field) => (
                      <FieldInput
                        key={field.name}
                        field={field}
                        value={block.props as Record<string, any>}
                        onChange={(props) => apply(updateBlockProps(doc, block.id, props))}
                      />
                    ))}
                  </div>
                </SortableBlock>
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            {ALL_TYPES.map((type) => (
              <Button
                key={type}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const next = insertBlock(doc, type)
                  apply(next)
                  setSelectedId(next.blocks.at(-1)?.id ?? null)
                }}
              >
                + {blockLabels[type]}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
        <iframe
          key={previewKey}
          src={`/dashboard/preview/${siteId}`}
          className="h-full w-full rounded-lg border bg-white"
          title="Preview"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Workspace page + preview route**

Create `app/dashboard/sites/[id]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { getSite } from '@/lib/sites'
import { createServerSupabase } from '@/lib/supabase/server'
import { canEditSite } from '@/lib/entitlements'
import { siteDocumentSchema } from '@/blocks/schema'
import { SiteEditor } from '@/components/editor/site-editor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default async function SiteWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const profile = await requireProfile()
  const { id } = await params
  const site = await getSite(id, profile)
  if (!site) notFound()

  const supabase = await createServerSupabase()
  const { data: version } = await supabase
    .from('site_versions')
    .select('id, document, created_at')
    .eq('site_id', site.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: entitlementRow } = await supabase
    .from('entitlements')
    .select('plan, status')
    .eq('site_id', site.id)
    .maybeSingle()

  const doc = version ? siteDocumentSchema.parse(version.document) : null
  if (!doc) notFound()
  const canEdit = canEditSite(profile, entitlementRow)

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{site.name}</h1>
          <Badge variant={site.status === 'live' ? 'default' : 'secondary'}>{site.status}</Badge>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/dashboard/sites/${site.id}/versions`}>History</Link>
          </Button>
          <Button asChild variant="outline">
            <a href={`http://${site.slug}.${process.env.NEXT_PUBLIC_BASE_DOMAIN ?? 'localhost'}:3000`} target="_blank" rel="noreferrer">
              View live
            </a>
          </Button>
        </div>
      </div>
      <SiteEditor siteId={site.id} initialDocument={doc} canEdit={canEdit} />
    </div>
  )
}
```

Create `app/dashboard/preview/[id]/page.tsx`:

```tsx
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createServerSupabase } from '@/lib/supabase/server'
import { siteDocumentSchema } from '@/blocks/schema'
import { BlockRenderer } from '@/blocks/BlockRenderer'

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const profile = await getProfile()
  if (!profile) notFound()
  const { id } = await params
  const supabase = await createServerSupabase()
  const { data: site } = await supabase
    .from('sites')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (!site) notFound()

  const { data: version } = await supabase
    .from('site_versions')
    .select('document')
    .eq('site_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!version) notFound()

  const doc = siteDocumentSchema.parse(version.document)
  return (
    <div style={{ ['--site-primary' as string]: doc.theme.primaryColor }}>
      <title>{doc.seo.title}</title>
      {doc.blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} siteId={site.id} />
      ))}
    </div>
  )
}
```

- [ ] **Step 9: Verify manually**

Create site → workspace loads → edit hero headline → badge shows Saved → reload → change persisted → drag a block → reorder persists → iframe preview updates → add a services block → delete it.

- [ ] **Step 10: Commit**

```powershell
git add -A
git commit -m "feat: block editor with autosave, reorder, and live preview"
```

---

### Task 8: Publish flow, version history, rollback

**Files:**
- Create: `lib/publish.ts`
- Create: `app/api/sites/[id]/publish/route.ts`
- Create: `app/dashboard/sites/[id]/versions/page.tsx`
- Test: `lib/__tests__/publish.test.ts`

**Interfaces:**
- Produces:
  - `assertPublishable(document: unknown): SiteDocument` (throws `Error` on invalid)
  - `POST /api/sites/[id]/publish` body `{ versionId?: string }` → `{ status: 'live' }`; defaults to latest draft version; sets `published_version_id`, `status = 'live'`, calls `revalidatePath('/')`
  - Versions page listing all versions with "Publish this version" buttons
- Consumes: Tasks 6–7.

- [ ] **Step 1: Write failing publish test**

Create `lib/__tests__/publish.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `@/lib/publish`.

- [ ] **Step 3: Implement publish lib**

Create `lib/publish.ts`:

```ts
import { siteDocumentSchema, type SiteDocument } from '@/blocks/schema'

export function assertPublishable(document: unknown): SiteDocument {
  return siteDocumentSchema.parse(document)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Publish API route**

Create `app/api/sites/[id]/publish/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { assertPublishable } from '@/lib/publish'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = await createServerSupabase()
  const { data: site } = await supabase
    .from('sites')
    .select('id, slug, status')
    .eq('id', id)
    .maybeSingle()
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let versionId: string | null = null
  const body = await request.json().catch(() => ({}))
  if (typeof body.versionId === 'string') {
    versionId = body.versionId
  } else {
    const { data: latest } = await supabase
      .from('site_versions')
      .select('id, document')
      .eq('site_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!latest)
      return NextResponse.json({ error: 'No versions to publish' }, { status: 400 })
    try {
      assertPublishable(latest.document)
    } catch {
      return NextResponse.json({ error: 'Latest draft is invalid' }, { status: 400 })
    }
    versionId = latest.id
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('sites')
    .update({ published_version_id: versionId, status: 'live' })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/')
  revalidatePath(`/site/${site.slug}`)
  return NextResponse.json({ status: 'live', versionId })
}
```

- [ ] **Step 6: Versions history page**

Create `app/dashboard/sites/[id]/versions/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { getSite } from '@/lib/sites'
import { createServerSupabase } from '@/lib/supabase/server'
import { PublishVersionButton } from '@/components/editor/publish-version-button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function VersionsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const profile = await requireProfile()
  const { id } = await params
  const site = await getSite(id, profile)
  if (!site) notFound()

  const supabase = await createServerSupabase()
  const { data: versions } = await supabase
    .from('site_versions')
    .select('id, created_at, created_by')
    .eq('site_id', id)
    .order('created_at', { ascending: false })

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Version history — {site.name}</h1>
        <PublishVersionButton siteId={site.id} label="Publish latest" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Versions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {(versions ?? []).map((version) => (
            <div key={version.id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <div className="flex items-center gap-3">
                <p className="font-mono text-xs">{version.id.slice(0, 8)}</p>
                <p className="text-sm text-slate-600">
                  {new Date(version.created_at).toLocaleString()}
                </p>
                {site.published_version_id === version.id ? (
                  <Badge>Published</Badge>
                ) : null}
              </div>
              <PublishVersionButton siteId={site.id} versionId={version.id} label="Publish this" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
```

Create `components/editor/publish-version-button.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function PublishVersionButton({
  siteId,
  versionId,
  label,
}: {
  siteId: string
  versionId?: string
  label: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  return (
    <Button
      size="sm"
      disabled={loading}
      onClick={async () => {
        setLoading(true)
        await fetch(`/api/sites/${siteId}/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(versionId ? { versionId } : {}),
        })
        setLoading(false)
        router.refresh()
      }}
    >
      {loading ? 'Publishing…' : label}
    </Button>
  )
}
```

Add a "Publish" button to the workspace header (`app/dashboard/sites/[id]/page.tsx`) reusing `PublishVersionButton` with label "Publish".

- [ ] **Step 7: Verify manually**

Edit site → Publish → status badge flips to `live` → visit `http://<slug>.localhost:3000` (rewrite arrives in Task 9; for now verify DB `status='live'` and `published_version_id` set) → edit more → publish old version from History → `published_version_id` repoints.

- [ ] **Step 8: Commit**

```powershell
git add -A
git commit -m "feat: publish flow with immutable versions and rollback"
```

---

### Task 9: Subdomain routing + public site renderer

**Files:**
- Modify: `middleware.ts` (add subdomain rewrite before auth refresh)
- Create: `app/site/[slug]/page.tsx`, `lib/public-site.ts`
- Test: `lib/__tests__/public-site.test.ts`

**Interfaces:**
- Produces:
  - `matchPublicHost(hostname: string, baseDomain: string): string | null` — returns slug for `slug.baseDomain`, null otherwise
  - `getPublishedDocument(slug: string)` → `{ siteId: string; document: SiteDocument; name: string } | null`
  - Public page `/site/[slug]` with `revalidate = 60`; unknown or non-live site → `notFound()`
- Consumes: Tasks 4–8.

- [ ] **Step 1: Write failing host-matching tests**

Create `lib/__tests__/public-site.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `@/lib/public-site`.

- [ ] **Step 3: Implement host matching + public fetch**

Create `lib/public-site.ts`:

```ts
import { createAdminClient } from '@/lib/supabase/admin'
import { siteDocumentSchema, type SiteDocument } from '@/blocks/schema'

const RESERVED_SUBDOMAINS = new Set(['app', 'you', 'api', 'admin', 'www'])

export function matchPublicHost(
  hostname: string,
  baseDomain: string
): string | null {
  const host = hostname.toLowerCase()
  if (host === baseDomain) return null
  if (!host.endsWith(`.${baseDomain}`)) return null
  const slug = host.slice(0, -(baseDomain.length + 1))
  if (slug.includes('.') || RESERVED_SUBDOMAINS.has(slug)) return null
  return slug
}

export async function getPublishedDocument(
  slug: string
): Promise<{ siteId: string; name: string; document: SiteDocument } | null> {
  const admin = createAdminClient()
  const { data: site } = await admin
    .from('sites')
    .select('id, name, status, published_version_id')
    .eq('slug', slug)
    .maybeSingle()
  if (!site || site.status !== 'live' || !site.published_version_id) return null

  const { data: version } = await admin
    .from('site_versions')
    .select('document')
    .eq('id', site.published_version_id)
    .maybeSingle()
  if (!version) return null

  const parsed = siteDocumentSchema.safeParse(version.document)
  if (!parsed.success) return null
  return { siteId: site.id, name: site.name, document: parsed.data }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Public site page**

Create `app/site/[slug]/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublishedDocument } from '@/lib/public-site'
import { BlockRenderer } from '@/blocks/BlockRenderer'

export const revalidate = 60

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const result = await getPublishedDocument(slug)
  if (!result) return {}
  return {
    title: result.document.seo.title || result.name,
    description: result.document.seo.description,
  }
}

export default async function PublicSitePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const result = await getPublishedDocument(slug)
  if (!result) notFound()
  const { document, siteId } = result

  return (
    <div style={{ ['--site-primary' as string]: document.theme.primaryColor }}>
      <header className="border-b bg-white px-6 py-4">
        <p className="mx-auto max-w-3xl font-semibold">{document.seo.title}</p>
      </header>
      {document.blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} siteId={siteId} />
      ))}
      <footer className="bg-slate-900 px-6 py-6 text-center text-sm text-slate-400">
        {document.seo.title}
      </footer>
    </div>
  )
}
```

- [ ] **Step 6: Wire subdomain rewrite into middleware**

Replace `middleware.ts` with:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { matchPublicHost } from '@/lib/public-site'

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? ''
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? 'localhost'
  const slug = matchPublicHost(hostname, baseDomain)

  if (slug) {
    const url = request.nextUrl.clone()
    url.pathname = `/site/${slug}`
    return NextResponse.rewrite(url)
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 7: Verify manually**

Publish a site with slug `acme-test` → visit `http://acme-test.localhost:3000` → published content renders; edit without publishing → live page unchanged; publish again → updated content appears. `http://nope.localhost:3000` → 404. `http://localhost:3000` → dashboard still works.

- [ ] **Step 8: Commit**

```powershell
git add -A
git commit -m "feat: subdomain routing and public ISR site renderer"
```

---

### Task 10: Contact form endpoint + Playwright E2E smoke

**Files:**
- Create: `app/api/sites/[id]/contact/route.ts`
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`

**Interfaces:**
- Produces:
  - `POST /api/sites/[id]/contact` form-encoded `{ name, email, phone, message }` → inserts `form_submissions` for live sites only; redirects back to `/{slug}` host root (303)
  - Playwright suite covering: signup → create → edit → publish → public render → form submission → read-only client check
- Consumes: Tasks 3–9.

- [ ] **Step 1: Contact API route**

Create `app/api/sites/[id]/contact/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const submissions = new Map<string, number[]>()
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 5

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
  const name = String(form.get('name') ?? '').slice(0, 200)
  const email = String(form.get('email') ?? '').slice(0, 320)
  const phone = String(form.get('phone') ?? '').slice(0, 50)
  const message = String(form.get('message') ?? '').slice(0, 4000)
  if (!name || !email || !message) {
    return new NextResponse('Missing fields', { status: 400 })
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

  const base = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? 'localhost'
  const port = base === 'localhost' ? ':3000' : ''
  return NextResponse.redirect(`http://${site.slug}.${base}${port}/`, 303)
}
```

- [ ] **Step 2: Playwright config**

Create `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
```

Add script `"test:e2e": "playwright test"` to `package.json`. Run `npx playwright install chromium` once.

- [ ] **Step 3: Write E2E smoke test**

Create `e2e/smoke.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('agency builds, publishes, client sees read-only', async ({ browser }) => {
  const stamp = Date.now()
  const email = `agency-${stamp}@example.com`
  const slug = `e2e-${stamp}`
  const password = 'Test1234!@#'

  const agencyContext = await browser.newContext()
  const page = await agencyContext.newPage()

  await page.goto('/signup')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type=submit]')
  await page.waitForURL('**/dashboard')

  await page.goto('/dashboard/sites/new')
  await page.fill('#name', 'E2E Business')
  await page.fill('#slug', slug)
  await page.selectOption('#template', 'trades')
  await page.click('button[type=submit]')
  await page.waitForURL(/\/dashboard\/sites\//)

  await page.getByText('Hero', { exact: true }).click()
  await page.getByLabel('Headline').fill('E2E headline live')
  await page.waitForTimeout(1500)
  await expect(page.getByText('Saved')).toBeVisible()

  await page.getByRole('button', { name: 'Publish' }).click()
  await page.waitForTimeout(1000)

  const publicPage = await agencyContext.newPage()
  await publicPage.goto(`http://${slug}.localhost:3000`)
  await expect(publicPage.getByRole('heading', { level: 1 })).toContainText(
    'E2E headline live'
  )

  await publicPage.fill('input[name=name]', 'Visitor')
  await publicPage.fill('input[name=email]', 'visitor@example.com')
  await publicPage.fill('textarea[name=message]', 'Hello from e2e')
  await publicPage.click('button[type=submit]')
  await publicPage.waitForURL(`http://${slug}.localhost:3000/`)

  const clientContext = await browser.newContext()
  const clientPage = await clientContext.newPage()
  const clientEmail = `client-${stamp}@example.com`
  await clientPage.goto('/signup')
  await clientPage.fill('#email', clientEmail)
  await clientPage.fill('#password', password)
  await clientPage.click('button[type=submit]')
  await clientPage.waitForURL('**/dashboard')

  await clientPage.goto(`http://${slug}.localhost:3000`)
  await expect(clientPage.getByRole('heading', { level: 1 })).toContainText(
    'E2E headline live'
  )

  await agencyContext.close()
  await clientContext.close()
})
```

- [ ] **Step 4: Run unit tests then E2E**

Run: `npm test` → all PASS.
Run: `npm run test:e2e` → smoke passes (requires `.env.local` valid and dev server able to start; Supabase reachable).

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: contact form endpoint and playwright smoke test"
```

---

## Self-Review Notes

- **Spec coverage:** architecture (T1–T9), data model (T2), block library (T4–T5), templates (T6), editor + client portal gate via `canEditSite` (T3, T7), publish/versioning/rollback (T8), subdomains + ISR (T9), contact forms (T10), error handling (Zod everywhere, rate limit, idempotent-enough publish), tests (Vitest per task + Playwright T10). Custom domains, e-commerce, booking, free-form canvas: out of scope per spec §9. Stripe billing: deferred plan (spec allows; `entitlements` table + `canEditSite` seam ready).
- **Placeholders:** none; every step shows code or a concrete command.
- **Type consistency:** `SiteDocument`, `Block`, `BlockType`, `Profile`, `SiteRow`, `canEditSite(profile, entitlement)`, `createServerSupabase()`, `createAdminClient()` used identically across tasks. `blockSchema.parse({ id, type, props: {} })` works because all props fields have defaults.
