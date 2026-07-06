import { useState } from 'react'
import { X, TrendingUp, ArrowRight, ArrowUpRight, Map, Database } from 'lucide-react'
import { recommendations, type Recommendation, type PlanMetric } from '../data'

// What each metric means, shown on hover. Keyed by label so it's shared across
// every route rather than repeated in the data.
const METRIC_TIPS: Record<string, string> = {
  Income: 'Revenue this plan books — what the loads on the route pay.',
  Cost: 'All-in cost to run the plan: fuel, tolls, driver hours and deadhead.',
  Booking: 'How likely these loads are to book as planned — higher means less risk of the plan falling through.',
  Connectivity: 'How well the plan sets up your next load — higher means less empty repositioning after.',
}

function PlanMetrics({ metrics }: { metrics?: PlanMetric[] }) {
  if (!metrics?.length) return null
  return (
    <ul className="cmp-metrics">
      {metrics.map((m, i) => (
        <li
          key={m.label}
          className={`cmp-metric${i >= 2 ? ' tip-right' : ''}`}
          data-tip={METRIC_TIPS[m.label]}
        >
          <b>{m.value}</b>
          <span>{m.label}</span>
        </li>
      ))}
    </ul>
  )
}

export default function RecommendationsModal({
  title = 'What to improve',
  subtitle,
  items = recommendations,
  onClose,
}: {
  title?: string
  subtitle?: string
  items?: Recommendation[]
  onClose: () => void
}) {
  // When items carry a route comparison, render the "your route vs. a better route" view.
  const isCompare = items.some((r) => r.yourRoute && r.betterRoute)
  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal recs-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="cfm-title">
            <TrendingUp size={17} color="var(--green)" /> {title}
          </span>
          <div className="modal-head-actions">
            {isCompare && (
              <button className="cmp-view" onClick={() => setNavOpen(true)}>
                Try new routes <ArrowUpRight size={14} />
              </button>
            )}
            <button className="cfm-x" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          {subtitle && <p className="cfm-sub">{subtitle}</p>}

          {isCompare ? (
            <>
              <div className="cmp-list">
                {items.map((r) => (
                  <div className="cmp-item" key={r.rank}>
                    <div className="cmp-item-head">
                      <span className="recs-rank">{r.rank}</span>
                      <span className="cmp-save">
                        save <b>{r.impact.replace('+', '')}</b>
                      </span>
                    </div>
                    <div className="cmp-cols">
                      <div className="cmp-col yours">
                        <span className="cmp-tag">You ran</span>
                        <span className="cmp-route">{r.yourRoute}</span>
                        <PlanMetrics metrics={r.yourMetrics} />
                      </div>
                      <span className="cmp-arrow-wrap">
                        <ArrowRight size={16} />
                      </span>
                      <div className="cmp-col rec">
                        <span className="cmp-tag">We'd route</span>
                        <span className="cmp-route">{r.betterRoute}</span>
                        <PlanMetrics metrics={r.betterMetrics} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="recs-list">
              {items.map((r) => (
                <div className="rec-card" key={r.rank}>
                  <div className="rec-card-head">
                    <span className="recs-rank">{r.rank}</span>
                    <span className="rec-card-title">{r.action}</span>
                    <span className="recs-cat">{r.category}</span>
                    <span className="recs-impact pos">{r.impact}</span>
                  </div>
                  <div className="rec-cols">
                    <div className="rec-col wrong">
                      <span className="rec-tag neg">What went wrong</span>
                      <span className="rec-col-text">{r.problem ?? r.detail}</span>
                    </div>
                    <span className="rec-arrow-wrap">
                      <ArrowRight size={15} />
                    </span>
                    <div className="rec-col right">
                      <span className="rec-tag pos">What to do</span>
                      <span className="rec-col-text">{r.fix ?? r.action}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {navOpen && (
        <div
          className="nav-hint-overlay"
          onClick={(e) => {
            e.stopPropagation()
            setNavOpen(false)
          }}
        >
          <div className="nav-hint" onClick={(e) => e.stopPropagation()}>
            <div className="nav-hint-head">
              <span className="nav-hint-heading">Where this takes you</span>
              <button className="cfm-x" onClick={() => setNavOpen(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <p className="nav-hint-sub">Pick where you want to review these routes.</p>
            <button className="nav-hint-opt">
              <span className="nav-hint-icon blue">
                <Map size={16} />
              </span>
              <span className="nav-hint-opt-text">
                <b>Routes</b>
                <small>See this lane on the map and apply eFrouting’s suggested plan.</small>
              </span>
              <ArrowRight size={15} className="nav-hint-arrow" />
            </button>
            <button className="nav-hint-opt">
              <span className="nav-hint-icon green">
                <Database size={16} />
              </span>
              <span className="nav-hint-opt-text">
                <b>Data</b>
                <small>Dig into the underlying loads, costs and timestamps.</small>
              </span>
              <ArrowRight size={15} className="nav-hint-arrow" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
