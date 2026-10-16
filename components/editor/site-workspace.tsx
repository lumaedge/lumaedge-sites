'use client'

import { useCallback, useRef, type ReactNode } from 'react'
import type { SiteDocument } from '@/blocks/schema'
import { SiteEditor, type FlushPendingChanges } from '@/components/editor/site-editor'
import { PublishVersionButton } from '@/components/editor/publish-version-button'

export function SiteWorkspace({
  siteId,
  initialDocument,
  canEdit,
  publishLabel = 'Publish',
  title,
  actions,
}: {
  siteId: string
  initialDocument: SiteDocument
  canEdit: boolean
  publishLabel?: string
  title?: ReactNode
  actions?: ReactNode
}) {
  const flushRef = useRef<FlushPendingChanges | null>(null)

  const onFlushReady = useCallback((flush: FlushPendingChanges) => {
    flushRef.current = flush
  }, [])

  const flush = useCallback(async () => {
    if (flushRef.current) await flushRef.current()
  }, [])

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        {title}
        <div className="flex gap-2">
          {actions}
          <PublishVersionButton
            siteId={siteId}
            label={publishLabel}
            onBeforePublish={flush}
          />
        </div>
      </div>
      <SiteEditor
        siteId={siteId}
        initialDocument={initialDocument}
        canEdit={canEdit}
        onFlushReady={onFlushReady}
      />
    </>
  )
}