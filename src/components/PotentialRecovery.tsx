import { ArrowUpRight, ArrowDown, ArrowUp, Trophy } from 'lucide-react'
import { bottom3, top3, leaders, type RankRow } from '../data'

export default function PotentialRecovery() {
  return (
    <section className="card">
      <div className="card-head">
        <div className="title" style={{ flexWrap: 'wrap' }}>
          <span className="eyebrow">Potential Recovery</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 400 }}>
            If you improve these features of your fleet, you could earn more
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost">
            Details <ArrowUpRight size={13} />
          </button>
          <button className="btn-ghost">
            View fleet analytics <ArrowUpRight size={13} />
          </button>
        </div>
      </div>

      <div className="recovery-body">
        <div className="pill-row">
          <span className="pill green-pill">
            <span className="metric">+$88k</span> Mo/Recoverable
          </span>
          <span className="pill">
            <span className="metric pos">+12.8 pp</span> Adherence
          </span>
          <span className="pill">
            <span className="metric neg">-10.7 pp</span> Idle
          </span>
          <span className="pill">
            <span className="metric pos">+0.16</span> MPG
          </span>
          <span className="pill">The Winning Recipe</span>
          <button className="btn-teal" style={{ marginLeft: 'auto' }}>
            Recommendations
          </button>
        </div>

        <div className="recovery-cards">
          <RankCard
            title="Bottom 3 - Your Fleet"
            icon={<ArrowDown size={13} color="var(--red)" />}
            rows={bottom3}
          />
          <RankCard
            title="Top 3 - Your Fleet"
            icon={<ArrowUp size={13} color="var(--green)" />}
            rows={top3}
          />
          <RankCard
            title="Market Leaders"
            icon={<Trophy size={13} color="var(--yellow)" />}
            rows={leaders}
          />
        </div>
      </div>
    </section>
  )
}

function RankCard({
  title,
  icon,
  rows,
}: {
  title: string
  icon: React.ReactNode
  rows: RankRow[]
}) {
  return (
    <div className="mini-card">
      <div className="mini-head">
        {icon}
        {title}
      </div>
      {rows.map((r, i) => (
        <div className="mini-row" key={i}>
          <span className="rank">{r.rank}</span>
          <span className="name">{r.name}</span>
          {r.you && <span className="badge-you">Your truck</span>}
          <span className={`val ${r.tone === 'red' ? 'neg' : 'pos'}`}>{r.value}</span>
        </div>
      ))}
      <button className="mini-more">View More</button>
    </div>
  )
}
