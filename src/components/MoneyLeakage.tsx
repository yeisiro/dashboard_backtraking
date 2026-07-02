import { useState } from 'react'
import { Info, ArrowUpRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { leakBars, leakTotal, leakDelta, deltaTone, deltaTrend } from '../data'
import { usePeriod } from '../PeriodContext'
import MoneyLeakageCompare from './MoneyLeakageCompare'

const ticks = ['$0', '$2k', '$4k', '$6k', '$8k', '$10k']

function DeltaArrow({ trend, size }: { trend: 'up' | 'down' | 'flat'; size: number }) {
  if (trend === 'up') return <TrendingUp size={size} style={{ verticalAlign: '-1px' }} />
  if (trend === 'down') return <TrendingDown size={size} style={{ verticalAlign: '-1px' }} />
  return <Minus size={size} style={{ verticalAlign: '-1px' }} />
}

export default function MoneyLeakage() {
  const [seg, setSeg] = useState<'general' | 'planned' | 'executed'>('general')
  const [compareOpen, setCompareOpen] = useState(false)
  const { compareLabel, compareRange } = usePeriod()
  const tone = deltaTone(leakDelta, 'low')
  const toneClass = tone === 'green' ? 'pos' : tone === 'red' ? 'neg' : 'warn'

  return (
    <section className="card">
      <div className="card-head">
        <div className="title">
          <span className="eyebrow">Money Leakage Breakdown</span>
          <span className="info-tip" tabIndex={0}>
            <Info size={14} color="var(--text-muted)" />
            <span className="info-tip-bubble" role="tooltip">
              Breakdown of where money is being lost across your fleet, by
              leakage category.
            </span>
          </span>
        </div>
        <button className="btn-ghost" onClick={() => setCompareOpen(true)}>
          Compare <ArrowUpRight size={13} />
        </button>
      </div>

      <div className="leak-body">
        <div className="leak-amount">
          <span className="big">{leakTotal}</span>
          <span className="kpi-cmp">
            <span className={`delta ${toneClass}`}>
              <DeltaArrow trend={deltaTrend(leakDelta)} size={12} /> {leakDelta}
            </span>
            <span
              className="crow-vs cmp-tip"
              data-tip={
                compareRange
                  ? `Compared to ${compareRange}`
                  : 'Compared to the previous period'
              }
            >
              {compareLabel}
            </span>
          </span>
        </div>

        <div className="leak-toprow">
          <span />
          <div className="segment">
            <button
              className={seg === 'general' ? 'active' : ''}
              onClick={() => setSeg('general')}
            >
              General
            </button>
            <button
              className={seg === 'planned' ? 'active' : ''}
              onClick={() => setSeg('planned')}
            >
              Planned <span className="pct">60%</span>
            </button>
            <button
              className={seg === 'executed' ? 'active' : ''}
              onClick={() => setSeg('executed')}
            >
              Executed <span className="pct">40%</span>
            </button>
          </div>
        </div>

        <div className="bars">
          {leakBars.map((b) => (
            <div className="bar-row" key={b.name}>
              <div className="bar-label">
                <div className="name">{b.name}</div>
                <div className="pct">{b.pct}%</div>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${b.width}%`, background: b.color }}
                />
                <span className="bar-value">{b.amount}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="axis">
          <span />
          <div className="axis-ticks">
            {ticks.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      {compareOpen && <MoneyLeakageCompare onClose={() => setCompareOpen(false)} />}
    </section>
  )
}
