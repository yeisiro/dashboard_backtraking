import { useState } from 'react'
import { ChevronDown, Search, CheckCircle2, User } from 'lucide-react'
import { DRIVER_POOL } from '../data'

const DRIVER_NAMES = DRIVER_POOL.map((d) => d.name)

// Multi-select driver filter (V2 only). Empty selection = "All".
export default function DriversFilter({
  selected = [],
  onChange,
}: {
  selected?: string[]
  onChange?: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const isAll = selected.length === 0
  const label = isAll ? 'All' : `${selected.length} selected`

  const toggle = (name: string) =>
    onChange?.(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name])
  const reset = () => onChange?.([])

  const shown = DRIVER_NAMES.filter((n) => n.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="cf">
      <button className="filter" onClick={() => setOpen((o) => !o)}>
        <User className="chev" size={15} />
        <span>Drivers:</span>
        <b>{label}</b>
        <ChevronDown className="chev" size={15} />
      </button>

      {open && (
        <>
          <div className="cf-backdrop" onClick={() => setOpen(false)} />
          <div className="cf-menu tf-menu">
            <div className="tf-search">
              <Search size={15} color="var(--text-muted)" />
              <input
                placeholder="Search driver..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="tf-select-row">
              <button className="tf-clear-all" onClick={reset}>
                Clear all
              </button>
              <span className="tf-select-count">
                {isAll ? `All ${DRIVER_NAMES.length} selected` : `${selected.length} selected`}
              </span>
            </div>
            <div className="tf-scroll">
              <button className={`tf-truck-item tf-all-item ${isAll ? 'active' : ''}`} onClick={reset}>
                All drivers
                {isAll && <CheckCircle2 size={17} className="cf-check" />}
              </button>
              {shown.map((name) => {
                const active = selected.includes(name)
                return (
                  <button
                    key={name}
                    className={`tf-truck-item ${active ? 'active' : ''}`}
                    onClick={() => toggle(name)}
                  >
                    {name}
                    {active && <CheckCircle2 size={17} className="cf-check" />}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
