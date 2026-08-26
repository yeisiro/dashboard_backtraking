import { useState } from 'react'
import { X, TrendingUp, TrendingDown, Minus, Table2, LineChart } from 'lucide-react'
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
  const [mode, setMode] = useState<'table' | 'trend'>('table')
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
          <div className="mlc-head-right">
            <div className="mlc-mode" role="group" aria-label="View">
              <button
                className={`mlc-mode-btn ${mode === 'table' ? 'active' : ''}`}
                onClick={() => setMode('table')}
              >
                <Table2 size={13} /> Comparison
              </button>
              <button
                className={`mlc-mode-btn ${mode === 'trend' ? 'active' : ''}`}
                onClick={() => setMode('trend')}
              >
                <LineChart size={13} /> Trend
              </button>
            </div>
            <button className="cfm-x" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="modal-body mlc-body">
          {mode === 'table' ? (
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
          ) : (
            <LeakTrend
              rows={rows.map((r) => ({ name: r.name, color: r.color, total: r.sel }))}
              days={rangeDays}
              end={selEnd}
              periodLabel={selectedLabel}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// A deterministic daily series of `n` points that hovers around `base` with a
// per-category ripple, so every line keeps a stable, distinct shape.
function dailySeries(base: number, seed: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => {
    const t = n <= 1 ? 0 : i / (n - 1)
    const ripple =
      Math.sin(t * 6.3 + seed) * 0.16 + Math.sin(t * 13.7 + seed * 1.7) * 0.08
    return Math.max(0, base * (1 + ripple))
  })
}

const shortName = (n: string) =>
  ({
    'Missed Fuel Savings': 'Missed fuel',
    'Empty Miles': 'Empty miles',
    'Route Deviations': 'Route dev.',
    'Idle Time Cost': 'Idle time',
    'Operative Inefficiencies': 'Operative',
    'Poor Planning': 'Poor planning',
  })[n] ?? n

// Daily money-leaked-per-day view: a bold Total line plus one line per category,
// each toggleable from the legend. Values are the $ leaked on that day.
function LeakTrend({
  rows,
  days,
  end,
  periodLabel,
}: {
  rows: { name: string; color: string; total: number }[]
  days: number
  end: Date
  periodLabel: string
}) {
  const fullN = Math.max(2, days)
  // Range chips: a couple of shorter zoom-ins plus the full selected window.
  const rangeOpts = [...[3, 5, 7, 15, 30].filter((d) => d < fullN).slice(-2), fullN]
  const [viewDays, setViewDays] = useState(fullN)
  const n = Math.min(viewDays, fullN)

  // Each category's full daily $ over the whole period (base = period total /
  // days), so the per-day amounts stay put when you zoom to a shorter window.
  const catsFull = rows.map((r, i) => ({
    name: r.name,
    color: r.color,
    series: dailySeries(r.total / fullN, i * 1.9 + 0.6, fullN),
  }))

  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [hover, setHover] = useState<number | null>(null)
  const toggle = (name: string) =>
    setHidden((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })

  // Show only the last `n` days of the full series.
  const cats = catsFull.map((c) => ({ ...c, series: c.series.slice(fullN - n) }))
  const totalSeries = Array.from({ length: n }, (_, i) =>
    cats.reduce((s, c) => s + c.series[i], 0),
  )

  const totalShown = !hidden.has('__total__')
  const lines = [
    ...(totalShown
      ? [{ name: 'Total', color: 'var(--text)', series: totalSeries, total: true }]
      : []),
    ...cats.filter((c) => !hidden.has(c.name)).map((c) => ({ ...c, total: false })),
  ]

  const W = 1000
  const H = 260
  const padL = 46
  const padR = 12
  const padT = 14
  const padB = 26
  const visible = lines.length ? lines.flatMap((l) => l.series) : [0, 1]
  // Anchor the axis at $0 while the Total (which dwarfs the categories) is shown;
  // once it's hidden, zoom to the visible category range for detail.
  const rawMax = Math.max(...visible)
  const min = totalShown ? 0 : Math.max(0, Math.min(...visible) - (rawMax - Math.min(...visible)) * 0.15)
  const max = rawMax + (rawMax - min) * 0.06
  const range = max - min || 1
  const x = (i: number) => padL + (i / Math.max(1, n - 1)) * (W - padL - padR)
  const y = (v: number) => padT + (1 - (v - min) / range) * (H - padT - padB)
  const path = (s: number[]) =>
    s.map((v, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')

  const fmtDate = (d: Date) => d.toLocaleString('en-US', { month: 'short', day: 'numeric' })
  const labels = Array.from({ length: n }, (_, i) => {
    const d = new Date(end)
    d.setDate(d.getDate() - (n - 1 - i))
    return fmtDate(d)
  })
  const labelStep = Math.max(1, Math.ceil(n / 8))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: padT + t * (H - padT - padB),
    v: max - t * range,
  }))
  const fmtAxis = (v: number) => {
    const a = Math.abs(v)
    return a >= 1000 ? `-$${(v / 1000).toFixed(1)}k` : `-$${Math.round(v)}`
  }

  // Nearest-day index from a pointer x within the plot, for smooth hover.
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const i = Math.round(((px - padL) / (W - padL - padR)) * (n - 1))
    setHover(Math.max(0, Math.min(n - 1, i)))
  }

  return (
    <div className="mlc-trend">
      <div className="mlc-trend-head">
        <div>
          <div className="mlc-trend-title">Daily Money Leakage</div>
          <div className="mlc-trend-sub">
            {periodLabel} · click the legend to toggle a series · hover for the day
          </div>
        </div>
        {rangeOpts.length > 1 && (
          <div className="mlc-range" role="group" aria-label="Time range">
            {rangeOpts.map((d) => (
              <button
                key={d}
                className={`mlc-range-btn ${n === d ? 'active' : ''}`}
                onClick={() => setViewDays(d)}
              >
                {d}d
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mlc-legend">
        <button
          className={`mlc-leg ${totalShown ? '' : 'off'}`}
          onClick={() => toggle('__total__')}
        >
          <i className="mlc-leg-line" style={{ background: 'var(--text)' }} />
          Total
        </button>
        {cats.map((c) => (
          <button
            key={c.name}
            className={`mlc-leg ${hidden.has(c.name) ? 'off' : ''}`}
            onClick={() => toggle(c.name)}
          >
            <i className="mlc-leg-line" style={{ background: c.color }} />
            {shortName(c.name)}
          </button>
        ))}
      </div>

      <div className="mlc-plot">
        <svg className="mlc-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={padL} y1={t.y} x2={W - padR} y2={t.y} stroke="var(--border)" strokeWidth="1" />
              <text className="mlc-axis-label" x={padL - 8} y={t.y + 3} textAnchor="end">
                {fmtAxis(t.v)}
              </text>
            </g>
          ))}
          {hover !== null && (
            <line x1={x(hover)} y1={padT} x2={x(hover)} y2={H - padB} stroke="var(--text-muted)" strokeWidth="1" strokeOpacity="0.45" />
          )}
          {lines.map((l) => (
            <path
              key={l.name}
              d={path(l.series)}
              fill="none"
              stroke={l.color}
              strokeWidth={l.total ? 3 : 2}
              strokeOpacity={l.total ? 1 : 0.9}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {/* Reference marker on each line for every day; the hovered day grows. */}
          {lines.flatMap((l) =>
            l.series.map((v, i) => (
              <circle
                key={`${l.name}-${i}`}
                cx={x(i)}
                cy={y(v)}
                r={hover === i ? 4.2 : 2.2}
                fill={l.color}
                stroke="var(--bg)"
                strokeWidth={hover === i ? 1.6 : 1}
                opacity={hover === null || hover === i ? 1 : 0.85}
              />
            )),
          )}
          {labels.map((lb, i) =>
            i % labelStep === 0 || i === n - 1 ? (
              <text
                key={i}
                className="mlc-axis-label"
                x={i === 0 ? padL : i === n - 1 ? W - padR : x(i)}
                y={H - 8}
                textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
              >
                {lb}
              </text>
            ) : null,
          )}
        </svg>

        <div className="mlc-hitlayer" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />

        {hover !== null && (
          <div
            className="mlc-tip"
            style={{
              left: `${(x(hover) / W) * 100}%`,
              transform: hover > n / 2 ? 'translate(-100%, 0)' : 'none',
            }}
          >
            <span className="mlc-tip-date">{labels[hover]}</span>
            {lines.map((l) => (
              <span className="mlc-tip-row" key={l.name}>
                <i style={{ background: l.color }} />
                <span className="mlc-tip-name">{l.name === 'Total' ? 'Total' : shortName(l.name)}</span>
                <strong>{fmtLoss(l.series[hover])}</strong>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
