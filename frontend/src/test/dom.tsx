/** Minimal DOM test helpers on react-dom + jsdom (no extra testing library). */
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// jsdom has no <dialog> modal API; this stub only tracks `open` and fires `close`.
// Real focus containment and Escape are verified in the browser.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => undefined

export interface Rendered {
  container: HTMLElement
  root: Root
  rerender(ui: ReactNode): Promise<void>
  unmount(): void
}

export async function render(ui: ReactNode): Promise<Rendered> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => root.render(ui))
  return {
    container,
    root,
    rerender: async (next) => {
      await act(async () => root.render(next))
    },
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

export function text(element: Element | null): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim()
}

export function buttonByText(container: ParentNode, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => text(candidate) === label || text(candidate).startsWith(label),
  )
  if (!button) throw new Error(`No button "${label}"`)
  return button as HTMLButtonElement
}

export async function click(element: Element) {
  await act(async () => {
    ;(element as HTMLElement).click()
  })
}

/** Set a controlled input's value the way React listens for it. */
export async function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  await act(async () => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

/** Let pending promises (mocked API calls) settle inside act. */
export async function flush(times = 5) {
  for (let index = 0; index < times; index += 1) {
    await act(async () => {
      await Promise.resolve()
    })
  }
}
