import { useEffect } from 'react'
import { Check, X } from 'lucide-react'

// Lightweight fixed-position toast, auto-dismissing after `duration` ms.
export default function Toast({
  message,
  onDone,
  duration = 4500,
}: {
  message: string
  onDone: () => void
  duration?: number
}) {
  useEffect(() => {
    const t = setTimeout(onDone, duration)
    return () => clearTimeout(t)
  }, [onDone, duration])

  return (
    <div className="toast" role="status">
      <span className="toast-icon">
        <Check size={15} strokeWidth={3} />
      </span>
      <span className="toast-msg">{message}</span>
      <button className="toast-close" onClick={onDone} aria-label="Dismiss">
        <X size={15} />
      </button>
    </div>
  )
}
