import { useState } from 'react'
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { deltaTone, deltaTrend, type KpiCard, type DetailMetric, type Tone } from '../data'

interface Props {
  card: KpiCard
  compareLabel: string
  onClose: () => void
}

export default function KpiDetailModal({ card, compareLabel, onClose }: Props) {
  const metrics = card.details ?? []
  const [selected, setSelected] = useState(0)
  const active = metrics[selected]

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
          <p className="cfm-sub">Select a metric to see its trend {compareLabel.replace('vs prev', 'over the last')}.</p>

          <div className="kd-grid">
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

          {active && <Timeline metric={active} />}
        </div>
      </div>
    </div>
  )
}

function Timeline({ metric }: { metric: DetailMetric }) {
  const s = metric.series
  const n = s.length
  const W = 660
  const H = 200
  const padL = 10
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

  // Daily labels ending today.
  const today = new Date()
  const labels = s.map((_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (n - 1 - i))
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric' })
  })
  const step = Math.ceil((n - 1) / 4)
  const gridY = [0, 0.25, 0.5, 0.75, 1].map((t) => padT + t * (H - padT - padB))

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
      <svg className="kd-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="kdFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--green)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--green)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridY.map((gy, i) => (
          <line key={i} x1={padL} y1={gy} x2={W - padR} y2={gy} stroke="var(--border)" strokeWidth="1" />
        ))}
        <path d={area} fill="url(#kdFill)" />
        <path d={line} fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(n - 1)} cy={y(s[n - 1])} r="4.5" fill="var(--green)" stroke="var(--bg)" strokeWidth="2" />
        {labels.map((lb, i) =>
          i % step === 0 || i === n - 1 ? (
            <text key={i} className="kd-axis-label" x={x(i)} y={H - 8} textAnchor="middle">
              {lb}
            </text>
          ) : null,
        )}
      </svg>
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
