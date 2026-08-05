import { useMemo, useState } from 'react'
import { ArrowUpRight, AlertTriangle, Truck, TrendingDown, Info, MapPin, ArrowUp, ArrowDown } from 'lucide-react'
import { trips, inactiveTrucks, type Tone } from '../data'
import EmptyState from './EmptyState'

const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? '' : 's'}`

// The longer a truck goes without a load assigned, the more it matters: a
// couple of days is normal churn, a week is worth a look, two-plus weeks of a
// truck earning nothing is a real problem.
function unassignedTone(days: number): Extract<Tone, 'yellow' | 'orange' | 'red'> {
  if (days >= 14) return 'red'
  if (days >= 7) return 'orange'
  return 'yellow'
}

// Absolute date a load was last assigned, for the exact-date hover tooltip.
function sinceDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const TONE_COLOR: Record<'yellow' | 'orange' | 'red', string> = {
  yellow: 'var(--yellow)',
  orange: 'var(--orange)',
  red: 'var(--red)',
}

type LiveTab = 'active' | 'inactive'
type SortDir = 'desc' | 'asc'

export default function LiveOperations({ noData = false }: { noData?: boolean }) {
  const [tab, setTab] = useState<LiveTab>('active')
  // Sort the inactive list by time-without-a-load; default longest-first.
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const sortedInactive = useMemo(
    () =>
      [...inactiveTrucks].sort((a, b) =>
        sortDir === 'desc' ? b.unassignedDays - a.unassignedDays : a.unassignedDays - b.unassignedDays,
      ),
    [sortDir],
  )

  return (
    <section className="card live-card">
      <div className="live-head">
        <div className="title">
          <i className="dot green" />
          <span className="eyebrow">Live Operation Monitoring</span>
          <span className="info-tip" tabIndex={0}>
            <Info size={14} color="var(--text-muted)" />
            <span className="info-tip-bubble" role="tooltip">
              Real-time view of active trips leaking money right now, plus idle trucks
              with no load assigned that have been sitting still too long.
            </span>
          </span>
        </div>
        {!noData && (
          <button className="btn-ghost">
            View All trips <ArrowUpRight size={13} />
          </button>
        )}
      </div>

      {noData ? (
        <EmptyState />
      ) : (
        <>
          <div className="live-tabs">
            <button
              className={`live-tab ${tab === 'active' ? 'active' : ''}`}
              onClick={() => setTab('active')}
            >
              Active
              <span className="live-tab-count">{trips.length}</span>
            </button>
            <button
              className={`live-tab ${tab === 'inactive' ? 'active' : ''}`}
              onClick={() => setTab('inactive')}
            >
              Inactive
              <span className="live-tab-count">{inactiveTrucks.length}</span>
            </button>
          </div>

          {tab === 'active' ? (
            <>
              <div className="live-leak">
                <span className="big">-$0.00</span>
                <span className="lbl">Money Leaks Live</span>
                <span className="hour pos">
                  <TrendingDown size={12} style={{ verticalAlign: '-1px' }} /> -$0.00{' '}
                  <span style={{ color: 'var(--text-muted)' }}>in the last hour</span>
                </span>
              </div>

              <div className="live-list">
              {trips.map((t, i) => (
                <div className="trip" key={i}>
                  <span className="truck-id">{t.id}</span>
                  <span className={`class-badge ${t.cls.toLowerCase()}`}>
                    <Truck size={11} />
                    CLASS {t.cls}
                  </span>
                  <div className="trip-mid">
                    <div className="trip-alert">
                      {t.alertTone !== 'gray' && (
                        <AlertTriangle
                          size={12}
                          color={t.alertTone === 'orange' ? 'var(--orange)' : 'var(--yellow)'}
                        />
                      )}
                      <span
                        style={{
                          color:
                            t.alertTone === 'gray'
                              ? 'var(--text-muted)'
                              : t.alertTone === 'orange'
                                ? 'var(--orange)'
                                : 'var(--yellow)',
                          fontStyle: t.alertTone === 'gray' ? 'italic' : 'normal',
                        }}
                      >
                        {t.alert}
                      </span>
                    </div>
                    <div className="trip-route">
                      <span className="trip-load">{t.loadRef}</span>
                      <span className="trip-route-sep">·</span>
                      {t.route}
                    </div>
                  </div>
                  <div className="trip-leak">
                    {t.leakLabel && <span style={{ color: 'var(--text-muted)' }}>{t.leakLabel} </span>}
                    <span className={t.leakTone === 'red' ? 'neg' : ''} style={{ fontWeight: 600 }}>
                      {t.leakValue}
                    </span>
                  </div>
                </div>
              ))}
              </div>
            </>
          ) : (
            <>
              <div className="live-leak">
                <span className="big">{inactiveTrucks.length}</span>
                <span className="lbl">Trucks with no load assigned</span>
                <button
                  className="live-sort"
                  onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
                  aria-label="Toggle sort order by time since last load"
                  title={sortDir === 'desc' ? 'Longest since last load first' : 'Shortest since last load first'}
                >
                  {sortDir === 'desc' ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
                </button>
              </div>

              <div className="live-list">
                {sortedInactive.map((t) => {
                  const tone = unassignedTone(t.unassignedDays)
                  return (
                    <div className="trip" key={t.id}>
                      <span className="truck-id">{t.id}</span>
                      <span className={`class-badge ${t.cls.toLowerCase()}`}>
                        <Truck size={11} />
                        CLASS {t.cls}
                      </span>
                      <div className="trip-mid">
                        <div className="trip-alert">
                          <MapPin size={12} color="var(--text-muted)" />
                          <span style={{ color: 'var(--text)', fontWeight: 500 }}>{t.location}</span>
                          <span className="info-tip" tabIndex={0}>
                            <Info size={12} color="var(--text-muted)" />
                            <span className="info-tip-bubble" role="tooltip">
                              Last load assigned {sinceDate(t.unassignedDays)}
                            </span>
                          </span>
                        </div>
                        <div className="trip-route">Current location</div>
                      </div>
                      <div className="trip-leak">
                        <span style={{ color: 'var(--text-muted)' }}>Last Load </span>
                        <span style={{ color: TONE_COLOR[tone], fontWeight: 600 }}>
                          {plural(t.unassignedDays, 'day')}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}> ago</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}
