import { useState } from 'react'
import { Plus, Settings2 } from 'lucide-react'
import ClassFilter from './ClassFilter'
import TrucksFilter from './TrucksFilter'
import DateFilter from './DateFilter'
import DeadheadFilter, { type DeadheadMode } from './DeadheadFilter'
import ConnectFleetModal, { type SyncState } from './ConnectFleetModal'
import ManageFleetModal from './ManageFleetModal'
import RefreshButton from './RefreshButton'
import { type FleetCabin, type PeriodKey } from '../data'

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
  onStartSync,
  sync,
  fleet = [],
  onUpdateCabinRange,
  onRemoveCabin,
  onAddCabins,
  onSyncFleet,
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
  onStartSync?: (cabinIds: string[], range: PeriodKey) => void
  sync?: SyncState | null
  fleet?: FleetCabin[]
  onUpdateCabinRange?: (id: string, range: PeriodKey) => void
  onRemoveCabin?: (id: string) => void
  onAddCabins?: (ids: string[], range: PeriodKey) => void
  onSyncFleet?: (months: number) => void
}) {
  const [showConnect, setShowConnect] = useState(false)
  const [showManage, setShowManage] = useState(false)
  const connected = fleet.length > 0

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
          connected ? (
            <button className="btn-primary" onClick={() => setShowManage(true)}>
              Manage Fleet
              <Settings2 size={15} />
            </button>
          ) : (
            <button className="btn-primary" onClick={() => setShowConnect(true)}>
              Connect Fleet
              <Plus size={15} />
            </button>
          )
        )}
      </div>

      {showConnect && (
        <ConnectFleetModal
          onClose={() => setShowConnect(false)}
          onStartSync={onStartSync}
          sync={sync}
        />
      )}
      {showManage && (
        <ManageFleetModal
          onClose={() => setShowManage(false)}
          fleet={fleet}
          onUpdateRange={(id, range) => onUpdateCabinRange?.(id, range)}
          onRemove={(id) => onRemoveCabin?.(id)}
          onAddCabins={(ids, range) => onAddCabins?.(ids, range)}
          onSync={(months) => onSyncFleet?.(months)}
        />
      )}
    </div>
  )
}
