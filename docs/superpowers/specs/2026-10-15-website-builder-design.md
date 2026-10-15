# Custom Website Builder — Design Spec

**Date:** 2026-10-15
**Status:** Approved (design); awaiting spec review
**Path:** Architectural (new project)

## 1. Purpose & business model

A custom website builder used as an agency product to sell brochure websites to small businesses.

- **Agency (us):** builds each client site from templates in the dashboard.
- **Clients:** pay a **setup fee + monthly recurring fee**. Monthly fee covers hosting; **editor access is a paid tier** (paywall).
- **Sites (v1):** brochure only — home, services, about/gallery, hours, map, contact form.
- **Deferred (explicitly out of v1):** e-commerce, booking/scheduling, blogs, free-form drag-and-drop canvas, custom-domain automation (subdomains first).

## 2. Success criteria

- We can create a client site from a template, edit it, publish it, and it is live at `clientname.platform.com` within minutes.
- A client without an active `editing` entitlement sees a read-only view; with it, they can edit content fields.
- Contact-form submissions from a live site appear in the platform inbox.
- Stripe webhooks alone control entitlement state (no manual DB edits).

## 3. Decisions made during brainstorming

| Topic | Decision |
|---|---|
| Editor users | Hybrid — agency builds first; clients get optional paid editing |
| Site features | Brochure sites only |
| Stack | TypeScript, Next.js (App Router) |
| Pricing | Setup fee + monthly subscription |
| Builder approach | Structured block-based builder (Approach A), not free-form canvas |
| Hosting | Vercel (single deployment) |
| Domains | Subdomains first (`clientname.platform.com`); custom domains deferred |
| Data/auth | Supabase (Postgres + Auth + RLS) |
| Billing | Stripe (subscriptions + webhooks) |
| Email | Resend (contact-form notifications) |
| Image storage | Vercel Blob (signed uploads) |
| UI kit | Tailwind + shadcn/ui |

## 4. Architecture

One Next.js app, one Vercel deployment, three surfaces distinguished by route + hostname:

- `you.platform.com` — **agency dashboard**: manage clients, sites, billing oversight, form submissions.
- `app.platform.com` — **client portal**: their site, billing status, gated editing.
- `clientname.platform.com` — **public site**: middleware rewrites to an internal `/site/[siteId]` route that renders the site's published JSON via the shared block renderer, cached with ISR.

### Key mechanics

1. **Middleware** (`middleware.ts`) inspects the hostname:
   - known client subdomain → rewrite to public renderer route
   - `app` / `you` / apex / anything else → dashboard app
   - unknown subdomain → 404
2. **Publish flow:** validate document (Zod) → insert immutable `site_versions` row → set `sites.published_version_id` → `revalidatePath`. Rollback = repoint `published_version_id` to an older version. Published sites are immutable snapshots; draft edits never affect the live site.
3. **Entitlements** are rows in Supabase written only by Stripe webhooks: `plan ∈ {none, editing}` × `status ∈ {active, past_due, canceled}`. The editor UI renders edit controls only when plan is `editing` and status is `active`. The agency account bypasses gates.
4. **Contact forms** post to a platform API route: sanitize → rate-limit per site → insert `form_submissions` → email notification via Resend (to agency and, if configured, the client).
5. **Images** upload to Vercel Blob via signed URLs requested from the dashboard; `blobs` table tracks usage per site.
6. **Custom domains (future):** same renderer; middleware maps additional hostnames to sites. No redesign needed.

### Repo layout

```
/app                 dashboard routes (agency + client portal)
/app/site            public site renderer (middleware rewrite target)
/blocks              block components + Zod prop schemas + editor field defs
/lib                 supabase clients, entitlement checks, publish logic, stripe
/docs                specs and plans
```

## 5. Data model (Supabase/Postgres)

