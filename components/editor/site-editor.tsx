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
import { type BlockType, type SiteDocument } from '@/blocks/schema'
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
                        value={block.props as Record<string, unknown>}
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
