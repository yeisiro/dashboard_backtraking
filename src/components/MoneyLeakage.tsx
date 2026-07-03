import { useState } from 'react'
import { Info, ArrowUpRight, TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react'
import { leakBars, leakTotal, leakDelta, planFixes, deltaTone, deltaTrend } from '../data'
import { usePeriod } from '../PeriodContext'
import MoneyLeakageCompare from './MoneyLeakageCompare'
import RecommendationsModal from './RecommendationsModal'

const ticks = ['$0', '$2k', '$4k', '$6k', '$8k', '$10k']
const AVOIDABLE_NAME = 'Ignored recommendations'

function DeltaArrow({ trend, size }: { trend: 'up' | 'down' | 'flat'; size: number }) {
  if (trend === 'up') return <TrendingUp size={size} style={{ verticalAlign: '-1px' }} />
  if (trend === 'down') return <TrendingDown size={size} style={{ verticalAlign: '-1px' }} />
  return <Minus size={size} style={{ verticalAlign: '-1px' }} />
}

export default function MoneyLeakage() {
  const [compareOpen, setCompareOpen] = useState(false)
  const [recsOpen, setRecsOpen] = useState(false)
  const { compareLabel, compareRange } = usePeriod()
  const tone = deltaTone(leakDelta, 'low')
  const toneClass = tone === 'green' ? 'pos' : tone === 'red' ? 'neg' : 'warn'

  const avoidable = leakBars.find((b) => b.name === AVOIDABLE_NAME)
  const bars = leakBars.filter((b) => b.name !== AVOIDABLE_NAME)

  return (
    <section className="card">
      <div className="card-head">
        <div className="title">
          <span className="eyebrow">Money Leakage Breakdown</span>
          <span className="info-tip" tabIndex={0}>
            <Info size={14} color="var(--text-muted)" />
            <span className="info-tip-bubble" role="tooltip">
              Where money is being lost across your fleet, by category. "Ignored
              recommendations" is what you could have saved by following the plan
              we recommended.
            </span>
          </span>
        </div>
        <button className="btn-ghost" onClick={() => setCompareOpen(true)}>
          Compare <ArrowUpRight size={13} />
        </button>
      </div>

      <div className="leak-body">
        <div className="leak-amount">
          <div className="leak-total">
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

          {avoidable && (
            <button className="leak-avoidable" onClick={() => setRecsOpen(true)}>
              You could've saved an extra{' '}
              <strong>{avoidable.amount.replace('-', '')}</strong> with a better plan
              <span className="la-link">
                See how <ArrowRight size={11} />
              </span>
            </button>
          )}
        </div>

        <div className="bars">
          {bars.map((b) => (
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
      {recsOpen && (
        <RecommendationsModal
          title="A different plan would've done better"
          subtitle={`With better planning this period, these choices would have gone better — worth ${
            avoidable?.amount.replace('-', '') ?? '$3,700'
          }.`}
          items={planFixes}
          onClose={() => setRecsOpen(false)}
        />
      )}
    </section>
  )
}
