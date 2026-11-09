import { useSyncExternalStore } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog.tsx'

type ConfirmOptions = {
  title: string
  body?: string
  confirmLabel: string
  /** Paints the confirming button red: it erases something. */
  destructive?: boolean
}

type PendingConfirm = ConfirmOptions & { resolve: (answer: boolean) => void }

let pending: PendingConfirm | null = null
const listeners = new Set<() => void>()

function publish(next: PendingConfirm | null) {
  pending = next
  for (const listener of listeners) listener()
}

function settle(answer: boolean) {
  pending?.resolve(answer)
  publish(null)
}

/**
 * `window.confirm`, in the product's own dialog: `if (await confirmDialog({…})) …`.
 * Resolves false on Cancelar, Escape or the overlay. A second question answers
 * the first with no rather than leaving it hanging.
 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  settle(false)
  return new Promise((resolve) => publish({ ...options, resolve }))
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Mounted once, in the root. */
export function ConfirmDialogHost() {
  const current = useSyncExternalStore(subscribe, () => pending, () => null)
  return (
    <Dialog
      open={current != null}
      onOpenChange={(open) => {
        if (!open) settle(false)
      }}
    >
      <DialogContent
        showCloseButton={false}
        // Without a body there is nothing to describe the dialog with.
        {...(current?.body == null ? { 'aria-describedby': undefined } : {})}
      >
        <DialogTitle>{current?.title}</DialogTitle>
        {current?.body != null ? <DialogDescription>{current.body}</DialogDescription> : null}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => settle(false)}>
            Cancelar
          </button>
          <button
            type="button"
            className={`btn-primary${current?.destructive === true ? ' btn-danger' : ''}`}
            onClick={() => settle(true)}
          >
            {current?.confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
