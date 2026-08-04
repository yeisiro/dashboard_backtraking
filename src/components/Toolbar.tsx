import { useState } from 'react'
import { Plus } from 'lucide-react'
import ClassFilter from './ClassFilter'
import TrucksFilter from './TrucksFilter'
import DateFilter from './DateFilter'
import DeadheadFilter, { type DeadheadMode } from './DeadheadFilter'
import ConnectFleetModal from './ConnectFleetModal'
import RefreshButton from './RefreshButton'
import Toast from './Toast'

export type DataTab = 'overview' | 'full'

export default function Toolbar({
  tab = 'overview',
  onTabChange,
  classFilter = [],
  onClassFilterChange,
  truckFilter = [],
  onTruckFilterChange,
  view = 'dashboard',
  deadheadMode = 'in-range',
  onDeadheadModeChange,
  deadheadLocked = false,
}: {
  tab?: DataTab
  onTabChange?: (t: DataTab) => void
  classFilter?: string[]
  onClassFilterChange?: (next: string[]) => void
  truckFilter?: string[]
  onTruckFilterChange?: (next: string[]) => void
  view?: 'summary' | 'dashboard'
  deadheadMode?: DeadheadMode
  onDeadheadModeChange?: (next: DeadheadMode) => void
  deadheadLocked?: boolean
}) {
  const [showConnect, setShowConnect] = useState(false)
  const [connectedToast, setConnectedToast] = useState(false)

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
        <DeadheadFilter mode={deadheadMode} onChange={onDeadheadModeChange} locked={deadheadLocked} />
        <ClassFilter selected={classFilter} onChange={onClassFilterChange} />
        <TrucksFilter selected={truckFilter} onChange={onTruckFilterChange} />
        <DateFilter />
        <RefreshButton label="Refresh data" />
        {!(view === 'summary' && tab === 'overview') && tab !== 'full' && (
          <button className="btn-primary" onClick={() => setShowConnect(true)}>
            Connect Fleet
            <Plus size={15} />
          </button>
        )}
      </div>

      {showConnect && (
        <ConnectFleetModal
          onClose={() => setShowConnect(false)}
          onComplete={() => {
            setShowConnect(false)
            setConnectedToast(true)
          }}
        />
      )}
      {connectedToast && (
        <Toast
          message="Fleet connected — your operation is ready in the dashboard."
          onDone={() => setConnectedToast(false)}
        />
      )}
    </div>
  )
}
