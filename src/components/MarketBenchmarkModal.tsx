import { useState } from 'react'
import { X, BarChart3, ArrowUpRight, Truck, ChevronDown } from 'lucide-react'
import { benchmarkAttrs } from '../data'

// The trucks that make up a column, revealed on demand from a neutral pill —
// same dropdown pattern as the toolbar filters, rather than a wall of chips.
function TruckMarker({ trucks, label, onOpen }: { trucks: string[]; label: string; onOpen?: () => void }) {
  const [open, setOpen] = useState(false)
  if (trucks.length === 0) return null
  return (
    <div className="bench-trucks-wrap">
      <button className={`bench-trucks-btn ${open ? 'open' : ''}`} onClick={() => setOpen((o) => !o)}>
        <Truck size={13} />
        {trucks.length} {trucks.length === 1 ? 'truck' : 'trucks'}
        <ChevronDown size={13} className="bench-trucks-chev" />
      </button>
      {open && (
        <>
          <div className="cf-backdrop" onClick={() => setOpen(false)} />
          <div className="bench-trucks-menu">
            <div className="bench-trucks-menu-head">{label}</div>
            {trucks.map((t) => (
              <button
                key={t}
                className="bench-trucks-item"
                onClick={() => {
                  setOpen(false)
                  onOpen?.()
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// "How the market is doing" — one clean table of your worst/best trips vs the
// market leaders. In V2 the columns also name the trucks that make them up.
export default function MarketBenchmarkModal({
  onClose,
  onViewTrips,
  v2 = false,
  worstTrucks = [],
  bestTrucks = [],
}: {
  onClose: () => void
  onViewTrips?: (band: 'best' | 'worst') => void
  v2?: boolean
  worstTrucks?: string[]
  bestTrucks?: string[]
}) {
  const goToTrips = (band: 'best' | 'worst') => {
    onViewTrips?.(band)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal bench-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="cfm-title">
            <BarChart3 size={17} color="var(--blue)" /> How the market is doing
          </span>
          <button className="cfm-x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p className="cfm-sub">
            Your <strong>worst</strong> and <strong>best</strong> trips vs the market leaders.
          </p>

          <table className="bench-table">
            <thead>
              <tr>
                <th className="bench-attr-col">Attribute</th>
                <th>
                  <button className="bench-link" onClick={() => goToTrips('worst')} data-tip="See these trips in Full Data">
                    Worst trips <ArrowUpRight size={12} />
                  </button>
                  {v2 && <TruckMarker trucks={worstTrucks} label="Worst trips" onOpen={() => goToTrips('worst')} />}
                </th>
                <th>
                  <button className="bench-link" onClick={() => goToTrips('best')} data-tip="See these trips in Full Data">
                    Best trips <ArrowUpRight size={12} />
                  </button>
                  {v2 && <TruckMarker trucks={bestTrucks} label="Best trips" onOpen={() => goToTrips('best')} />}
                </th>
                <th>Market leaders</th>
              </tr>
            </thead>
            <tbody>
              {benchmarkAttrs.map((r) => (
                <tr key={r.attribute}>
                  <td className="bench-attr">
                    <span className="bench-tip" data-tip={r.tip}>{r.attribute}</span>
                  </td>
                  <td className="bench-val neg">{r.worst}</td>
                  <td className="bench-val">{r.best}</td>
                  <td className="bench-val lead">{r.leaders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
