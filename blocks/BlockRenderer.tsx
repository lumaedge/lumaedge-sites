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
