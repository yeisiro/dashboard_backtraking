import { RefreshCw, Check } from 'lucide-react'
import type { SyncState } from './ConnectFleetModal'

const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// Top-of-dashboard banner shown while a background sync runs. The sync loads
// oldest → newest, so the available window is [start, availableEnd] and the
// end date advances toward today as progress climbs.
export default function SyncBar({ sync }: { sync: SyncState }) {
  const { progress, start, target, done } = sync
  const availableEnd = new Date(start.getTime() + (target.getTime() - start.getTime()) * (progress / 100))

  return (
    <div className={`syncbar ${done ? 'done' : ''}`}>
      <div className="syncbar-fill" style={{ width: `${progress}%` }} />
      <div className="syncbar-row">
        <span className="syncbar-status">
          {done ? (
            <span className="syncbar-icon done">
              <Check size={13} strokeWidth={3} />
            </span>
          ) : (
            <RefreshCw size={15} className="refresh-spin" />
          )}
          {done ? 'Sync complete — full history available' : 'Syncing your operation'}
          <b className="syncbar-pct">{Math.round(progress)}%</b>
        </span>
        <span className="syncbar-range">
          Data available <b>{fmt(start)}</b> → <b>{fmt(availableEnd)}</b>
          {!done && <span className="syncbar-hint"> · end date advances as the sync reaches today</span>}
        </span>
      </div>
    </div>
  )
}
