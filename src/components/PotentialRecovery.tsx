import { useState } from 'react'
import { ArrowDown, ArrowUp, Info, Trophy, Star, TrendingUp, BarChart3 } from 'lucide-react'
import {
  bottom5,
  top5,
  bottomSmall,
  topSmall,
  bottomSingle,
  topSingle,
  leaders,
  type RankRow,
} from '../data'
import RecommendationsModal from './RecommendationsModal'
import MarketBenchmarkModal from './MarketBenchmarkModal'
import EmptyState from './EmptyState'

export type FleetMode = 'full' | 'small' | 'single' | 'empty'

const FLEET_DATA: Record<FleetMode, { bottom: RankRow[]; top: RankRow[]; leaders: RankRow[] }> = {
  full: { bottom: bottom5, top: top5, leaders },
  small: { bottom: bottomSmall, top: topSmall, leaders },
  single: { bottom: bottomSingle, top: topSingle, leaders },
  empty: { bottom: [], top: [], leaders: [] },
}

export default function PotentialRecovery({ fleetMode = 'full' }: { fleetMode?: FleetMode }) {
  const [showRecs, setShowRecs] = useState(false)
  const [showMarket, setShowMarket] = useState(false)
  const data = FLEET_DATA[fleetMode]
  const noData = fleetMode === 'empty'
  const bottomTitle = "Bottom - What's dragging you down"
  const topTitle = "Top - What's going well"

  return (
    <section className="card recovery-card">
      <div className="card-head">
        <div className="title" style={{ flexWrap: 'wrap' }}>
          <span className="eyebrow">Potential Savings</span>
          <span
            className="cf-tip"
            data-tip="Improve these areas of your fleet and you could save more going forward"
          >
            <Info size={14} color="var(--text-muted)" />
          </span>
        </div>
        {!noData && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="improve-hint">
              By acting on these, you could earn an extra <strong>$10.5k/mo</strong>
            </span>
            <button className="btn-teal" onClick={() => setShowRecs(true)}>
              <TrendingUp size={13} /> What to improve
            </button>
            <button className="btn-ghost" onClick={() => setShowMarket(true)}>
              <BarChart3 size={13} /> How the market is doing
            </button>
          </div>
        )}
      </div>

      <div className="recovery-body">
        <div className="recovery-cards">
          <RankCard
            title={bottomTitle}
            icon={<ArrowDown size={13} color="var(--red)" />}
            rows={data.bottom}
          />
          <RankCard
            title={topTitle}
            icon={<ArrowUp size={13} color="var(--green)" />}
            rows={data.top}
          />
          <RankCard
            title="Market Leaders"
            icon={<Trophy size={13} color="var(--yellow)" />}
            rows={data.leaders}
          />
        </div>
      </div>

      {showRecs && (
        <RecommendationsModal
          title="What to improve"
          subtitle="Prioritized fleet actions, ordered by monthly upside. Taking all of them saves about +$10.5k/mo going forward."
          onClose={() => setShowRecs(false)}
        />
      )}
      {showMarket && <MarketBenchmarkModal onClose={() => setShowMarket(false)} />}
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
      {rows.length === 0 ? (
        <EmptyState />
      ) : (
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
      )}
    </div>
  )
}
