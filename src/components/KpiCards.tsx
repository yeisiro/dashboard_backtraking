import { ArrowUpRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { kpis } from '../data'

export default function KpiCards() {
  return (
    <div className="kpi-row">
      {kpis.map((k) => (
        <div className="card kpi" key={k.label}>
          <div className="kpi-head">
            <span className="eyebrow">{k.label}</span>
            <ArrowUpRight size={15} color="var(--text-muted)" />
          </div>
          <div className="sub">{k.sub}</div>
          <div className="kpi-value-row">
            <span className="value">{k.value}</span>
            <span className="status">
              <i className={`dot ${k.statusTone}`} />
              {k.statusText}
            </span>
          </div>
          <div className="foot">
            {k.footDelta && (
              <span className={`delta ${toneClass(k.footTone)}`}>
                {k.trend === 'up' && <TrendingUp size={12} />}
                {k.trend === 'down' && <TrendingDown size={12} />}
                {k.trend === 'flat' && <Minus size={12} />}
                {k.footDelta}
              </span>
            )}
            {!k.footDelta && k.trend === 'flat' && <Minus size={12} />}
            {k.foot && <span>{k.foot}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

function toneClass(tone: string) {
  if (tone === 'green') return 'pos'
  if (tone === 'red') return 'neg'
  if (tone === 'orange' || tone === 'yellow') return 'warn'
  return ''
}
