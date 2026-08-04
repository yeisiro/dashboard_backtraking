import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'

// A reusable on-demand refresh control. Used both in the global filter bar
// (re-pull every endpoint feeding the active screen) and inside the trip
// detail modal (re-pull just the open trip). The data layer here is mock, so
// the spin is held briefly even when onRefresh resolves instantly — otherwise
// an instant return reads as "nothing happened" rather than a real refresh.
export default function RefreshButton({
  onRefresh,
  className = '',
  label = 'Refresh data',
  size = 15,
}: {
  onRefresh?: () => void | Promise<void>
  className?: string
  label?: string
  size?: number
}) {
  const [spinning, setSpinning] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    },
    [],
  )

  const handleClick = async () => {
    if (spinning) return
    setSpinning(true)
    try {
      await onRefresh?.()
    } finally {
      timerRef.current = window.setTimeout(() => setSpinning(false), 850)
    }
  }

  return (
    <button
      type="button"
      className={`refresh-btn mm-tooltip ${className}`}
      onClick={handleClick}
      aria-label={label}
      data-tooltip={label}
      disabled={spinning}
    >
      <RefreshCw size={size} className={spinning ? 'refresh-spin' : ''} />
    </button>
  )
}
