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
