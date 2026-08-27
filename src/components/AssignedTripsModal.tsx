import { useState } from 'react'
import { X, Layers, Undo2 } from 'lucide-react'
import { type RepositionRow } from '../data'

const usd = (n: number) => '$' + Math.round(n).toLocaleString('en-US')

// The operative trips folded into one load's deadhead, opened for management: it
// lists them and lets the operator pick which to detach back out to standalone
// operative trips. "Detach all" reverses the whole assignment.
export default function AssignedTripsModal({
  loadRef,
  legs,
  onClose,
  onDetach,
}: {
  loadRef: string
  legs: RepositionRow[]
  onClose: () => void
  onDetach: (legIds: string[]) => void
}) {
  const [sel, setSel] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setSel((p) => {
      const n = new Set(p)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  const count = sel.size
  const totalMiles = legs.reduce((s, l) => s + l.totalMiles, 0)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal og-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="cfm-title">
            <Layers size={17} color="var(--green)" /> Operative trips in {loadRef}'s deadhead
          </span>
          <button className="cfm-x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p className="cfm-sub">
            {legs.length} operative trip{legs.length === 1 ? '' : 's'} · {totalMiles.toLocaleString()} mi
            folded into this load's deadhead. Select the ones to detach back into standalone operative
            trips; the rest stay in the deadhead.
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
                <b>{count}</b> of {legs.length} selected to detach
              </span>
            ) : (
              <span className="fd-dim">Nothing selected</span>
            )}
          </div>
        </div>

        <div className="modal-foot og-actions">
          <button className="og-act" onClick={() => onDetach(legs.map((l) => l.id))}>
            <Undo2 size={14} /> Detach all
          </button>
          <button
            className="btn-pill og-act-primary"
            disabled={count === 0}
            onClick={() => onDetach([...sel])}
          >
            <Undo2 size={14} /> Detach {count > 0 ? count : ''} selected
          </button>
        </div>
      </div>
    </div>
  )
}
