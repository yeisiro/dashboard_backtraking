import { ArrowUpRight, AlertTriangle, Truck, TrendingDown, Info } from 'lucide-react'
import { trips } from '../data'
import EmptyState from './EmptyState'

export default function LiveOperations({ noData = false }: { noData?: boolean }) {
  return (
    <section className="card">
      <div className="live-head">
        <div className="title">
          <i className="dot green" />
          <span className="eyebrow">Live Operation Monitoring</span>
          <span className="info-tip" tabIndex={0}>
            <Info size={14} color="var(--text-muted)" />
            <span className="info-tip-bubble" role="tooltip">
              Real-time view of active trips and the money leaking right now across your fleet.
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
                  color={
                    t.alertTone === 'orange'
                      ? 'var(--orange)'
                      : 'var(--yellow)'
                  }
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
            {t.leakLabel && (
              <span style={{ color: 'var(--text-muted)' }}>{t.leakLabel} </span>
            )}
            <span className={t.leakTone === 'red' ? 'neg' : ''} style={{ fontWeight: 600 }}>
              {t.leakValue}
            </span>
          </div>
        </div>
          ))}
        </>
      )}
    </section>
  )
}
