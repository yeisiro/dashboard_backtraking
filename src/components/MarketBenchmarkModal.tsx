import { X, BarChart3 } from 'lucide-react'
import { benchmarkAttrs, zoneDrivers, brokerDrivers } from '../data'

const names = (rows: { name: string; verdict: 'win' | 'lose' }[], v: 'win' | 'lose') =>
  rows.filter((r) => r.verdict === v).map((r) => r.name).join(' · ')

const originsWorst = names(zoneDrivers, 'lose')
const originsBest = names(zoneDrivers, 'win')
const brokersWorst = names(brokerDrivers, 'lose')
const brokersBest = names(brokerDrivers, 'win')

// "How the market is doing" — one clean table. Fleet metrics (your worst/best
// trips vs the market leaders), plus an Origin row (the regions/states your
// trips departed from) and a Brokers row (who negotiated them). The market
// leaders run the same lanes as your best trips, so that column mirrors "best".
export default function MarketBenchmarkModal({ onClose }: { onClose: () => void }) {
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
            Your <strong>3 worst</strong> and <strong>3 best</strong> trips vs the market leaders,
            and where they ran and who brokered them.
          </p>

          <table className="bench-table">
            <thead>
              <tr>
                <th className="bench-attr-col">Attribute</th>
                <th>Worst 3 trips</th>
                <th>Best 3 trips</th>
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

              <tr>
                <td className="bench-attr">
                  <span
                    className="bench-tip"
                    data-tip="The regions or states your trips departed from — where you picked up the load."
                  >
                    Origin
                  </span>
                </td>
                <td className="bench-val neg">{originsWorst}</td>
                <td className="bench-val">{originsBest}</td>
                <td className="bench-val lead">{originsBest}</td>
              </tr>
              <tr>
                <td className="bench-attr">
                  <span
                    className="bench-tip"
                    data-tip="The brokers that negotiated and booked these loads."
                  >
                    Brokers
                  </span>
                </td>
                <td className="bench-val neg">{brokersWorst}</td>
                <td className="bench-val">{brokersBest}</td>
                <td className="bench-val lead">{brokersBest}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
