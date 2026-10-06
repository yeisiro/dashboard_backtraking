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
import EmptyState from './EmptyState'
import Sparkline from './Sparkline'

export default function KpiCards({
  noData = false,
  hideMarketPosition = false,
}: {
  noData?: boolean
  hideMarketPosition?: boolean
}) {
  const { compareLabel, compareRange } = usePeriod()
  const [openCard, setOpenCard] = useState<KpiCard | null>(null)
  const cards = hideMarketPosition
    ? kpiCards.filter((c) => c.label !== 'Market Position')
    : kpiCards

  return (
    <div className={`kpi-row ${cards.length === 4 ? 'kpi-row-4' : ''}`}>
      {cards.map((card) => (
        <div className="card kpi" key={card.label}>
          <div className="kpi-head">
            <span className="eyebrow">{card.label}</span>
            {!noData && (
              <button
                className="kpi-arrow"
                data-tip={`View more details about ${card.label}`}
                onClick={() => setOpenCard(card)}
                aria-label={`View more details about ${card.label}`}
              >
                <ArrowUpRight size={15} />
              </button>
            )}
          </div>

          {noData ? (
            <EmptyState compact />
          ) : card.metrics.length > 1 ? (
            <div className="kpi-rows">
              {card.metrics.map((m, i) => (
                <CompactRow m={m} compare={compareLabel} range={compareRange} key={i} />
              ))}
            </div>
          ) : (
            <Metric m={card.metrics[0]} compare={compareLabel} range={compareRange} />
          )}
        </div>
      ))}

      {openCard && (
        <KpiDetailModal
          card={openCard}
          compareLabel={compareLabel}
          summary={hideMarketPosition}
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

function CompareLabel({ compare, range }: { compare: string; range: string }) {
  return (
    <span
      className="crow-vs cmp-tip"
      data-tip={range ? `Compared to ${range}` : 'Compared to the previous period'}
    >
      {compare}
    </span>
  )
}

function CompactRow({ m, compare, range }: { m: KpiMetric; compare: string; range: string }) {
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
        {m.footDelta && <CompareLabel compare={compare} range={range} />}
        {m.foot && <span className="crow-foot">{m.foot}</span>}
      </span>
    </div>
  )
}

function Metric({ m, compare, range }: { m: KpiMetric; compare: string; range: string }) {
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
            <CompareLabel compare={compare} range={range} />
          </span>
        )}
      </div>
      {m.foot && <div className="foot">{m.foot}</div>}
      {m.flow && (
        <div className="kpi-flow">
          <span className="kpi-flow-item pos">
            <span className="kpi-flow-lbl">Income</span>
            <span>{m.flow.income}</span>
          </span>
          <span className="kpi-flow-item neg">
            <span className="kpi-flow-lbl">Costs</span>
            <span>{m.flow.costs}</span>
          </span>
        </div>
      )}
      {m.subMetrics && (
        <div className="kpi-sub">
          {m.subMetrics.map((s) => (
            <div className="kpi-sub-row" key={s.label}>
              <span className="kpi-sub-lbl">{s.label}</span>
              <Sparkline series={s.series} color={sparkColor(deltaTone(s.delta, s.goal))} />
              <span className="kpi-sub-val">{s.value}</span>
              <span className={`kpi-sub-delta ${toneClass(deltaTone(s.delta, s.goal))}`}>
                <DeltaArrow trend={deltaTrend(s.delta)} size={10} />
                {s.delta}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function sparkColor(tone: Tone) {
  if (tone === 'green') return 'var(--green)'
  if (tone === 'red') return 'var(--red)'
  if (tone === 'orange' || tone === 'yellow') return 'var(--orange)'
  return 'var(--text-dim)'
}

function toneClass(tone: Tone) {
  if (tone === 'green') return 'pos'
  if (tone === 'red') return 'neg'
  if (tone === 'orange' || tone === 'yellow') return 'warn'
  return ''
}
