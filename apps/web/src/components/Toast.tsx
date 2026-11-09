import { useSyncExternalStore } from 'react'

const TOAST_MS = 4000

type ShownToast = { id: number; message: string }

let shown: ShownToast | null = null
let nextId = 1
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function publish(next: ShownToast | null) {
  shown = next
  for (const listener of listeners) listener()
}

/** One short confirmation, from anywhere. A newer one replaces it. */
export function toast(message: string) {
  clearTimeout(timer)
  publish({ id: nextId++, message })
  timer = setTimeout(() => publish(null), TOAST_MS)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Mounted once, in the root. */
export function Toaster() {
  const current = useSyncExternalStore(subscribe, () => shown, () => null)
  if (current == null) return null
  return (
    <div key={current.id} className="app-toast" role="status">
      {current.message}
    </div>
  )
}
