import { siteDocumentSchema, type SiteDocument } from '@/blocks/schema'

export function assertPublishable(document: unknown): SiteDocument {
  return siteDocumentSchema.parse(document)
}
