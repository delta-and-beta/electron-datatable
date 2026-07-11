import { useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Popover } from './Popover'

const triggerRect = {
  x: 100,
  y: 500,
  top: 500,
  right: 180,
  bottom: 532,
  left: 100,
  width: 80,
  height: 32,
  toJSON: () => ({}),
}

const panelRect = {
  x: 0,
  y: 0,
  top: 0,
  right: 300,
  bottom: 200,
  left: 0,
  width: 300,
  height: 200,
  toJSON: () => ({}),
}

let resizeCallback: ResizeObserverCallback

class ResizeObserverMock {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback
  }

  observe = vi.fn()
  disconnect = vi.fn()
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function UncontrolledPopover() {
  return (
    <div data-testid="owner">
      <Popover
        trigger={<button>Open menu</button>}
        aria-label="Test menu"
        contentClassName="w-[300px]"
      >
        <button>First action</button>
      </Popover>
    </div>
  )
}

describe('Popover', () => {
  it('portals content to document.body and focuses its first control', () => {
    render(<UncontrolledPopover />)

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))

    const dialog = screen.getByRole('dialog', { name: 'Test menu' })
    expect(dialog.parentNode).toBe(document.body)
    expect(screen.getByRole('button', { name: 'First action' })).toHaveFocus()
    expect(screen.getByTestId('owner')).not.toContainElement(dialog)
  })

  it('flips upward when the preferred position overflows the viewport bottom', () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        return this.getAttribute('role') === 'dialog' ? panelRect : triggerRect
      })

    render(<UncontrolledPopover />)
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))

    expect(screen.getByRole('dialog')).toHaveStyle({ top: '296px' })
    rectSpy.mockRestore()
  })

  it('aligns right then clamps left when the panel overflows the viewport right edge', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 250 })
    const narrowTrigger = { ...triggerRect, left: 220, right: 240, width: 20 }
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        return this.getAttribute('role') === 'dialog' ? panelRect : narrowTrigger
      })

    render(<UncontrolledPopover />)
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))

    expect(screen.getByRole('dialog')).toHaveStyle({ left: '8px' })
    rectSpy.mockRestore()
  })

  it('re-measures on scroll, resize, and content resize', () => {
    let currentTriggerRect = { ...triggerRect, top: 100, bottom: 132, left: 100, right: 180 }
    let currentPanelRect = { ...panelRect, height: 100 }
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        return this.getAttribute('role') === 'dialog' ? currentPanelRect : currentTriggerRect
      })

    render(<UncontrolledPopover />)
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveStyle({ left: '100px', top: '136px' })

    currentTriggerRect = { ...currentTriggerRect, left: 140, right: 220, top: 120, bottom: 152 }
    fireEvent.scroll(window)
    expect(dialog).toHaveStyle({ left: '140px', top: '156px' })

    currentTriggerRect = { ...currentTriggerRect, left: 180, right: 260 }
    fireEvent.resize(window)
    expect(dialog).toHaveStyle({ left: '180px' })

    currentPanelRect = { ...currentPanelRect, height: 500 }
    act(() => resizeCallback([], {} as ResizeObserver))
    expect(dialog).toHaveStyle({ top: '8px' })
  })

  it('closes on Escape and restores focus to the trigger', () => {
    render(<UncontrolledPopover />)
    const trigger = screen.getByRole('button', { name: 'Open menu' })
    fireEvent.click(trigger)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes on an outside mousedown but ignores the trigger and panel', () => {
    render(
      <div>
        <UncontrolledPopover />
        <button>Outside</button>
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))

    fireEvent.mouseDown(screen.getByRole('button', { name: 'First action' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('supports controlled open state', () => {
    function ControlledPopover() {
      const [open, setOpen] = useState(false)
      return (
        <Popover
          open={open}
          onOpenChange={setOpen}
          trigger={<button>Controlled trigger</button>}
          aria-label="Controlled menu"
        >
          <button>Controlled action</button>
        </Popover>
      )
    }

    render(<ControlledPopover />)
    fireEvent.click(screen.getByRole('button', { name: 'Controlled trigger' }))
    expect(screen.getByRole('dialog', { name: 'Controlled menu' })).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
