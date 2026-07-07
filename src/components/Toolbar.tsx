import { useState } from 'react'
import { Plus } from 'lucide-react'
import ClassFilter from './ClassFilter'
import TrucksFilter from './TrucksFilter'
import DateFilter from './DateFilter'
import ConnectFleetModal from './ConnectFleetModal'

export type DataTab = 'overview' | 'full'

export default function Toolbar({
  tab = 'overview',
  onTabChange,
  classFilter = [],
  onClassFilterChange,
}: {
  tab?: DataTab
  onTabChange?: (t: DataTab) => void
  classFilter?: string[]
  onClassFilterChange?: (next: string[]) => void
}) {
  const [showConnect, setShowConnect] = useState(false)

  return (
    <div className="toolbar">
      <div className="tabs">
        <button
          className={`tab ${tab === 'overview' ? 'active' : ''}`}
          onClick={() => onTabChange?.('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${tab === 'full' ? 'active' : ''}`}
          onClick={() => onTabChange?.('full')}
        >
          Full Data
        </button>
      </div>
      <div className="filters">
        <ClassFilter selected={classFilter} onChange={onClassFilterChange} />
        <TrucksFilter />
        <DateFilter />
        <button className="btn-primary" onClick={() => setShowConnect(true)}>
          Connect Fleet
          <Plus size={15} />
        </button>
      </div>

      {showConnect && <ConnectFleetModal onClose={() => setShowConnect(false)} />}
    </div>
  )
}
