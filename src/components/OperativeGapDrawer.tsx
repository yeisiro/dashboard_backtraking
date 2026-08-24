import { useState } from 'react'
import { X, Route, Flag, Merge, CornerDownRight } from 'lucide-react'
import { type RepositionRow } from '../data'

const usd = (n: number) => '$' + Math.round(n).toLocaleString('en-US')

// The empty gap as a timeline: previous delivery → each DH leg → next pickup.
// The operator selects a consecutive run of legs and either merges them into one
// operative trip, or assigns the run to the next load's deadhead. Both require a
// consecutive selection; assigning also requires it to reach the pickup (the
// last leg), since a load's deadhead is the empty stretch immediately before it.
export default function OperativeGapDrawer({
  legs,
  nextLoad,
  onClose,
  onMerge,
  onAssign,
}: {
  legs: RepositionRow[]
  nextLoad: { id: string; lane: string }
  onClose: () => void
  onMerge: (ids: string[]) => void
  onAssign: (ids: string[]) => void
}) {
  const [sel, setSel] = useState<Set<string>>(new Set())
  if (legs.length === 0) return null

  const first = legs[0]
  const last = legs[legs.length - 1]
  const toggle = (id: string) =>
    setSel((p) => {
      const n = new Set(p)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const selectedIdx = legs.map((l, i) => (sel.has(l.id) ? i : -1)).filter((i) => i >= 0)
  const count = selectedIdx.length
  const contiguous =
    count > 0 && selectedIdx[count - 1] - selectedIdx[0] === count - 1
  const includesLast = sel.has(last.id)
  const selIds = legs.filter((l) => sel.has(l.id)).map((l) => l.id)
  const selMiles = legs.filter((l) => sel.has(l.id)).reduce((s, l) => s + l.totalMiles, 0)
  const selCost = legs.filter((l) => sel.has(l.id)).reduce((s, l) => s + l.cost, 0)

  const canMerge = count >= 2 && contiguous
  const canAssign = count >= 1 && contiguous && includesLast

  const hint =
    count >= 2 && !contiguous
      ? 'Merge and assign need consecutive legs — pick an unbroken run.'
      : count >= 1 && contiguous && !includesLast
        ? `To assign to ${nextLoad.id}'s deadhead, the run must reach the pickup (include the last leg).`
        : ''

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal og-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="cfm-title">
            <Route size={17} color="var(--blue)" /> Manage empty gap · {first.truck}
          </span>
          <button className="cfm-x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p className="cfm-sub">
            {first.driver} · {legs.length} empty {legs.length === 1 ? 'leg' : 'legs'} running into the next
            load. Select consecutive legs to merge them, or assign the run to that load's deadhead.
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

            <div className="og-endpoint">
              <span className="og-ep-icon pickup"><Flag size={13} /></span>
              <div className="og-ep-txt">
                <span className="og-ep-title">Next load · {nextLoad.id}</span>
                <span className="og-ep-sub">{nextLoad.lane} · assigning extends this load's deadhead</span>
              </div>
            </div>
          </div>

          <div className="og-selbar">
            {count > 0 ? (
              <span>
                <b>{count}</b> selected · {selMiles.toLocaleString()} mi · {usd(selCost)}
              </span>
            ) : (
              <span className="fd-dim">Nothing selected</span>
            )}
          </div>
          {hint && <p className="og-hint">{hint}</p>}
        </div>

        <div className="modal-foot og-actions">
          <button className="og-act" disabled={!canAssign} onClick={() => onAssign(selIds)}>
            <CornerDownRight size={14} /> Assign to {nextLoad.id} deadhead
          </button>
          <button className="btn-pill og-act-primary" disabled={!canMerge} onClick={() => onMerge(selIds)}>
            <Merge size={14} /> Merge {count >= 2 ? count : ''} legs
          </button>
        </div>
      </div>
    </div>
  )
}
