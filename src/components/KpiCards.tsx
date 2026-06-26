import { ArrowUpRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { kpiCards, type KpiMetric } from '../data'
import { usePeriod } from '../PeriodContext'

export default function KpiCards() {
  const { compareLabel } = usePeriod()

  return (
    <div className="kpi-row">
      {kpiCards.map((card) => (
        <div className="card kpi" key={card.label}>
          <div className="kpi-head">
            <span className="eyebrow">{card.label}</span>
            <ArrowUpRight size={15} color="var(--text-muted)" />
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
    </div>
  )
}

function CompactRow({ m, compare }: { m: KpiMetric; compare: string }) {
  return (
    <div className="kpi-crow">
      <span className="crow-label">{m.sub}</span>
      <span className="crow-value">{m.value}</span>
      <span className="crow-delta">
        {m.footDelta && (
          <span className={`delta ${toneClass(m.footTone)}`}>
            {m.trend === 'up' && <TrendingUp size={11} />}
            {m.trend === 'down' && <TrendingDown size={11} />}
            {m.trend === 'flat' && <Minus size={11} />}
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
        <span className="status">
          <i className={`dot ${m.statusTone}`} />
          {m.statusText}
        </span>
      </div>
      <div className="foot">
        {m.footDelta && (
          <span className={`delta ${toneClass(m.footTone)}`}>
            {m.trend === 'up' && <TrendingUp size={12} />}
            {m.trend === 'down' && <TrendingDown size={12} />}
            {m.trend === 'flat' && <Minus size={12} />}
            {m.footDelta}
          </span>
        )}
        {!m.footDelta && m.trend === 'flat' && <Minus size={12} />}
        {m.footDelta && <span className="crow-vs">{compare}</span>}
        {m.foot && <span>{m.foot}</span>}
      </div>
    </>
  )
}

function toneClass(tone: string) {
  if (tone === 'green') return 'pos'
  if (tone === 'red') return 'neg'
  if (tone === 'orange' || tone === 'yellow') return 'warn'
  return ''
}
