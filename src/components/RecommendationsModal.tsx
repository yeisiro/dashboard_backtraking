import { useState } from 'react'
import { X, TrendingUp, ArrowRight, ArrowUpRight, Map, Database, PiggyBank, Compass } from 'lucide-react'
import { recommendations, type Recommendation } from '../data'

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
          <button className="cfm-x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
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
                      <span className="cmp-title">{r.action}</span>
                      <span className="recs-cat">{r.category}</span>
                      <span className="recs-impact pos">{r.impact}</span>
                    </div>
                    <div className="cmp-cols">
                      <div className="cmp-col yours">
                        <span className="cmp-tag">This is what you did</span>
                        <span className="cmp-route">{r.yourRoute}</span>
                        <span className="cmp-cost">
                          Your cost <b>{r.yourCost}</b>
                        </span>
                      </div>
                      <span className="cmp-arrow-wrap">
                        <ArrowRight size={15} />
                      </span>
                      <div className="cmp-col rec">
                        <span className="cmp-tag">A better route</span>
                        <span className="cmp-route">{r.betterRoute}</span>
                        <span className="cmp-cost">
                          Would've cost <b>{r.betterCost}</b>
                        </span>
                      </div>
                    </div>
                    {(r.whyLess || r.setsUp) && (
                      <div className="cmp-notes">
                        {r.whyLess && (
                          <div className="cmp-note">
                            <span className="cmp-note-icon">
                              <PiggyBank size={14} />
                            </span>
                            <span className="cmp-note-text">
                              <b>Why it costs less</b>
                              {r.whyLess}
                            </span>
                          </div>
                        )}
                        {r.setsUp && (
                          <div className="cmp-note">
                            <span className="cmp-note-icon">
                              <Compass size={14} />
                            </span>
                            <span className="cmp-note-text">
                              <b>Where it leaves you</b>
                              {r.setsUp}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="cmp-list-foot">
                <button className="cmp-view" onClick={() => setNavOpen(true)}>
                  View route <ArrowUpRight size={14} />
                </button>
              </div>
            </>
          ) : (
            <div className="recs-list">
              {items.map((r) => (
                <div className="recs-row" key={r.rank}>
                  <span className="recs-rank">{r.rank}</span>
                  <div className="recs-text">
                    <span className="recs-action">{r.action}</span>
                    <span className="recs-detail">{r.detail}</span>
                  </div>
                  <span className="recs-cat">{r.category}</span>
                  <span className="recs-impact pos">{r.impact}</span>
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
