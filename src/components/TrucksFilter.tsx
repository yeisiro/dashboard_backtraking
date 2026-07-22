import { useState } from 'react'
import { ChevronDown, Check, CheckCircle2, AlertCircle, Search, Pencil, Plus, Truck, X } from 'lucide-react'
import AddCabModal from './AddCabModal'
import GroupModal from './GroupModal'
import { tripRows } from '../data'

type Tab = 'individual' | 'group'

interface Group {
  id: string
  name: string
  trucks: string[]
}

// The real trucks that show up in trip data (e.g. "#6120") — not the fake
// fleet-roster numbers groups still use below, which aren't wired to any
// actual filtering.
const initialTrucks = [...new Set(tripRows.map((r) => r.truck))].sort()

// Shared fleet pool that groups draw their trucks from.
const fleetPool = Array.from({ length: 14 }, (_, i) => `482${String(i + 1).padStart(2, '0')}`)

const initialGroups: Group[] = [
  { id: 'g1', name: 'Pablo alboran', trucks: fleetPool.slice(0, 8) },
  { id: 'g2', name: 'Pedro anuel', trucks: fleetPool.slice(2, 9) },
  { id: 'g3', name: 'Jose abelardo', trucks: fleetPool.slice(1, 7) },
  { id: 'g4', name: 'Ivan cepeda', trucks: fleetPool.slice(3, 12) },
]

const CHIP_ROW = 4 // trucks shown before collapsing into "+N"

// Individual trucks are capped at 10 — past that, filtering by group is the
// intended path for larger fleets, so further truck rows disable instead of
// letting the selection grow unbounded.
const MAX_SELECTED = 10

type GroupEditor =
  | { mode: 'new' }
  | { mode: 'edit'; group: Group }
  | null

