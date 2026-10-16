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
