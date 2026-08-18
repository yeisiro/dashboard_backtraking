import { useState } from 'react'
import { Plus, Settings2 } from 'lucide-react'
import ClassFilter from './ClassFilter'
import TrucksFilter from './TrucksFilter'
import DriversFilter from './DriversFilter'
import DateFilter from './DateFilter'
import DeadheadFilter, { type DeadheadMode } from './DeadheadFilter'
import ConnectFleetModal, { type SyncState } from './ConnectFleetModal'
import ManageFleetModal from './ManageFleetModal'
import RefreshButton from './RefreshButton'
import { type FleetCabin, type FleetDriver, type Integration, type PeriodKey } from '../data'

export type DataTab = 'overview' | 'full'

export default function Toolbar({
  tab = 'overview',
  onTabChange,
  classFilter = [],
  onClassFilterChange,
  truckFilter = [],
  onTruckFilterChange,
  driverFilter = [],
  onDriverFilterChange,
  view = 'dashboard',
  deadheadMode = 'in-range',
  onDeadheadModeChange,
  deadheadLocked = false,
  onStartSync,
  onConnectIntegration,
  sync,
  fleet = [],
  drivers = [],
  integrations = [],
  onSyncCabins,
  onRemoveCabin,
  onAddDrivers,
  onRemoveDriver,
  onRemoveIntegration,
}: {
  tab?: DataTab
  onTabChange?: (t: DataTab) => void
  classFilter?: string[]
  onClassFilterChange?: (next: string[]) => void
  truckFilter?: string[]
  onTruckFilterChange?: (next: string[]) => void
  driverFilter?: string[]
  onDriverFilterChange?: (next: string[]) => void
  view?: 'summary' | 'dashboard'
  deadheadMode?: DeadheadMode
  onDeadheadModeChange?: (next: DeadheadMode) => void
  deadheadLocked?: boolean
  onStartSync?: (cabinIds: string[], driverIds: string[], range: PeriodKey) => void
  onConnectIntegration?: (type: 'eld' | 'tms', name: string, mono: string) => void
  sync?: SyncState | null
  fleet?: FleetCabin[]
  drivers?: FleetDriver[]
  integrations?: Integration[]
  onSyncCabins?: (ids: string[], from: Date, to: Date) => void
  onRemoveCabin?: (id: string) => void
  onAddDrivers?: (ids: string[]) => void
  onRemoveDriver?: (id: string) => void
  onRemoveIntegration?: (type: 'eld' | 'tms', name: string) => void
}) {
  const [showConnect, setShowConnect] = useState(false)
  const [showManage, setShowManage] = useState(false)
  const connected = fleet.length > 0 || drivers.length > 0 || integrations.length > 0

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
        {view === 'dashboard' && (
          <DriversFilter selected={driverFilter} onChange={onDriverFilterChange} />
        )}
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
          onConnectIntegration={onConnectIntegration}
          sync={sync}
        />
      )}
      {showManage && (
        <ManageFleetModal
          onClose={() => setShowManage(false)}
          fleet={fleet}
          drivers={drivers}
          integrations={integrations}
          onSyncCabins={(ids, from, to) => onSyncCabins?.(ids, from, to)}
          onRemoveCabin={(id) => onRemoveCabin?.(id)}
          onAddDrivers={(ids) => onAddDrivers?.(ids)}
          onRemoveDriver={(id) => onRemoveDriver?.(id)}
          onRemoveIntegration={(type, name) => onRemoveIntegration?.(type, name)}
          onConnectIntegration={(type, name, mono) => onConnectIntegration?.(type, name, mono)}
        />
      )}
    </div>
  )
}
