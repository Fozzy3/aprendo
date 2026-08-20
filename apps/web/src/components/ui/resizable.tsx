import { useCallback, type PointerEvent } from 'react'
import {
  Group,
  Panel,
  Separator,
  type GroupProps,
  type PanelImperativeHandle,
  type PanelProps,
  type SeparatorProps,
} from 'react-resizable-panels'

function joinClasses(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function ResizablePanelGroup({ className, ...props }: GroupProps) {
  return (
    <Group
      className={joinClasses('resizable-panel-group', className)}
      {...props}
    />
  )
}

export function ResizablePanel({ className, ...props }: PanelProps) {
  return (
    <Panel
      className={joinClasses(className)}
      {...props}
    />
  )
}

export function ResizableHandle({ className, onPointerDown, ...props }: SeparatorProps) {
  // react-resizable-panels v4 captures the pointer but does not suppress text
  // selection, so dragging the handle highlights the panel content. Flag the
  // document while a drag is in progress and let CSS disable selection.
  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      onPointerDown?.(event)
      if (typeof document === 'undefined') return
      document.documentElement.setAttribute('data-resizing-panels', '')
      const clear = () => {
        document.documentElement.removeAttribute('data-resizing-panels')
        window.removeEventListener('pointerup', clear)
        window.removeEventListener('pointercancel', clear)
      }
      window.addEventListener('pointerup', clear)
      window.addEventListener('pointercancel', clear)
    },
    [onPointerDown],
  )

  return (
    <Separator
      className={joinClasses('resizable-handle', className)}
      onPointerDown={handlePointerDown}
      {...props}
    >
      <span className="resizable-handle-grip" />
    </Separator>
  )
}

export type { PanelImperativeHandle }
