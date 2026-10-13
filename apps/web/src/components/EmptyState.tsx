/**
 * What a screen shows when there is nothing yet: what is missing and, when
 * there is one, the action that fills it. Every empty state uses this so no
 * screen invents its own arrangement.
 */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string
  children?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="empty-state">
      <p className="empty-state-title">{title}</p>
      {children ? <p className="empty-state-copy">{children}</p> : null}
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  )
}
