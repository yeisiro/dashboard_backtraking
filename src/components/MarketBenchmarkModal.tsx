import { useState } from 'react'
import { X, BarChart3, ArrowUpRight, Truck, User, ChevronDown } from 'lucide-react'
import { benchmarkAttrs } from '../data'

// The trucks (or drivers) that make up a column, revealed on demand from a
// neutral pill — same dropdown pattern as the toolbar filters.
function TruckMarker({
  trucks,
  label,
  noun = 'truck',
  onOpen,
}: {
  trucks: string[]
  label: string
  noun?: 'truck' | 'driver'
  onOpen?: () => void
}) {
  const [open, setOpen] = useState(false)
  if (trucks.length === 0) return null
  const Icon = noun === 'driver' ? User : Truck
  return (
    <div className="bench-trucks-wrap">
      <button className={`bench-trucks-btn ${open ? 'open' : ''}`} onClick={() => setOpen((o) => !o)}>
        <Icon size={13} />
        {trucks.length} {trucks.length === 1 ? noun : `${noun}s`}
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

// The $ a group loses on an attribute by not performing at market-leader level.
const costLabel = (n: number) => (n > 0 ? '−$' + Math.round(n).toLocaleString('en-US') : '$0')

// "How the market is doing" — one clean table of your worst/best trips vs the
// market leaders. In V2 the columns also name the trucks that make them up.
export default function MarketBenchmarkModal({
  onClose,
  onViewTrips,
  v2 = false,
  dimension = 'trucks',
  worstTrucks = [],
  bestTrucks = [],
}: {
  onClose: () => void
  onViewTrips?: (band: 'best' | 'worst') => void
  v2?: boolean
  dimension?: 'trucks' | 'drivers'
  worstTrucks?: string[]
  bestTrucks?: string[]
}) {
  const noun = dimension === 'drivers' ? 'driver' : 'truck'
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
            Your <strong>worst</strong> and <strong>best</strong> trips vs the market leaders — with
            what each still loses per period by not performing at leader level.
          </p>

          <table className="bench-table">
            <thead>
              <tr>
                <th className="bench-attr-col">Attribute</th>
                <th>
                  <button className="bench-link" onClick={() => goToTrips('worst')} data-tip="See these trips in Full Data">
                    Worst trips <ArrowUpRight size={12} />
                  </button>
                  {v2 && <TruckMarker trucks={worstTrucks} label="Worst trips" noun={noun} onOpen={() => goToTrips('worst')} />}
                </th>
                <th>
                  <button className="bench-link" onClick={() => goToTrips('best')} data-tip="See these trips in Full Data">
                    Best trips <ArrowUpRight size={12} />
                  </button>
                  {v2 && <TruckMarker trucks={bestTrucks} label="Best trips" noun={noun} onOpen={() => goToTrips('best')} />}
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
                  <td className="bench-val neg">
                    <span className="bench-metric">{r.worst}</span>
                    <span className="bench-cost">{costLabel(r.worstCost)}</span>
                  </td>
                  <td className="bench-val">
                    <span className="bench-metric">{r.best}</span>
                    <span className="bench-cost">{costLabel(r.bestCost)}</span>
                  </td>
                  <td className="bench-val lead">
                    <span className="bench-metric">{r.leaders}</span>
                    <span className="bench-cost bench-cost-lead">market</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
