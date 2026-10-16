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
