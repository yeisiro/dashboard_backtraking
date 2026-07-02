import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { leakBars, leakBarsCompare, leakAmount } from '../data'
import { usePeriod } from '../PeriodContext'

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
const monthShort = (d: Date) => d.toLocaleString('en-US', { month: 'short' })

// "May 18–24, 2026" (same month) or "Apr 28 – May 4, 2026" (spanning months).
function formatRange(start: Date, end: Date): string {
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear())
    return `${monthShort(start)} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`
  return `${monthShort(start)} ${start.getDate()} – ${monthShort(end)} ${end.getDate()}, ${end.getFullYear()}`
}

// "-$7,000" for a loss of 7000.
function fmtLoss(n: number): string {
  return `-$${Math.round(n).toLocaleString('en-US')}`
}

// Change cell: leakage going DOWN (spent less) is good/green; UP is bad/red.
function Change({ delta }: { delta: number }) {
  const amt = `$${Math.abs(Math.round(delta)).toLocaleString('en-US')}`
  if (delta < 0)
    return (
      <span className="mlc-change pos">
        <TrendingDown size={14} /> {amt} less
      </span>
    )
  if (delta > 0)
    return (
      <span className="mlc-change neg">
        <TrendingUp size={14} /> {amt} more
      </span>
    )
  return (
    <span className="mlc-change flat">
      <Minus size={14} /> no change
    </span>
  )
}

export default function MoneyLeakageCompare({ onClose }: { onClose: () => void }) {
  // Windows come from the global period (toolbar), not local pickers.
  const { rangeDays, rangeEnd, compareRange } = usePeriod()
  const selEnd = startOfDay(rangeEnd)
  const selStart = addDays(selEnd, -(rangeDays - 1))
  const selectedLabel = formatRange(selStart, selEnd)

  // One row per category: its value in each window and the change (selected − compared).
  const rows = leakBars.map((b) => {
    const cmp = leakBarsCompare.find((c) => c.name === b.name)
    const sel = leakAmount(b.amount)
    const prev = cmp ? leakAmount(cmp.amount) : 0
    return { name: b.name, color: b.color, sel, prev, delta: sel - prev }
  })
  const selTotal = rows.reduce((s, r) => s + r.sel, 0)
  const prevTotal = rows.reduce((s, r) => s + r.prev, 0)
  const totalDelta = selTotal - prevTotal

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal mlc" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="eyebrow">Money Leakage Breakdown</span>
          <button className="cfm-x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body mlc-body">
          <div className="mlc-table">
            <div className="mlc-trow mlc-thead">
              <span className="mlc-tname">Category</span>
              <div className="mlc-tcol">
                <span className="mlc-tcap">Current period</span>
                <span className="mlc-tdate">{selectedLabel}</span>
              </div>
              <div className="mlc-tcol">
                <span className="mlc-tcap">Previous period</span>
                <span className="mlc-tdate">{compareRange || 'Previous period'}</span>
              </div>
              <span className="mlc-tchange-head">Change</span>
            </div>

            {rows.map((r) => (
              <div className="mlc-trow" key={r.name}>
                <span className="mlc-tname">
                  <i className="mlc-dot" style={{ background: r.color }} />
                  {r.name}
                </span>
                <span className="mlc-tval">{fmtLoss(r.sel)}</span>
                <span className="mlc-tval">{fmtLoss(r.prev)}</span>
                <span className="mlc-tchange">
                  <Change delta={r.delta} />
                </span>
              </div>
            ))}

            <div className="mlc-trow mlc-ttotal">
              <span className="mlc-tname">Total Money Leakage</span>
              <span className="mlc-tval">{fmtLoss(selTotal)}</span>
              <span className="mlc-tval">{fmtLoss(prevTotal)}</span>
              <span className="mlc-tchange">
                <Change delta={totalDelta} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
