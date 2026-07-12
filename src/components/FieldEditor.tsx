import { useId, useMemo, useRef, useState, type ReactElement } from 'react'
import { Search } from 'lucide-react'
import { cn } from '../lib/utils'

export interface FieldTypeOption {
  id: string
  label: string
  icon?: ReactElement
  description?: string
  disabled?: boolean
  disabledReason?: string
}

export interface FieldEditorValue {
  name: string
  typeId: string
  description?: string
}

export interface FieldEditorProps {
  mode: 'create' | 'edit'
  initial?: Partial<FieldEditorValue>
  fieldTypes: FieldTypeOption[]
  onSave: (value: FieldEditorValue) => void | Promise<void>
  onCancel: () => void
  saving?: boolean
  error?: string
}

export function FieldEditor({
  mode,
  initial,
  fieldTypes,
  onSave,
  onCancel,
  saving = false,
  error,
}: FieldEditorProps) {
  const descriptionBaseId = useId()
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [name, setName] = useState(initial?.name ?? '')
  const [typeId, setTypeId] = useState(initial?.typeId ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [descriptionVisible, setDescriptionVisible] = useState(Boolean(initial?.description))
  const [query, setQuery] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [saveError, setSaveError] = useState<string>()
  const visibleTypes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return fieldTypes
    return fieldTypes.filter((option) => (
      option.label.toLocaleLowerCase().includes(normalized)
      || option.description?.toLocaleLowerCase().includes(normalized)
    ))
  }, [fieldTypes, query])
  const isSaving = saving || submitting
  const visibleError = error ?? saveError

  function focusOption(index: number) {
    if (visibleTypes.length === 0) return
    const wrapped = (index + visibleTypes.length) % visibleTypes.length
    optionRefs.current[wrapped]?.focus()
  }

  function selectType(option: FieldTypeOption) {
    if (option.disabled) return
    setTypeId(option.id)
    setSaveError(undefined)
  }

  async function handleSave() {
    if (isSaving || !name.trim() || !typeId) return
    setSaveError(undefined)
    setSubmitting(true)
    try {
      await onSave({
        name: name.trim(),
        typeId,
        description: description || undefined,
      })
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : 'Could not save the field')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col bg-dt-bg-secondary text-dt-text" aria-label={`${mode === 'create' ? 'Create' : 'Edit'} field`}>
      <div className="space-y-4 p-4">
        <div>
          <label htmlFor={`${descriptionBaseId}-name`} className="mb-1.5 block text-xs font-medium text-dt-muted">
            Field name
          </label>
          <input
            id={`${descriptionBaseId}-name`}
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setSaveError(undefined)
            }}
            className="h-9 w-full rounded-md border border-dt-border bg-dt-bg px-3 text-sm outline-none transition-colors focus:border-dt-primary focus:ring-1 focus:ring-dt-primary/40"
          />
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-dt-muted">Field type</span>
          <div className="relative">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dt-muted" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowDown') return
                event.preventDefault()
                focusOption(0)
              }}
              placeholder="Search field types..."
              aria-label="Search field types"
              className="h-9 w-full rounded-md border border-dt-border bg-dt-bg py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-dt-primary focus:ring-1 focus:ring-dt-primary/40"
            />
          </div>
          <div role="listbox" aria-label="Field types" className="mt-2 max-h-64 space-y-0.5 overflow-y-auto rounded-md border border-dt-border bg-dt-bg p-1">
            {visibleTypes.map((option, index) => {
              const selected = option.id === typeId
              const reasonId = `${descriptionBaseId}-reason-${index}`
              return (
                <button
                  key={option.id}
                  ref={(element) => { optionRefs.current[index] = element }}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-disabled={option.disabled || undefined}
                  aria-describedby={option.disabled && option.disabledReason ? reasonId : undefined}
                  title={option.disabled ? option.disabledReason : undefined}
                  onClick={() => selectType(option)}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      focusOption(index + 1)
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      focusOption(index - 1)
                    } else if (event.key === 'Home') {
                      event.preventDefault()
                      focusOption(0)
                    } else if (event.key === 'End') {
                      event.preventDefault()
                      focusOption(visibleTypes.length - 1)
                    } else if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      selectType(option)
                    }
                  }}
                  className={cn(
                    'flex w-full items-start gap-3 rounded px-2.5 py-2 text-left outline-none transition-colors hover:bg-dt-bg-secondary focus-visible:ring-2 focus-visible:ring-dt-primary/60',
                    selected && 'bg-dt-primary/10 text-dt-primary',
                    option.disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
                  )}
                >
                  {option.icon ? (
                    <span aria-hidden="true" className="mt-0.5 shrink-0 [&>svg]:h-4 [&>svg]:w-4">{option.icon}</span>
                  ) : null}
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{option.label}</span>
                    {option.description ? <span className="mt-0.5 block text-xs text-dt-muted">{option.description}</span> : null}
                    {option.disabled && option.disabledReason ? (
                      <span id={reasonId} className="mt-0.5 block text-xs text-dt-muted">{option.disabledReason}</span>
                    ) : null}
                  </span>
                </button>
              )
            })}
            {visibleTypes.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-dt-muted">No field types match your search.</p>
            ) : null}
          </div>
        </div>

        {descriptionVisible ? (
          <div>
            <label htmlFor={`${descriptionBaseId}-description`} className="mb-1.5 block text-xs font-medium text-dt-muted">
              Description
            </label>
            <textarea
              id={`${descriptionBaseId}-description`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="w-full resize-y rounded-md border border-dt-border bg-dt-bg px-3 py-2 text-sm outline-none transition-colors focus:border-dt-primary focus:ring-1 focus:ring-dt-primary/40"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDescriptionVisible(true)}
            className="text-left text-xs font-medium text-dt-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dt-primary/60"
          >
            Add description
          </button>
        )}

        {visibleError ? <p role="alert" className="text-xs text-dt-negative">{visibleError}</p> : null}
      </div>

      <div className="flex justify-end gap-2 border-t border-dt-border px-4 py-3">
        <button
          type="button"
          onClick={onCancel}
          className="h-8 rounded-md border border-dt-border px-3 text-xs font-medium text-dt-muted transition-colors hover:bg-dt-bg hover:text-dt-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dt-primary/60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !name.trim() || !typeId}
          className="h-8 rounded-md bg-dt-primary px-3 text-xs font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dt-primary/60"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}

FieldEditor.displayName = 'FieldEditor'
