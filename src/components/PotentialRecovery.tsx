import { useState } from 'react'
import { ArrowDown, ArrowUp, Info, Trophy, Star, BarChart3 } from 'lucide-react'
import {
  bottom5,
  top5,
  bottomSmall,
  topSmall,
  bottomSingle,
  topSingle,
  leaders,
  bottomDrivers,
  topDrivers,
  driverLeaders,
  causeText,
  type Cause,
  type RankRow,
} from '../data'
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

// Every metric is a ratio now (except fuel, a ¢/gal premium), so magnitude
// reads at a glance and nothing scales with the selected date range.
function causeMetricLabel(cause: Cause, metric: number): string {
  switch (cause) {
    case 'idle':
    case 'deviation':
    case 'empty':
      return `${metric}%`
    case 'fuel':
      // metric is stored in cents/gal; every other $ figure in the app uses
      // dollars, so render it that way here too instead of mixing ¢ and $.
      return `$${(metric / 100).toFixed(2)}/gal`
  }
}

const FLEET_DATA: Record<FleetMode, { bottom: RankRow[]; top: RankRow[]; leaders: RankRow[] }> = {
  full: { bottom: bottom5, top: top5, leaders },
  small: { bottom: bottomSmall, top: topSmall, leaders },
  single: { bottom: bottomSingle, top: topSingle, leaders },
  empty: { bottom: [], top: [], leaders: [] },
}

const COUNT_OPTIONS = [5, 10, 15]

export default function PotentialRecovery({
  fleetMode = 'full',
  view = 'dashboard',
  dimension = 'trucks',
  hideLeaders = false,
  hideCompare = false,
  onViewTrips,
}: {
  fleetMode?: FleetMode
  view?: 'summary' | 'dashboard'
  dimension?: 'trucks' | 'drivers'
  hideLeaders?: boolean
  hideCompare?: boolean
  onViewTrips?: (band: 'best' | 'worst', members?: string[]) => void
}) {
  const [showMarket, setShowMarket] = useState(false)
  const [count, setCount] = useState(5)
  const { rangeDays, rangeEnd } = usePeriod()
  const noData = fleetMode === 'empty'
  // Drivers mode ranks the roster by driver instead of truck; the demo
  // fleet-size modes (small/single) stay truck-based.
  const data =
    dimension === 'drivers' && !noData
      ? { bottom: bottomDrivers, top: topDrivers, leaders: driverLeaders }
      : FLEET_DATA[fleetMode]
  const bottomTitle = "Bottom - What's dragging you down"
  const topTitle = "Top - What's going well"
  const rangeLabel = currentPeriodLabel(rangeEnd, rangeDays)

  // How many trucks the operator can choose to see, capped by how many the
  // fleet actually has. Only offered in V2.
  const maxRows = Math.max(data.bottom.length, data.top.length, data.leaders.length)
  const countOptions = COUNT_OPTIONS.filter((n) => n <= maxRows)
  if (countOptions.length === 0 && maxRows > 0) countOptions.push(maxRows)
  const showCount = view === 'dashboard' && !noData && countOptions.length > 1
  const effCount = view === 'dashboard' ? Math.min(count, maxRows) : 5

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
            {showCount && (
              <div className="pr-count" role="group" aria-label="Trucks to show">
                <span className="pr-count-lbl">Show</span>
                {countOptions.map((n) => (
                  <button
                    key={n}
                    className={`pr-count-btn ${effCount === n ? 'active' : ''}`}
                    onClick={() => setCount(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
            {!hideCompare && (
              <button className="btn-teal" onClick={() => setShowMarket(true)}>
                <BarChart3 size={13} /> Compare to market
              </button>
            )}
          </div>
        )}
      </div>

      <div className="recovery-body">
        <div className={`recovery-cards ${hideLeaders ? 'two' : ''}`}>
          <RankCard
            title={bottomTitle}
            icon={<ArrowDown size={13} color="var(--red)" />}
            rows={data.bottom.slice(0, effCount)}
            days={rangeDays}
            rangeLabel={rangeLabel}
          />
          <RankCard
            title={topTitle}
            icon={<ArrowUp size={13} color="var(--green)" />}
            rows={data.top.slice(0, effCount)}
            days={rangeDays}
            rangeLabel={rangeLabel}
          />
          {!hideLeaders && (
            <RankCard
              title="Market Leaders"
              icon={<Trophy size={13} color="var(--yellow)" />}
              rows={data.leaders.slice(0, effCount)}
              days={rangeDays}
              rangeLabel={rangeLabel}
            />
          )}
        </div>
      </div>

      {showMarket && (
        <MarketBenchmarkModal
          onClose={() => setShowMarket(false)}
          onViewTrips={onViewTrips}
          v2={view === 'dashboard'}
          dimension={dimension}
          worstTrucks={data.bottom.slice(0, effCount).map((r) => r.name)}
          bestTrucks={data.top.slice(0, effCount).map((r) => r.name)}
        />
      )}
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
              {r.cause && r.metric !== undefined && (
                <span className="issue">
                  {causeText(r.cause, causeMetricLabel(r.cause, r.metric))}
                </span>
              )}
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
