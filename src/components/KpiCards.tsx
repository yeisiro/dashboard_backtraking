import { ArrowUpRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { kpiCards, type KpiMetric } from '../data'

export default function KpiCards() {
  return (
    <div className="kpi-row">
      {kpiCards.map((card) => (
        <div className={`card kpi ${card.wide ? 'kpi-wide' : ''}`} key={card.label}>
          <div className="kpi-head">
            <span className="eyebrow">{card.label}</span>
            <ArrowUpRight size={15} color="var(--text-muted)" />
          </div>

          {card.metrics.length > 1 ? (
            <div className="kpi-rows">
              {card.metrics.map((m, i) => (
                <CompactRow m={m} key={i} />
              ))}
            </div>
          ) : (
            <Metric m={card.metrics[0]} />
          )}
        </div>
      ))}
    </div>
  )
}

function CompactRow({ m }: { m: KpiMetric }) {
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
        {m.foot && <span className="crow-foot">{m.foot}</span>}
      </span>
      <span className="status">
        <i className={`dot ${m.statusTone}`} />
        {m.statusText}
      </span>
    </div>
  )
}

function Metric({ m }: { m: KpiMetric }) {
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
