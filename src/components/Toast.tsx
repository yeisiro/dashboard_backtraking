import { useEffect } from 'react'
import { Check, Undo2, X } from 'lucide-react'

// Lightweight fixed-position toast, auto-dismissing after `duration` ms.
// An optional `action` renders an inline button (e.g. Undo) — a passive safety
// net that costs nothing if ignored and disappears with the toast.
export default function Toast({
  message,
  onDone,
  action,
  duration,
}: {
  message: string
  onDone: () => void
  action?: { label: string; onClick: () => void }
  duration?: number
}) {
  // Undoable toasts linger a little longer so the safety net is catchable.
  const ttl = duration ?? (action ? 6500 : 4500)
  useEffect(() => {
    const t = setTimeout(onDone, ttl)
    return () => clearTimeout(t)
  }, [onDone, ttl])

  return (
    <div className="toast" role="status">
      <span className="toast-icon">
        <Check size={15} strokeWidth={3} />
      </span>
      <span className="toast-msg">{message}</span>
      {action && (
        <button
          className="toast-action"
          onClick={() => {
            action.onClick()
            onDone()
          }}
        >
          <Undo2 size={13} strokeWidth={2.6} /> {action.label}
        </button>
      )}
      <button className="toast-close" onClick={onDone} aria-label="Dismiss">
        <X size={15} />
      </button>
    </div>
  )
}
