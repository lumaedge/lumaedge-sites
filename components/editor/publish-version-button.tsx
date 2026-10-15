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
