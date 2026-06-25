import { ChevronDown, Plus } from 'lucide-react'

const filters = [
  { label: 'Class:', value: 'All' },
  { label: 'Trucks:', value: 'All' },
  { label: 'Date:', value: 'May 11-17, 2026' },
]

export default function Toolbar() {
  return (
    <div className="toolbar">
      <div className="tabs">
        <button className="tab active">Overview</button>
        <button className="tab">Full Data</button>
      </div>
      <div className="filters">
        {filters.map((f) => (
          <button className="filter" key={f.label}>
            <span>{f.label}</span>
            <b>{f.value}</b>
            <ChevronDown className="chev" size={15} />
          </button>
        ))}
        <button className="btn-primary">
          Connect Fleet
          <Plus size={15} />
        </button>
      </div>
    </div>
  )
}
