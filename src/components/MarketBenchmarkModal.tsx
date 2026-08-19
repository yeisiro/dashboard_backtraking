import { X, BarChart3, ArrowUpRight, Trophy } from 'lucide-react'
import { benchmarkAttrs } from '../data'

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US')

// Chips of the trucks that make up a column. Small sets show inline; larger
// sets collapse into a grouped marker that reveals the full list on hover and
// jumps to the trips on click.
function TruckMarker({ trucks, onOpen }: { trucks: string[]; onOpen?: () => void }) {
  if (trucks.length === 0) return null
  if (trucks.length <= 5) {
    return (
      <div className="bench-trucks">
        {trucks.map((t) => (
          <span className="bench-truck-chip" key={t}>
            {t}
          </span>
        ))}
      </div>
    )
  }
  return (
    <button className="bench-trucks-group" onClick={onOpen} data-tip="Open these trips in Full Data">
      {trucks.length} trucks ↗
      <span className="bench-trucks-pop">
        {trucks.map((t) => (
          <span className="bench-truck-chip" key={t}>
            {t}
          </span>
        ))}
      </span>
    </button>
  )
}

// "How the market is doing" — your worst/best trips vs the market leaders. In
// V2 it also names the trucks behind each column and quantifies, in its own
// column, how much each metric's gap to the leaders is costing you.
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

  const worstTotal = benchmarkAttrs.reduce((s, r) => s + r.worstCost, 0)
  const bestTotal = benchmarkAttrs.reduce((s, r) => s + r.bestCost, 0)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal bench-modal ${v2 ? 'bench-modal-wide' : ''}`} onClick={(e) => e.stopPropagation()}>
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
            {v2 && ' Each column is the same set of trucks ranked in Potential Savings, with what its gap to the leaders costs you.'}
          </p>

          {v2 ? (
            <table className="bench-table bench-table-2">
              <thead>
                <tr className="bench-grp-head">
                  <th className="bench-attr-col" rowSpan={2}>Attribute</th>
                  <th colSpan={2} className="bench-grp bench-grp-worst">
                    <button className="bench-link" onClick={() => goToTrips('worst')} data-tip="See these trips in Full Data">
                      Worst trips <ArrowUpRight size={12} />
                    </button>
                    <TruckMarker trucks={worstTrucks} onOpen={() => goToTrips('worst')} />
                  </th>
                  <th colSpan={2} className="bench-grp bench-grp-best">
                    <button className="bench-link" onClick={() => goToTrips('best')} data-tip="See these trips in Full Data">
                      Best trips <ArrowUpRight size={12} />
                    </button>
                    <TruckMarker trucks={bestTrucks} onOpen={() => goToTrips('best')} />
                  </th>
                  <th rowSpan={2} className="bench-lead-col">
                    <span className="bench-lead-head">
                      <Trophy size={12} color="var(--yellow)" /> Market leaders
                    </span>
                  </th>
                </tr>
                <tr className="bench-sub-head">
                  <th>Your value</th>
                  <th>Gap cost</th>
                  <th>Your value</th>
                  <th>Gap cost</th>
                </tr>
              </thead>
              <tbody>
                {benchmarkAttrs.map((r) => (
                  <tr key={r.attribute}>
                    <td className="bench-attr">
                      <span className="bench-tip" data-tip={r.tip}>{r.attribute}</span>
                    </td>
                    <td className="bench-val neg">{r.worst}</td>
                    <td className="bench-cost-cell neg">{money(r.worstCost)}</td>
                    <td className="bench-val">{r.best}</td>
                    <td className="bench-cost-cell">
                      {r.bestCost > 0 ? (
                        <span className="warn">{money(r.bestCost)}</span>
                      ) : (
                        <span className="pos">At leader level</span>
                      )}
                    </td>
                    <td className="bench-val lead">{r.leaders}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bench-foot">
                  <td className="bench-attr">Cost of the gap</td>
                  <td className="bench-val" />
                  <td className="bench-cost-cell neg"><b>{money(worstTotal)}</b><span className="bench-cost-lbl">/period</span></td>
                  <td className="bench-val" />
                  <td className="bench-cost-cell"><b className="warn">{money(bestTotal)}</b><span className="bench-cost-lbl">/period</span></td>
                  <td className="bench-val lead">—</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <table className="bench-table">
              <thead>
                <tr>
                  <th className="bench-attr-col">Attribute</th>
                  <th>
                    <button className="bench-link" onClick={() => goToTrips('worst')} data-tip="See these trips in Full Data">
                      Worst trips <ArrowUpRight size={12} />
                    </button>
                  </th>
                  <th>
                    <button className="bench-link" onClick={() => goToTrips('best')} data-tip="See these trips in Full Data">
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
          )}

          {v2 && (
            <p className="bench-takeaway">
              Bringing your <strong>worst</strong> trips up to leader level recovers about{' '}
              <b>{money(worstTotal)}/period</b>; closing the gap on your <strong>best</strong> trips is worth
              another <b>{money(bestTotal)}/period</b>.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
