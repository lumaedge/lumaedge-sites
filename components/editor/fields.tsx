'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import type { FieldDef } from '@/blocks/fields'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>

export function FieldInput({
  field,
  value,
  onChange,
  disabled = false,
}: {
  field: FieldDef
  value: AnyProps
  onChange: (props: AnyProps) => void
  disabled?: boolean
}) {
  if (field.kind === 'text') {
    return (
      <div className="grid gap-2">
        <Label>{field.label}</Label>
        <Input
          disabled={disabled}
          value={value[field.name] ?? ''}
          onChange={(e) => onChange({ [field.name]: e.target.value })}
        />
      </div>
    )
  }
  if (field.kind === 'textarea') {
    return (
      <div className="grid gap-2">
        <Label>{field.label}</Label>
        <Textarea
          disabled={disabled}
          value={value[field.name] ?? ''}
          onChange={(e) => onChange({ [field.name]: e.target.value })}
        />
      </div>
    )
  }
  if (field.kind === 'image') {
    return (
      <div className="grid gap-2">
        <Label>{field.label}</Label>
        <Input
          disabled={disabled}
          value={value[field.name] ?? ''}
          placeholder="https://..."
          onChange={(e) => onChange({ [field.name]: e.target.value })}
        />
      </div>
    )
  }
  if (field.kind === 'imageList') {
    const images: { url: string; alt: string }[] = value[field.name] ?? []
    return (
      <div className="grid gap-2">
        <Label>{field.label}</Label>
        {images.map((image, i) => (
          <div key={i} className="flex gap-2">
            <Input
              disabled={disabled}
              value={image.url}
              placeholder="Image URL"
              onChange={(e) => {
                const next = [...images]
                next[i] = { ...image, url: e.target.value }
                onChange({ [field.name]: next })
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => onChange({ [field.name]: images.filter((_, j) => j !== i) })}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => onChange({ [field.name]: [...images, { url: '', alt: '' }] })}
        >
          Add image
        </Button>
      </div>
    )
  }
  if (field.kind !== 'list') return null
  const items: AnyProps[] = value[field.name] ?? []
  return (
    <div className="grid gap-2">
      <Label>{field.label}</Label>
      {items.map((item, i) => (
        <div key={i} className="grid gap-2 rounded-md border p-3">
          {field.itemFields.map((itemField) => (
            <div key={itemField.name} className="grid gap-1">
              <Label className="text-xs">{itemField.label}</Label>
              {itemField.kind === 'textarea' ? (
                <Textarea
                  disabled={disabled}
                  value={item[itemField.name] ?? ''}
                  onChange={(e) => {
                    const next = [...items]
                    next[i] = { ...item, [itemField.name]: e.target.value }
                    onChange({ [field.name]: next })
                  }}
                />
              ) : (
                <Input
                  disabled={disabled}
                  value={item[itemField.name] ?? ''}
                  onChange={(e) => {
                    const next = [...items]
                    next[i] = { ...item, [itemField.name]: e.target.value }
                    onChange({ [field.name]: next })
                  }}
                />
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onChange({ [field.name]: items.filter((_, j) => j !== i) })}
          >
            Remove item
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() =>
          onChange({
            [field.name]: [
              ...items,
              Object.fromEntries(field.itemFields.map((f) => [f.name, ''])),
            ],
          })
        }
      >
        Add item
      </Button>
    </div>
  )
}
