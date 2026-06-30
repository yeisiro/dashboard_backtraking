import { useState } from 'react'
import { ArrowUpRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  kpiCards,
  deltaTone,
  deltaTrend,
  type KpiMetric,
  type KpiCard,
  type Tone,
} from '../data'
import { usePeriod } from '../PeriodContext'
import KpiDetailModal from './KpiDetailModal'

export default function KpiCards() {
  const { compareLabel } = usePeriod()
  const [openCard, setOpenCard] = useState<KpiCard | null>(null)

  return (
    <div className="kpi-row">
      {kpiCards.map((card) => (
        <div className="card kpi" key={card.label}>
          <div className="kpi-head">
            <span className="eyebrow">{card.label}</span>
            <button
              className="kpi-arrow"
              data-tip={`View more details about ${card.label}`}
              onClick={() => setOpenCard(card)}
              aria-label={`View more details about ${card.label}`}
            >
              <ArrowUpRight size={15} />
            </button>
          </div>

          {card.metrics.length > 1 ? (
            <div className="kpi-rows">
              {card.metrics.map((m, i) => (
                <CompactRow m={m} compare={compareLabel} key={i} />
              ))}
            </div>
          ) : (
            <Metric m={card.metrics[0]} compare={compareLabel} />
          )}
        </div>
      ))}

      {openCard && (
        <KpiDetailModal
          card={openCard}
          compareLabel={compareLabel}
          onClose={() => setOpenCard(null)}
        />
      )}
    </div>
  )
}

function DeltaArrow({ trend, size }: { trend: 'up' | 'down' | 'flat'; size: number }) {
  if (trend === 'up') return <TrendingUp size={size} />
  if (trend === 'down') return <TrendingDown size={size} />
  return <Minus size={size} />
}

function CompactRow({ m, compare }: { m: KpiMetric; compare: string }) {
  const trend = deltaTrend(m.footDelta)
  return (
    <div className="kpi-crow">
      <span className="crow-label">{m.sub}</span>
      <span className="crow-value">{m.value}</span>
      <span className="crow-delta">
        {m.footDelta && (
          <span className={`delta ${toneClass(deltaTone(m.footDelta, m.goal))}`}>
            <DeltaArrow trend={trend} size={11} />
            {m.footDelta}
          </span>
        )}
        {m.footDelta && <span className="crow-vs">{compare}</span>}
        {m.foot && <span className="crow-foot">{m.foot}</span>}
      </span>
    </div>
  )
}

function Metric({ m, compare }: { m: KpiMetric; compare: string }) {
  return (
    <>
      <div className="sub">{m.sub}</div>
      <div className="kpi-value-row">
        <span className="value">{m.value}</span>
        {m.footDelta && (
          <span className="kpi-cmp">
            <span className={`delta ${toneClass(deltaTone(m.footDelta, m.goal))}`}>
              <DeltaArrow trend={deltaTrend(m.footDelta)} size={12} />
              {m.footDelta}
            </span>
            <span className="crow-vs">{compare}</span>
          </span>
        )}
      </div>
      {m.foot && <div className="foot">{m.foot}</div>}
    </>
  )
}

function toneClass(tone: Tone) {
  if (tone === 'green') return 'pos'
  if (tone === 'red') return 'neg'
  if (tone === 'orange' || tone === 'yellow') return 'warn'
  return ''
}
