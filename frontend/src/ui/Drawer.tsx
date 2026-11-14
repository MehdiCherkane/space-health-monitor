import { useEffect, useId, useRef, type ReactNode } from 'react'

import { Icon } from './Icon'

/**
 * Side drawer on a native modal <dialog>: the platform contains focus and handles Escape.
 * We move focus to the heading on open and return it to the opener on close.
 */
export function Drawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const openerRef = useRef<Element | null>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      openerRef.current = document.activeElement
      dialog.showModal()
      headingRef.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  // Runs on Escape (native cancel → close) and on our own close().
  const handleClose = () => {
    const opener = openerRef.current
    openerRef.current = null
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    if (open) onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className="ui-drawer"
      aria-labelledby={titleId}
      onClose={handleClose}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === dialogRef.current) dialogRef.current?.close()
      }}
    >
      <div className="ui-drawer__panel">
        <header className="ui-drawer__head">
          <h2 id={titleId} ref={headingRef} tabIndex={-1}>
            {title}
          </h2>
          <button
            type="button"
            className="ui-button ui-button--ghost"
            onClick={() => dialogRef.current?.close()}
          >
            <Icon name="close" />
            Close<span className="visually-hidden"> evidence</span>
          </button>
        </header>
        <div className="ui-drawer__body">{children}</div>
      </div>
    </dialog>
  )
}
