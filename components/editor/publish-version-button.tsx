'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function PublishVersionButton({
  siteId,
  versionId,
  label,
  onBeforePublish,
}: {
  siteId: string
  versionId?: string
  label: string
  onBeforePublish?: () => Promise<void>
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onClick() {
    setLoading(true)
    setError(null)
    try {
      if (onBeforePublish) await onBeforePublish()
      const res = await fetch(`/api/sites/${siteId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(versionId ? { versionId } : {}),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: unknown } | null
        const message =
          typeof data?.error === 'string'
            ? data.error
            : res.status === 400
              ? 'This draft cannot be published'
              : 'Publish failed'
        setError(message)
        setLoading(false)
        return
      }
      setLoading(false)
      router.refresh()
    } catch {
      setError('Publish failed')
      setLoading(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button size="sm" disabled={loading} onClick={() => void onClick()}>
        {loading ? 'Publishing…' : label}
      </Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  )
}