export default function TrucksFilter({
  selected = [],
  onChange,
}: {
  selected?: string[]
  onChange?: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('individual')
  const [search, setSearch] = useState('')
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]) // group ids — decorative, not wired to trip filtering
  const [groups, setGroups] = useState<Group[]>(initialGroups)
  const [nextId, setNextId] = useState(5)
  const [trucks, setTrucks] = useState(initialTrucks)
  const [showAddCab, setShowAddCab] = useState(false)
  const [editor, setEditor] = useState<GroupEditor>(null)

  const isAll = selected.length === 0 && selectedGroups.length === 0
  // Once groups are mixed in, fall back to a plain combined count — the /10
  // cap only applies to individual truck selection.
  const fraction = `${selected.length}/${MAX_SELECTED} selected`
  const label = isAll
    ? 'All'
    : selectedGroups.length > 0
      ? `${selected.length + selectedGroups.length} selected`
      : fraction
  const rowCountText = isAll
    ? `All ${trucks.length} selected`
    : selectedGroups.length > 0
      ? `${selected.length + selectedGroups.length} selected`
      : fraction
  const atLimit = selected.length >= MAX_SELECTED

  const toggleTruck = (id: string) => {
    if (selected.includes(id)) {
      onChange?.(selected.filter((x) => x !== id))
    } else if (!atLimit) {
      onChange?.([...selected, id])
    }
  }
  const toggleGroup = (id: string) =>
    setSelectedGroups((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const reset = () => {
    onChange?.([])
    setSelectedGroups([])
  }

  const saveGroup = (name: string, groupTrucks: string[]) => {
    if (editor?.mode === 'edit') {
      const id = editor.group.id
      setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, name, trucks: groupTrucks } : g)))
    } else {
      setGroups((gs) => [...gs, { id: `g${nextId}`, name, trucks: groupTrucks }])
      setNextId((n) => n + 1)
    }
    setEditor(null)
  }

  const deleteGroup = () => {
    if (editor?.mode !== 'edit') return
    const id = editor.group.id
    setGroups((gs) => gs.filter((g) => g.id !== id))
    setSelectedGroups((p) => p.filter((x) => x !== id))
    setEditor(null)
  }

  const visibleTrucks = trucks.filter((t) =>
    t.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="cf">
      <button className="filter" onClick={() => setOpen((o) => !o)}>
        <Truck className="chev" size={15} />
        <span>Trucks:</span>
        <b>{label}</b>
        <ChevronDown className="chev" size={15} />
      </button>

      {open && (
        <>
          <div className="cf-backdrop" onClick={() => setOpen(false)} />
          <div className="cf-menu tf-menu">
            <div className="tf-tabs">
              <button
                className={`tf-tab ${tab === 'individual' ? 'active' : ''}`}
                onClick={() => setTab('individual')}
              >
                Individual
              </button>
              <button
                className={`tf-tab ${tab === 'group' ? 'active' : ''}`}
                onClick={() => setTab('group')}
              >
                By group
              </button>
            </div>

            {tab === 'individual' && (
              <>
                <div className="tf-search">
                  <Search size={15} color="var(--text-muted)" />
                  <input
                    placeholder="Search truck ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="tf-select-row">
                  <button className="tf-clear-all" onClick={reset}>
                    Clear all
                  </button>
                  <span className="tf-select-count">{rowCountText}</span>
                </div>
                {selected.length > 0 && (
                  <div className="tf-chips-selected">
                    {selected.map((id) => (
                      <span className="tf-chip-sel" key={id}>
                        {id}
                        <button
                          aria-label={`Remove ${id}`}
                          onClick={() => toggleTruck(id)}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {atLimit && (
                  <div className="tf-limit-banner">
                    <AlertCircle size={15} />
                    Limit reached — max {MAX_SELECTED} trucks selected
                  </div>
                )}
                <div className="tf-scroll">
                  <button className={`tf-truck-item tf-all-item ${isAll ? 'active' : ''}`} onClick={reset}>
                    All trucks
                    {isAll && <CheckCircle2 size={17} className="cf-check" />}
                  </button>
                  {visibleTrucks.map((id) => {
                    const active = selected.includes(id)
                    const disabled = !active && atLimit
                    return (
                      <button
                        key={id}
                        className={`tf-truck-item ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                        onClick={() => toggleTruck(id)}
                        disabled={disabled}
                      >
                        {id}
                        {active && <CheckCircle2 size={17} className="cf-check" />}
                      </button>
                    )
                  })}
                </div>
                <button
                  className="cf-edit-btn tf-add"
                  onClick={() => setShowAddCab(true)}
                >
                  <Plus size={15} /> Add new truck
                </button>
              </>
            )}

            {tab === 'group' && (
              <>
                <div className="tf-scroll">
                  {groups.map((group) => {
                    const active = selectedGroups.includes(group.id)
                    const shown = group.trucks.slice(0, CHIP_ROW)
                    const overflow = group.trucks.length - shown.length
                    return (
                      <div className={`tf-group ${active ? 'active' : ''}`} key={group.id}>
                        <div className="tf-group-head">
                          <button
                            className="tf-group-name"
                            onClick={() => toggleGroup(group.id)}
                          >
                            {active && <Check size={15} className="cf-check" />}
                            {group.name}
                          </button>
                          <button
                            className="tf-edit"
                            aria-label={`Edit ${group.name}`}
                            onClick={() => setEditor({ mode: 'edit', group })}
                          >
                            <Pencil size={13} />
                          </button>
                        </div>
                        <div className="tf-chips tf-chips-row">
                          {shown.map((t, i) => (
                            <span className="tf-chip" key={i}>
                              {t}
                            </span>
                          ))}
                          {overflow > 0 && (
                            <button
                              className="tf-chip tf-chip-more"
                              onClick={() => setEditor({ mode: 'edit', group })}
                            >
                              +{overflow}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <button className="cf-edit-btn tf-add" onClick={() => setEditor({ mode: 'new' })}>
                  <Plus size={15} /> New group
                </button>
              </>
            )}
          </div>
        </>
      )}

      {showAddCab && (
        <AddCabModal
          onClose={() => setShowAddCab(false)}
          onAdd={(name) => setTrucks((t) => [name, ...t])}
        />
      )}

      {editor && (
        <GroupModal
          mode={editor.mode}
          initialName={editor.mode === 'edit' ? editor.group.name : ''}
          initialTrucks={editor.mode === 'edit' ? editor.group.trucks : []}
          fleetPool={fleetPool}
          onClose={() => setEditor(null)}
          onSave={saveGroup}
          onDelete={editor.mode === 'edit' ? deleteGroup : undefined}
        />
      )}
    </div>
  )
}
