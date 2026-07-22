import { useState } from 'react'
import { ChevronDown, Check, Ban } from 'lucide-react'
import { usePeriod, currentPeriodLabel } from '../PeriodContext'

export type DeadheadMode = 'in-range' | 'full-trip'

const DEADHEAD_LABEL: Record<DeadheadMode, string> = {
  'in-range': 'In range only',
  'full-trip': 'Full trip',
}

export default function DeadheadFilter({
  mode = 'in-range',
  onChange,
  locked = false,
  lockedMessage = "This view always needs each trip's full deadhead.",
}: {
  mode?: DeadheadMode
  onChange?: (next: DeadheadMode) => void
  // When true, "In range only" can't be picked — used on subtabs (Trips,
  // Fleet Analytics) that always need each trip's untouched full deadhead
  // to add up right.
  locked?: boolean
  lockedMessage?: string
}) {
  const [open, setOpen] = useState(false)
  const { rangeEnd, rangeDays } = usePeriod()
  const rangeLabel = currentPeriodLabel(rangeEnd, rangeDays)

  const choose = (next: DeadheadMode) => {
    if (locked && next === 'in-range') return
    onChange?.(next)
    setOpen(false)
  }

  return (
    <div className="cf">
      <button className="filter" onClick={() => setOpen((o) => !o)}>
        <span>Deadhead:</span>
        <b>{DEADHEAD_LABEL[mode]}</b>
        <ChevronDown className="chev" size={15} />
      </button>

      {open && (
        <>
          <div className="cf-backdrop" onClick={() => setOpen(false)} />
          <div className="cf-menu dh-menu">
            <button
              className={`dh-option ${mode === 'in-range' ? 'active' : ''} ${locked ? 'locked' : ''}`}
              onClick={() => choose('in-range')}
            >
              {/* Dimming lives on this wrapper, not the button itself — opacity
                  applies to a whole subtree as one translucent layer, which would
                  otherwise wash out the (fully opaque) tooltip bubble below. */}
              <span className="dh-option-content">
                <span className="dh-option-title">
                  In range only
                  {locked && <Ban size={13} className="dh-lock-icon" />}
                  {mode === 'in-range' && <Check size={15} className="cf-check" />}
                </span>
                <span className="dh-option-desc">
                  Only includes deadhead from the days between {rangeLabel}. If a trip runs partly outside this
                  range, that part is left out.
                </span>
              </span>
              {locked && (
                <span className="dh-lock-bubble" role="tooltip">
                  {lockedMessage}
                </span>
              )}
            </button>
            <button className={`dh-option ${mode === 'full-trip' ? 'active' : ''}`} onClick={() => choose('full-trip')}>
              <span className="dh-option-title">
                Full trip
                {mode === 'full-trip' && <Check size={15} className="cf-check" />}
              </span>
              <span className="dh-option-desc">
                Includes each trip's entire deadhead, even the days outside {rangeLabel}.
                {mode !== 'full-trip' && ' Use this to match the numbers in Full Data.'}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
