import { useState } from 'react'
import { ChevronDown, Check, Search, Pencil, Plus, X } from 'lucide-react'
import AddCabModal from './AddCabModal'

type Tab = 'individual' | 'dispatcher'

const initialTrucks = ['48201', '48202', '48203', '48204', '48205', '48206', '48207']

// Shared fleet pool that dispatchers draw their trucks from.
const fleetPool = Array.from({ length: 14 }, (_, i) => `482${String(i + 1).padStart(2, '0')}`)

const dispatcherNames = ['Pablo alboran', 'Pedro anuel', 'Jose abelardo', 'Ivan cepeda']

const initialGroups: Record<string, string[]> = {
  'Pablo alboran': fleetPool.slice(0, 8),
  'Pedro anuel': fleetPool.slice(2, 9),
  'Jose abelardo': fleetPool.slice(1, 7),
  'Ivan cepeda': fleetPool.slice(3, 12),
}

const CHIP_ROW = 4 // trucks shown before collapsing into "+N"

export default function TrucksFilter() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('individual')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([]) // empty = All
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [groups, setGroups] = useState(initialGroups)
  const [editing, setEditing] = useState<string | null>(null)
  const [editSearch, setEditSearch] = useState('')
  const [trucks, setTrucks] = useState(initialTrucks)
  const [showAddCab, setShowAddCab] = useState(false)

  const isAll = selected.length === 0 && selectedGroups.length === 0
  const label = isAll ? 'All' : `${selected.length + selectedGroups.length} selected`

  const toggleTruck = (id: string) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const toggleGroup = (name: string) =>
    setSelectedGroups((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]))
  const reset = () => {
    setSelected([])
    setSelectedGroups([])
  }
  const toggleTruckInGroup = (name: string, id: string) =>
    setGroups((g) => {
      const list = g[name]
      return {
        ...g,
        [name]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
      }
    })

  const openEditor = (name: string) => {
    setEditing(name)
    setEditSearch('')
  }

  const visibleTrucks = trucks.filter((t) =>
    t.toLowerCase().includes(search.toLowerCase()),
  )
  const editPool = fleetPool.filter((t) =>
    t.toLowerCase().includes(editSearch.toLowerCase()),
  )

  return (
    <div className="cf">
      <button className="filter" onClick={() => setOpen((o) => !o)}>
        <span>Trucks:</span>
        <b>{label}</b>
        <ChevronDown className="chev" size={15} />
      </button>

      {open && (
        <>
          <div
            className="cf-backdrop"
            onClick={() => {
              if (editing) setEditing(null)
              else setOpen(false)
            }}
          />
          <div className="cf-menu tf-menu">
            <div className="tf-tabs">
              <button
                className={`tf-tab ${tab === 'individual' ? 'active' : ''}`}
                onClick={() => setTab('individual')}
              >
                Individual
              </button>
              <button
                className={`tf-tab ${tab === 'dispatcher' ? 'active' : ''}`}
                onClick={() => setTab('dispatcher')}
              >
                By dispatcher
              </button>
            </div>

            {tab === 'individual' && (
              <>
                <div className="tf-search">
                  <Search size={15} color="var(--text-muted)" />
                  <input
                    placeholder="Search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="tf-scroll">
                  <button className={`cf-item ${isAll ? 'active' : ''}`} onClick={reset}>
                    All trucks
                    {isAll && <Check size={17} className="cf-check" />}
                  </button>
                  {visibleTrucks.map((id) => {
                    const active = selected.includes(id)
                    return (
                      <button
                        key={id}
                        className={`cf-item ${active ? 'active' : ''}`}
                        onClick={() => toggleTruck(id)}
                      >
                        {id}
                        {active && <Check size={17} className="cf-check" />}
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

            {tab === 'dispatcher' && (
              <>
                <div className="tf-scroll">
                  <button className={`cf-item ${isAll ? 'active' : ''}`} onClick={reset}>
                    All trucks
                    {isAll && <Check size={17} className="cf-check" />}
                  </button>

                  {dispatcherNames.map((name) => {
                    const trucks = groups[name]
                    const active = selectedGroups.includes(name)
                    const shown = trucks.slice(0, CHIP_ROW)
                    const overflow = trucks.length - shown.length
                    return (
                      <div className={`tf-group ${active ? 'active' : ''}`} key={name}>
                        <div className="tf-group-head">
                          <button className="tf-group-name" onClick={() => toggleGroup(name)}>
                            {active && <Check size={15} className="cf-check" />}
                            {name}
                          </button>
                          <button
                            className="tf-edit"
                            aria-label={`Edit ${name}`}
                            onClick={() => openEditor(name)}
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
                              onClick={() => openEditor(name)}
                            >
                              +{overflow}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {editing && (
              <div className="tf-edit-panel">
                <div className="tf-edit-head">
                  <div className="tf-edit-title">
                    <Pencil size={15} />
                    <span>Edit {editing.toLowerCase()} equip</span>
                  </div>
                  <button
                    className="tf-edit-close"
                    onClick={() => setEditing(null)}
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>
                <p className="tf-edit-sub">Add or remove trucks from this equip</p>

                <div className="tf-search">
                  <Search size={15} color="var(--text-muted)" />
                  <input
                    placeholder="Search"
                    value={editSearch}
                    onChange={(e) => setEditSearch(e.target.value)}
                  />
                </div>

                <div className="tf-scroll tf-edit-list">
                  {editPool.map((id) => {
                    const active = groups[editing].includes(id)
                    return (
                      <button
                        key={id}
                        className={`cf-item ${active ? 'active' : ''}`}
                        onClick={() => toggleTruckInGroup(editing, id)}
                      >
                        {id}
                        {active && <Check size={17} className="cf-check" />}
                      </button>
                    )
                  })}
                </div>
              </div>
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
    </div>
  )
}
