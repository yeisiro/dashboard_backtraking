import { useState } from 'react'
import { ArrowUpRight, AlertTriangle, Truck, TrendingDown, Info, Clock, MapPin } from 'lucide-react'
import { trips, inactiveTrucks, type Tone } from '../data'
import EmptyState from './EmptyState'

// "102" hours reads as "4d 6h" — days + hours is how a dispatcher thinks about
// how long a truck has been sitting, not a raw hour count.
function formatIdle(hours: number): string {
  const d = Math.floor(hours / 24)
  const h = hours % 24
  if (d === 0) return `${h}h`
  return h === 0 ? `${d}d` : `${d}d ${h}h`
}

// How alarming the idle is scales with how long it's been sitting: a day is
// noise, two days is worth a look, three-plus days of a truck earning nothing
// is a real problem.
function idleTone(hours: number): Extract<Tone, 'yellow' | 'orange' | 'red'> {
  if (hours >= 72) return 'red'
  if (hours >= 48) return 'orange'
  return 'yellow'
}

const TONE_COLOR: Record<'yellow' | 'orange' | 'red', string> = {
  yellow: 'var(--yellow)',
  orange: 'var(--orange)',
  red: 'var(--red)',
}

type LiveTab = 'active' | 'inactive'

export default function LiveOperations({ noData = false }: { noData?: boolean }) {
  const [tab, setTab] = useState<LiveTab>('active')
  const longestIdle = inactiveTrucks.reduce((m, t) => Math.max(m, t.idleHours), 0)

  return (
    <section className="card">
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
                    <div className="trip-route">{t.route}</div>
                  </div>
                  <div className="trip-leak">
                    {t.leakLabel && <span style={{ color: 'var(--text-muted)' }}>{t.leakLabel} </span>}
                    <span className={t.leakTone === 'red' ? 'neg' : ''} style={{ fontWeight: 600 }}>
                      {t.leakValue}
                    </span>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="live-leak">
                <span className="big">{inactiveTrucks.length}</span>
                <span className="lbl">Trucks idle · no load</span>
                <span className="hour" style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
                  <Clock size={12} style={{ verticalAlign: '-1px' }} /> longest{' '}
                  <span style={{ color: TONE_COLOR[idleTone(longestIdle)], fontWeight: 600 }}>
                    {formatIdle(longestIdle)}
                  </span>{' '}
                  idle
                </span>
              </div>

              {inactiveTrucks.map((t, i) => {
                const tone = idleTone(t.idleHours)
                return (
                  <div className="trip" key={i}>
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
                            Last assigned load {t.lastLoadDays} days ago
                          </span>
                        </span>
                      </div>
                      <div className="trip-route">Current location</div>
                    </div>
                    <div className="trip-leak">
                      <span style={{ color: 'var(--text-muted)' }}>Idle </span>
                      <span style={{ color: TONE_COLOR[tone], fontWeight: 600 }}>
                        {formatIdle(t.idleHours)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </>
      )}
    </section>
  )
}
