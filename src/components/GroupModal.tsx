import { useState } from 'react'
import { X, Search, Check, Trash2 } from 'lucide-react'

interface Props {
  mode: 'new' | 'edit'
  initialName?: string
  initialTrucks?: string[]
  fleetPool: string[]
  onClose: () => void
  onSave: (name: string, trucks: string[]) => void
  onDelete?: () => void
}

export default function GroupModal({
  mode,
  initialName = '',
  initialTrucks = [],
  fleetPool,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [name, setName] = useState(initialName)
  const [selected, setSelected] = useState<string[]>(initialTrucks)
  const [search, setSearch] = useState('')

  const toggle = (id: string) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const pool = fleetPool.filter((t) =>
    t.toLowerCase().includes(search.toLowerCase()),
  )
  const canSave = name.trim().length > 0 && selected.length > 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal group-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="cfm-title">{mode === 'new' ? 'New group' : 'Edit group'}</span>
          <button className="cfm-x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>Group name</label>
            <div className="field-input">
              <input
                placeholder="e.g. Southeast lanes"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className="field gm-trucks-field">
            <label>
              Trucks <span className="gm-count">{selected.length} selected</span>
            </label>
            <div className="tf-search">
              <Search size={15} color="var(--text-muted)" />
              <input
                placeholder="Search trucks"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="tf-scroll gm-list">
            {pool.map((id) => {
              const active = selected.includes(id)
              return (
                <button
                  key={id}
                  className={`cf-item ${active ? 'active' : ''}`}
                  onClick={() => toggle(id)}
                >
                  {id}
                  {active && <Check size={17} className="cf-check" />}
                </button>
              )
            })}
          </div>
        </div>

        <div className="modal-foot">
          {mode === 'edit' && onDelete && (
            <button className="gm-delete" onClick={onDelete}>
              <Trash2 size={15} /> Delete
            </button>
          )}
          <button className="btn-text" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-pill"
            disabled={!canSave}
            onClick={() => onSave(name.trim(), selected)}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