```
profiles
  id, user_id → auth.users, role ('agency'|'client'), created_at

sites
  id, slug (unique subdomain), name, owner_profile_id → profiles,
  status ('draft'|'live'|'suspended'), published_version_id → site_versions

site_versions
  id, site_id → sites, document jsonb, created_at, created_by
  -- immutable; every autosave inserts a new row

entitlements
  site_id → sites (unique), plan ('none'|'editing'),
  status ('active'|'past_due'|'canceled'),
  stripe_customer_id, stripe_subscription_id
  -- written only by Stripe webhooks

form_submissions
  id, site_id → sites, name, email, phone, message, created_at, read_at

blobs
  id, site_id → sites, url, size, created_at
```

### Document schema (JSONB in `site_versions.document`)

```jsonc
{
  "seo": { "title": "...", "description": "..." },
  "theme": { "primaryColor": "#...", "font": "..." },
  "blocks": [
    { "id": "uuid", "type": "hero", "props": { ... } }
  ]
}
```

Block types (v1): `hero`, `text`, `services`, `gallery`, `hours`, `map`, `contact`, `cta`.
Document-level: header/footer config and SEO (not blocks).

### RLS policies

- Clients read/write only rows for sites they own (`owner_profile_id` matches their profile).
- `site_versions` writes go through a server-side publish/save path with entitlement checks; no direct client inserts.
- `entitlements` are writable only by the service role (Stripe webhook handler).
- Agency role reads all rows.

### Constraints

- Slugs checked against reserved words (`app`, `you`, `api`, `admin`, ...) at creation.
- Slug changes are discouraged in v1 (subdomain is the public URL).

## 6. Components & editor experience

### Block library

Each block = Zod props schema + renderer component + editor form definition. The editor auto-generates forms from schemas (shadcn fields), so a new block type requires no editor framework code.

- `hero` — headline, subtext, image, button
- `text` — headings, paragraphs, links
- `services` — list of {icon, title, description}
- `gallery` — image grid (Blob uploads)
- `hours` — weekly hours table
- `map` — address → embedded map
- `contact` — form fields → `form_submissions`
- `cta` — banner + button

### Shared renderer

One `BlockRenderer` component renders the published document for the public site and the draft document inside the editor preview iframe. Preview and production cannot drift.

### Agency dashboard

- Clients list → sites list → site workspace
- Template picker (start with 2–3 templates: trades, salon/clinic, restaurant)
- Section list: drag-reorder, add, remove, edit
- Live preview iframe (draft), auto-refresh on save
- Autosave (debounced new `site_versions` row), Publish button, version history + rollback
- Form submissions inbox

### Client portal

Same workspace component with restricted editing: content fields (text, images, hours) editable when entitlement allows; layout/theme fields hidden without `plan='editing'`. Billing status badge; otherwise read-only live view.

## 7. Error handling

- Zod validation gates save and publish; publish button shows inline validation errors.
- Stripe webhook handler is idempotent (guarded by Stripe event id) and is the only writer of `entitlements`.
- Form-submission API sanitizes inputs and rate-limits per site.
- Unknown subdomain → 404; suspended site → 404 or notice page (decide during implementation; default 404).
- Blob uploads validated for type/size before signed URL issuance.

## 8. Testing

- **Vitest:** block schema validation, publish flow logic, entitlement gating, slug reservation.
- **Playwright smoke:** create site from template → edit content → publish → public page renders at subdomain route; client without `editing` plan sees read-only UI; form submission appears in inbox.

## 9. Out of scope (v1)

- Custom-domain purchase/automation (deferred; architecture leaves room)
- E-commerce, booking, blogs
- Free-form drag-and-drop / per-element styling
- Multi-site-per-client billing complexity (one site per client assumed; schema allows more)
- Client-side domain management UI

## 10. Open items for implementation planning

- Template content specifics (copy, imagery) per industry
- Exact Resend email templates and notification targets
- Whether suspended sites show a notice page or plain 404
- Stripe price IDs and setup-fee invoicing flow details
