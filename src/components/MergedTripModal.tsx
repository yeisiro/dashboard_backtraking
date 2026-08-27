import { useState } from 'react'
import { X, Merge, Split } from 'lucide-react'
import { type RepositionRow } from '../data'

const usd = (n: number) => '$' + Math.round(n).toLocaleString('en-US')

// A merged operative trip, opened for management: it lists the legs that were
// combined and lets the operator pick which ones to separate back out. The rest
// stay merged. "Separate all" dissolves the merge entirely.
export default function MergedTripModal({
  merged,
  onClose,
  onSeparate,
}: {
  merged: RepositionRow
  onClose: () => void
  // legIds: the legs to pull back out to standalone operative trips.
  onSeparate: (legIds: string[]) => void
}) {
  const legs = merged.mergedFrom ?? []
  const [sel, setSel] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setSel((p) => {
      const n = new Set(p)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  const count = sel.size
  const allIds = legs.map((l) => l.id)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal og-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="cfm-title">
            <Merge size={17} color="var(--green)" /> Merged operative trip · {merged.truck}
          </span>
          <button className="cfm-x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p className="cfm-sub">
            {merged.driver} · {legs.length} operative trips merged into one — {merged.lane}. Select the
            ones to separate back into their own operative trips; the rest stay merged.
          </p>

          <div className="og-timeline">
            {legs.map((l) => {
              const on = sel.has(l.id)
              return (
                <label key={l.id} className={`og-leg ${on ? 'on' : ''}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(l.id)} />
                  <span className="og-leg-body">
                    <span className="og-leg-lane">{l.lane}</span>
                    <span className="og-leg-meta">
                      {l.startDate === l.endDate ? l.startDate : `${l.startDate} → ${l.endDate}`} ·{' '}
                      {l.totalMiles.toLocaleString()} mi · {usd(l.cost)} · {l.adherence}% adherence
                    </span>
                  </span>
                </label>
              )
            })}
          </div>

          <div className="og-selbar">
            {count > 0 ? (
              <span>
                <b>{count}</b> of {legs.length} selected to separate
              </span>
            ) : (
              <span className="fd-dim">Nothing selected</span>
            )}
          </div>
        </div>

        <div className="modal-foot og-actions">
          <button className="og-act" onClick={() => onSeparate(allIds)}>
            <Split size={14} /> Separate all
          </button>
          <button
            className="btn-pill og-act-primary"
            disabled={count === 0}
            onClick={() => onSeparate([...sel])}
          >
            <Split size={14} /> Separate {count > 0 ? count : ''} selected
          </button>
        </div>
      </div>
    </div>
  )
}
