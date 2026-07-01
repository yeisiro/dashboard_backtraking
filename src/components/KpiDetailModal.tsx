import { useState } from 'react'
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { deltaTone, deltaTrend, type KpiCard, type DetailMetric, type Tone } from '../data'
import { usePeriod } from '../PeriodContext'

interface Props {
  card: KpiCard
  compareLabel: string
  onClose: () => void
}

// Timeline ranges. The API returns at most 2 months of data, and each period is
// compared against an equal-length window just before it — so the widest series
// is 60 days (30 selected + 30 prior). All ranges are shown daily.
const TIMELINE_RANGES = [
  { label: '15d', days: 15 },
  { label: '30d', days: 30 },
  { label: '60d', days: 60 },
]

// Default range mirrors the active date filter: 7d→15d, 15d→30d, 30d→60d
// (the selected window plus its equal-length comparison window).
function defaultRangeIdx(rangeDays: number): number {
  const target = rangeDays * 2
  const idx = TIMELINE_RANGES.findIndex((r) => r.days >= target)
  return idx === -1 ? TIMELINE_RANGES.length - 1 : idx
}

export default function KpiDetailModal({ card, compareLabel, onClose }: Props) {
  const { rangeEnd, rangeDays } = usePeriod()
  const metrics = card.details ?? []
  const [selected, setSelected] = useState(0)
  // Each card remembers its own timeline range (index into TIMELINE_RANGES).
  const [ranges, setRanges] = useState<Record<number, number>>({})
  const active = metrics[selected]
  const rangeIdx = ranges[selected] ?? defaultRangeIdx(rangeDays)
  const range = TIMELINE_RANGES[rangeIdx]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal kpi-detail" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="cfm-title">{card.label}</span>
          <button className="cfm-x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p className="cfm-sub">Select a metric, then pick its own time range below.</p>

          <div className="kd-grid" style={{ gridTemplateColumns: `repeat(${metrics.length}, 1fr)` }}>
            {metrics.map((m, i) => (
              <button
                key={m.label}
                className={`kd-metric ${i === selected ? 'active' : ''}`}
                onClick={() => setSelected(i)}
              >
                <span className="kd-metric-label">{m.label}</span>
                <span className="kd-metric-value">
                  {m.value}
                  {m.unit && <span className="kd-unit">{m.unit}</span>}
                </span>
                {m.delta && (
                  <span className={`kd-metric-delta ${toneClass(deltaTone(m.delta, m.goal))}`}>
                    <DeltaArrow trend={deltaTrend(m.delta)} />
                    {m.delta} <span className="kd-vs">{compareLabel}</span>
                  </span>
                )}
              </button>
            ))}
          </div>

          {active && (
            <div className="kd-timeline">
              <div className="kd-range">
                {TIMELINE_RANGES.map((r, i) => (
                  <button
                    key={r.label}
                    className={`kd-range-btn ${i === rangeIdx ? 'active' : ''}`}
                    onClick={() => setRanges((prev) => ({ ...prev, [selected]: i }))}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <Timeline metric={active} days={range.days} end={rangeEnd} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Resample a fixed mock series to `n` points so the line spans the selected
// window while keeping each metric's distinct shape (and its endpoints).
function resample(src: number[], n: number): number[] {
  if (n <= 1) return [src[src.length - 1]]
  if (n === src.length) return src
  return Array.from({ length: n }, (_, i) => {
    const t = (i / (n - 1)) * (src.length - 1)
    const lo = Math.floor(t)
    const hi = Math.ceil(t)
    return src[lo] + (src[hi] - src[lo]) * (t - lo)
  })
}

// Format a y-axis value to match the metric's own units (%, $, k).
function fmtTick(v: number, sample: string): string {
  const isPct = sample.trim().endsWith('%')
  const isCur = sample.includes('$')
  const a = Math.abs(v)
  let s: string
  if (a >= 1000) s = `${(v / 1000).toFixed(a % 1000 === 0 ? 0 : 1)}k`
  else if (a < 10) s = v.toFixed(1)
  else s = Math.round(v).toString()
  if (isCur) s = `$${s}`
  if (isPct) s = `${s}%`
  return s
}

function Timeline({
  metric,
  days,
  end,
}: {
  metric: DetailMetric
  days: number
  end: Date
}) {
  const [hover, setHover] = useState<number | null>(null)
  // One point per day across the selected window.
  const s = resample(metric.series, Math.max(2, days))
  const n = s.length
  // Match the viewBox width to the rendered width so preserveAspectRatio="none"
  // doesn't stretch the line, dots and labels horizontally.
  const W = 1000
  const H = 200
  const padL = 40
  const padR = 10
  const padT = 14
  const padB = 26
  const min = Math.min(...s)
  const max = Math.max(...s)
  const range = max - min || 1
  const x = (i: number) => padL + (i / (n - 1)) * (W - padL - padR)
  const y = (v: number) => padT + (1 - (v - min) / range) * (H - padT - padB)

  const line = s.map((v, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L ${x(n - 1).toFixed(1)} ${H - padB} L ${x(0).toFixed(1)} ${H - padB} Z`

  const fmtDate = (d: Date) => d.toLocaleString('en-US', { month: 'short', day: 'numeric' })
  // Axis labels: dates ending on the selected date, counting back one per day.
  const labels = s.map((_, i) => {
    const d = new Date(end)
    d.setDate(d.getDate() - (n - 1 - i))
    return fmtDate(d)
  })
  const tipLabels = labels
  // Thin the x-axis labels to ~10 across, so 60-day windows don't crowd.
  const labelStep = Math.max(1, Math.ceil(n / 10))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: padT + t * (H - padT - padB),
    v: max - t * range,
  }))

  return (
    <div className="kd-chart-box">
      <div className="kd-chart-head">
        <div className="kd-chart-titles">
          <span className="kd-chart-title">{metric.label}</span>
          {metric.hint && <span className="kd-chart-hint">{metric.hint}</span>}
        </div>
        <span className="kd-chart-cur">
          {metric.value}
          {metric.unit && <span className="kd-unit">{metric.unit}</span>}
        </span>
      </div>
      <div className="kd-plot">
        <svg className="kd-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="kdFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--green)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--green)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={padL} y1={t.y} x2={W - padR} y2={t.y} stroke="var(--border)" strokeWidth="1" />
              <text className="kd-axis-label" x={padL - 8} y={t.y + 3} textAnchor="end">
                {fmtTick(t.v, metric.value)}
              </text>
            </g>
          ))}
          <path d={area} fill="url(#kdFill)" />
          <path d={line} fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {hover !== null && (
            <line x1={x(hover)} y1={padT} x2={x(hover)} y2={H - padB} stroke="var(--green)" strokeWidth="1" strokeOpacity="0.4" />
          )}
          <circle cx={x(n - 1)} cy={y(s[n - 1])} r="4.5" fill="var(--green)" stroke="var(--bg)" strokeWidth="2" />
          {labels.map((lb, i) =>
            i % labelStep === 0 || i === n - 1 ? (
              <text
                key={i}
                className="kd-axis-label"
                x={i === 0 ? padL : i === n - 1 ? W - padR : x(i)}
                y={H - 8}
                textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
              >
                {lb}
              </text>
            ) : null,
          )}
        </svg>

        {/* Hover targets + tooltip, positioned in % so they track the SVG. */}
        <div className="kd-dots">
          {s.map((v, i) => (
            <div
              key={i}
              className={`kd-dot ${hover === i ? 'on' : ''}`}
              style={{ left: `${(x(i) / W) * 100}%`, top: `${(y(v) / H) * 100}%` }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </div>
        {hover !== null && (
          <div
            className="kd-tip"
            style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(s[hover]) / H) * 100}%` }}
          >
            <span className="kd-tip-label">{tipLabels[hover]}</span>
            <strong className="kd-tip-value">{fmtTick(s[hover], metric.value)}</strong>
          </div>
        )}
      </div>
    </div>
  )
}

function DeltaArrow({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') return <TrendingUp size={12} />
  if (trend === 'down') return <TrendingDown size={12} />
  return <Minus size={12} />
}

function toneClass(tone?: Tone) {
  if (tone === 'green') return 'pos'
  if (tone === 'red') return 'neg'
  if (tone === 'orange' || tone === 'yellow') return 'warn'
  return ''
}
