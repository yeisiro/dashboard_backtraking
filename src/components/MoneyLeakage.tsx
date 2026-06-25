import { useState } from 'react'
import { Info, ArrowUpRight, TrendingUp } from 'lucide-react'
import { leakBars } from '../data'

const ticks = ['$0', '$2k', '$4k', '$6k', '$8k', '$10k']

export default function MoneyLeakage() {
  const [seg, setSeg] = useState<'general' | 'planned' | 'executed'>('general')

  return (
    <section className="card">
      <div className="card-head">
        <div className="title">
          <span className="eyebrow">Money Lekeage Breakdown</span>
          <Info size={14} color="var(--text-muted)" />
        </div>
        <button className="btn-ghost">
          Compare <ArrowUpRight size={13} />
        </button>
      </div>

      <div className="leak-body">
        <div className="leak-amount">
          <span className="big">$0.00</span>
          <span className="wow pos">
            <TrendingUp size={12} style={{ verticalAlign: '-1px' }} /> +0.4 pp WoW
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
    </section>
  )
}
