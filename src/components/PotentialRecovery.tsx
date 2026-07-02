import { useState } from 'react'
import { ArrowUpRight, ArrowDown, ArrowUp, Info, Trophy, Star, TrendingUp } from 'lucide-react'
import { bottom5, top5, leaders, type RankRow } from '../data'
import RecommendationsModal from './RecommendationsModal'

export default function PotentialRecovery() {
  const [showRecs, setShowRecs] = useState(false)
  return (
    <section className="card recovery-card">
      <div className="card-head">
        <div className="title" style={{ flexWrap: 'wrap' }}>
          <span className="eyebrow">Potential Recovery</span>
          <span
            className="cf-tip"
            data-tip="If you improve these features of your fleet, you could earn more"
          >
            <Info size={14} color="var(--text-muted)" />
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="improve-hint">
            Recover ~<strong>+$10.5k/mo</strong> with prioritized actions
          </span>
          <button className="btn-teal" onClick={() => setShowRecs(true)}>
            <TrendingUp size={13} /> What to improve
          </button>
          <button className="btn-ghost">
            View fleet analytics <ArrowUpRight size={13} />
          </button>
        </div>
      </div>

      <div className="recovery-body">
        <div className="recovery-cards">
          <RankCard
            title="Bottom 5 - What's dragging you down"
            icon={<ArrowDown size={13} color="var(--red)" />}
            rows={bottom5}
          />
          <RankCard
            title="Top 5 - What's going well"
            icon={<ArrowUp size={13} color="var(--green)" />}
            rows={top5}
          />
          <RankCard
            title="Market Leaders"
            icon={<Trophy size={13} color="var(--yellow)" />}
            rows={leaders}
          />
        </div>
      </div>

      {showRecs && <RecommendationsModal onClose={() => setShowRecs(false)} />}
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
      <div className="mini-rows">
        {rows.map((r, i) => (
          <div className="mini-row" key={i}>
            <span className="rank">{r.rank}</span>
            <span className="name">{r.name}</span>
            {r.you && (
              <span className="badge-you">
                <Star size={11} fill="var(--green)" /> Your truck
              </span>
            )}
            {r.issue && <span className="issue">{r.issue}</span>}
            <span className={`val ${r.tone === 'red' ? 'neg' : 'pos'}`}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
