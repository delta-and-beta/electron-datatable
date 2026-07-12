import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FieldEditor } from './FieldEditor'

const fieldTypes = [
  { id: 'text', label: 'Text', description: 'Short written values' },
  { id: 'number', label: 'Number', description: 'Numeric values' },
  {
    id: 'computed',
    label: 'Computed',
    disabled: true,
    disabledReason: 'This type cannot be selected',
  },
]

describe('FieldEditor', () => {
  it('filters the injected catalog by label and description', () => {
    render(
      <FieldEditor mode="create" fieldTypes={fieldTypes} onSave={() => {}} onCancel={() => {}} />,
    )
    const search = screen.getByPlaceholderText('Search field types...')

    fireEvent.change(search, { target: { value: 'numeric' } })
    expect(screen.getByRole('option', { name: /Number/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Text/ })).not.toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'text' } })
    expect(screen.getByRole('option', { name: /Text/ })).toBeInTheDocument()
  })

  it('supports arrow-key navigation and selection', () => {
    render(
      <FieldEditor mode="create" fieldTypes={fieldTypes} onSave={() => {}} onCancel={() => {}} />,
    )
    const search = screen.getByPlaceholderText('Search field types...')

    search.focus()
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    expect(screen.getByRole('option', { name: /Text/ })).toHaveFocus()
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(screen.getByRole('option', { name: /Number/ })).toHaveFocus()
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' })
    expect(screen.getByRole('option', { name: /Number/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('keeps disabled types unselectable and exposes their reason', () => {
    render(
      <FieldEditor mode="edit" fieldTypes={fieldTypes} onSave={() => {}} onCancel={() => {}} />,
    )
    const option = screen.getByRole('option', { name: /Computed/ })

    expect(option).toHaveAttribute('aria-disabled', 'true')
    expect(option).toHaveAttribute('title', 'This type cannot be selected')
    expect(option).toHaveAccessibleDescription('This type cannot be selected')
    fireEvent.click(option)
    expect(option).toHaveAttribute('aria-selected', 'false')
  })

  it('reveals a description textarea and saves the exact payload', async () => {
    const onSave = vi.fn()
    render(
      <FieldEditor mode="create" fieldTypes={fieldTypes} onSave={onSave} onCancel={() => {}} />,
    )

    fireEvent.change(screen.getByLabelText('Field name'), { target: { value: 'Priority' } })
    fireEvent.click(screen.getByRole('option', { name: /Text/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add description' }))
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Used for triage' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSave).toHaveBeenCalledWith({
      name: 'Priority',
      typeId: 'text',
      description: 'Used for triage',
    })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled())
  })

  it('hydrates edit values and cancels without saving', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    render(
      <FieldEditor
        mode="edit"
        initial={{ name: 'Status', typeId: 'text', description: 'Current state' }}
        fieldTypes={fieldTypes}
        onSave={onSave}
        onCancel={onCancel}
      />,
    )

    expect(screen.getByLabelText('Field name')).toHaveValue('Status')
    expect(screen.getByRole('option', { name: /Text/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('Description')).toHaveValue('Current state')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('disables Save while saving and renders a supplied error', () => {
    render(
      <FieldEditor
        mode="create"
        initial={{ name: 'Name', typeId: 'text' }}
        fieldTypes={fieldTypes}
        onSave={() => {}}
        onCancel={() => {}}
        saving
        error="Could not save the field"
      />,
    )

    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save the field')
  })

  it('keeps the editor open and reports a rejected save', async () => {
    render(
      <FieldEditor
        mode="create"
        initial={{ name: 'Name', typeId: 'text' }}
        fieldTypes={fieldTypes}
        onSave={() => Promise.reject(new Error('Write failed'))}
        onCancel={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Write failed')
    expect(screen.getByLabelText('Field name')).toBeInTheDocument()
  })
})
