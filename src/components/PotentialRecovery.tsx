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
import { usePeriod, currentPeriodLabel } from '../PeriodContext'

export type FleetMode = 'full' | 'small' | 'single' | 'empty'

// Short suffix for the selected window: nice "/wk" and "/mo" for the common
// presets, generic "/Nd" otherwise. The exact dates go in the hover tooltip.
function periodSuffix(days: number): string {
  if (days === 7) return '/wk'
  if (days === 30) return '/mo'
  return `/${days}d`
}

// Weekly baseline scaled to the selected window, e.g. -310/wk over 30 days.
function periodValue(weekly: number, days: number): string {
  const total = Math.round((weekly / 7) * days)
  const sign = total >= 0 ? '+' : '-'
  return `${sign}$${Math.abs(total).toLocaleString('en-US')}`
}

// Total upside from acting on all recommendations. Stated as a monthly figure
// ($10.5k/mo) and scaled to the selected window so it matches the per-row values.
const MONTHLY_UPSIDE = 10500
function upsideForWindow(days: number): string {
  const total = (MONTHLY_UPSIDE / 30) * days
  return `$${(total / 1000).toFixed(1)}k${periodSuffix(days)}`
}

const FLEET_DATA: Record<FleetMode, { bottom: RankRow[]; top: RankRow[]; leaders: RankRow[] }> = {
  full: { bottom: bottom5, top: top5, leaders },
  small: { bottom: bottomSmall, top: topSmall, leaders },
  single: { bottom: bottomSingle, top: topSingle, leaders },
  empty: { bottom: [], top: [], leaders: [] },
}

export default function PotentialRecovery({ fleetMode = 'full' }: { fleetMode?: FleetMode }) {
  const [showRecs, setShowRecs] = useState(false)
  const [showMarket, setShowMarket] = useState(false)
  const { rangeDays, rangeEnd } = usePeriod()
  const data = FLEET_DATA[fleetMode]
  const noData = fleetMode === 'empty'
  const bottomTitle = "Bottom - What's dragging you down"
  const topTitle = "Top - What's going well"
  const rangeLabel = currentPeriodLabel(rangeEnd, rangeDays)

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
              By acting on these, you could earn an extra{' '}
              <strong>{upsideForWindow(rangeDays)}</strong>
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
            days={rangeDays}
            rangeLabel={rangeLabel}
          />
          <RankCard
            title={topTitle}
            icon={<ArrowUp size={13} color="var(--green)" />}
            rows={data.top}
            days={rangeDays}
            rangeLabel={rangeLabel}
          />
          <RankCard
            title="Market Leaders"
            icon={<Trophy size={13} color="var(--yellow)" />}
            rows={data.leaders}
            days={rangeDays}
            rangeLabel={rangeLabel}
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
  days,
  rangeLabel,
}: {
  title: string
  icon: React.ReactNode
  rows: RankRow[]
  days: number
  rangeLabel: string
}) {
  const suffix = periodSuffix(days)
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
              <span
                className={`val cf-tip ${r.tone === 'red' ? 'neg' : 'pos'}`}
                data-tip={rangeLabel}
              >
                {periodValue(r.weekly, days)}
                <span className="val-per">{suffix}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
