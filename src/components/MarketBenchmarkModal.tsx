import { X, BarChart3, ArrowUpRight } from 'lucide-react'
import { benchmarkAttrs } from '../data'

// "How the market is doing" — one clean table of your worst/best trips vs the
// market leaders. The Worst/Best headers link out to the Trips table in Full Data.
export default function MarketBenchmarkModal({
  onClose,
  onViewTrips,
}: {
  onClose: () => void
  onViewTrips?: (band: 'best' | 'worst') => void
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
                  <button
                    className="bench-link"
                    onClick={() => goToTrips('worst')}
                    data-tip="See these trips in Full Data"
                  >
                    Worst trips <ArrowUpRight size={12} />
                  </button>
                </th>
                <th>
                  <button
                    className="bench-link"
                    onClick={() => goToTrips('best')}
                    data-tip="See these trips in Full Data"
                  >
                    Best trips <ArrowUpRight size={12} />
                  </button>
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
