import { useMemo, useState } from 'react'
import { X, ArrowLeft, Search, Check, Trash2, Plus, RefreshCw } from 'lucide-react'
import { CABIN_POOL, SYNC_PERIODS, monthsForPeriod, type PeriodKey, type FleetCabin } from '../data'

// Native <select> for a cabin's sync window. Native so its popup escapes the
// modal's overflow clipping and stays usable inside the scrolling list.
function RangeSelect({
  value,
  onChange,
  className = '',
}: {
  value: PeriodKey
  onChange: (v: PeriodKey) => void
  className?: string
}) {
  return (
    <select
      className={`mf-select ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value as PeriodKey)}
    >
      {SYNC_PERIODS.map((p) => (
        <option key={p.key} value={p.key}>
          {p.label}
        </option>
      ))}
    </select>
  )
}

interface Props {
  onClose: () => void
  fleet: FleetCabin[]
  onUpdateRange: (id: string, range: PeriodKey) => void
  onRemove: (id: string) => void
  onAddCabins: (ids: string[], range: PeriodKey) => void
  // Kick off a background sync covering `months` of history — called on finish
  // when new cabins were added or an existing window was widened.
  onSync: (months: number) => void
}

export default function ManageFleetModal({
  onClose,
  fleet,
  onUpdateRange,
  onRemove,
  onAddCabins,
  onSync,
}: Props) {
  const [mode, setMode] = useState<'list' | 'add'>('list')
  // Largest window (in months) that still needs syncing because it was added or
  // widened this session. Deeper history is what forces a re-pull, so a smaller
  // window or a removal never sets it. Drives the finish-time sync + its label.
  const [pendingMonths, setPendingMonths] = useState(0)

  const changeRange = (id: string, next: PeriodKey) => {
    const current = fleet.find((c) => c.id === id)
    const widened = current && monthsForPeriod(next) > monthsForPeriod(current.range)
    onUpdateRange(id, next)
    if (widened) setPendingMonths((m) => Math.max(m, monthsForPeriod(next)))
  }

  const finish = () => {
    if (pendingMonths > 0) onSync(pendingMonths)
    onClose()
  }

  // Manage list
  const [query, setQuery] = useState('')
  const fleetIds = useMemo(() => new Set(fleet.map((c) => c.id)), [fleet])
  const listShown = fleet.filter((c) => c.id.toLowerCase().includes(query.toLowerCase()))

  // Add mode
  const [addQuery, setAddQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [addRange, setAddRange] = useState<PeriodKey>('3m')
  const available = useMemo(() => CABIN_POOL.filter((id) => !fleetIds.has(id)), [fleetIds])
  const addShown = available.filter((id) => id.toLowerCase().includes(addQuery.toLowerCase()))
  const allAddShownSelected = addShown.length > 0 && addShown.every((id) => selected.includes(id))

  const toggleAdd = (id: string) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const toggleAllAdd = () =>
    setSelected((p) =>
      allAddShownSelected ? p.filter((id) => !addShown.includes(id)) : [...new Set([...p, ...addShown])],
    )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal cfm" onClick={(e) => e.stopPropagation()}>
        {mode === 'list' ? (
          <>
            <div className="modal-head">
              <span style={{ width: 18 }} />
              <span className="cfm-title">Manage fleet</span>
              <button className="cfm-x" onClick={onClose} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p className="cfm-sub">
                {fleet.length} {fleet.length === 1 ? 'cabin' : 'cabins'} linked. Adjust each cabin's sync
                window or remove it from your fleet.
              </p>
              <div className="tf-search">
                <Search size={15} color="var(--text-muted)" />
                <input
                  placeholder="Search by ID or plate..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              <div className="tf-scroll mf-list">
                {listShown.length === 0 ? (
                  <p className="mf-empty">No cabins match your search.</p>
                ) : (
                  listShown.map((c) => (
                    <div className="mf-row" key={c.id}>
                      <span className="mf-id">{c.id}</span>
                      <div className="mf-row-right">
                        <span className="mf-range-label">Sync</span>
                        <RangeSelect value={c.range} onChange={(v) => changeRange(c.id, v)} />
                        <button
                          className="mf-remove"
                          onClick={() => onRemove(c.id)}
                          aria-label={`Remove cabin ${c.id}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="modal-foot">
              <button className="cfm-add-btn" onClick={() => setMode('add')}>
                <Plus size={16} /> Add cabins
              </button>
              {pendingMonths > 0 && (
                <span className="mf-pending">
                  <RefreshCw size={13} /> Changes will sync on finish
                </span>
              )}
              <button className="btn-pill" onClick={finish}>
                {pendingMonths > 0 ? 'Sync & finish' : 'Done'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="modal-head">
              <button className="cfm-back" onClick={() => setMode('list')} aria-label="Back">
                <ArrowLeft size={18} />
              </button>
              <span className="cfm-title">Add cabins</span>
              <button className="cfm-x" onClick={onClose} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p className="cfm-sub">Pick more cabins from your TMS &amp; ELD and choose how much history to sync.</p>

              <div className="field">
                <label>Sync window for new cabins</label>
                <RangeSelect value={addRange} onChange={setAddRange} className="mf-select-block" />
              </div>

              <div className="tf-search">
                <Search size={15} color="var(--text-muted)" />
                <input
                  placeholder="Search by ID or plate..."
                  value={addQuery}
                  onChange={(e) => setAddQuery(e.target.value)}
                />
              </div>
              <div className="lc-bar">
                <span className="lc-count">
                  {selected.length} of {available.length} selected
                </span>
                <button className="lc-selectall" onClick={toggleAllAdd}>
                  {allAddShownSelected ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="tf-scroll lc-list">
                {addShown.length === 0 ? (
                  <p className="mf-empty">No more cabins available to add.</p>
                ) : (
                  addShown.map((id) => {
                    const sel = selected.includes(id)
                    return (
                      <button key={id} className={`lc-row ${sel ? 'sel' : ''}`} onClick={() => toggleAdd(id)}>
                        <span className="lc-box">{sel && <Check size={13} strokeWidth={3} />}</span>
                        <span className="lc-id">{id}</span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div className="modal-foot">
              <button className="btn-text" onClick={() => setMode('list')}>
                Cancel
              </button>
              <button
                className="btn-pill"
                disabled={selected.length === 0}
                onClick={() => {
                  onAddCabins(selected, addRange)
                  setPendingMonths((m) => Math.max(m, monthsForPeriod(addRange)))
                  setSelected([])
                  setMode('list')
                }}
              >
                Add cabins
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
