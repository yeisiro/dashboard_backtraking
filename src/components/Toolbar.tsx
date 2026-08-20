import { useState } from 'react'
import { Plus, Settings2, Truck, User } from 'lucide-react'
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
export type AnalysisDim = 'trucks' | 'drivers'

// The dimension the whole dashboard is analyzed at. Trucks and drivers never
// filter at the same time — this segmented control picks which one is live,
// and the filter pill to its right switches to match.
function DimensionToggle({
  value,
  onChange,
}: {
  value: AnalysisDim
  onChange?: (d: AnalysisDim) => void
}) {
  return (
    <div className="dim-toggle" role="group" aria-label="Analyze by">
      <button
        className={`dim-toggle-btn ${value === 'trucks' ? 'active' : ''}`}
        onClick={() => onChange?.('trucks')}
        aria-pressed={value === 'trucks'}
      >
        <Truck size={14} /> Trucks
      </button>
      <button
        className={`dim-toggle-btn ${value === 'drivers' ? 'active' : ''}`}
        onClick={() => onChange?.('drivers')}
        aria-pressed={value === 'drivers'}
      >
        <User size={14} /> Drivers
      </button>
    </div>
  )
}

export default function Toolbar({
  tab = 'overview',
  onTabChange,
  classFilter = [],
  onClassFilterChange,
  truckFilter = [],
  onTruckFilterChange,
  driverFilter = [],
  onDriverFilterChange,
  dimension = 'trucks',
  onDimensionChange,
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
  dimension?: AnalysisDim
  onDimensionChange?: (d: AnalysisDim) => void
  view?: 'summary' | 'dashboard'
  deadheadMode?: DeadheadMode
  onDeadheadModeChange?: (next: DeadheadMode) => void
  deadheadLocked?: boolean
  onStartSync?: (cabinIds: string[], driverIds: string[], range: PeriodKey, extraDrivers?: FleetDriver[]) => void
  onConnectIntegration?: (type: 'eld' | 'tms', name: string, mono: string) => void
  sync?: SyncState | null
  fleet?: FleetCabin[]
  drivers?: FleetDriver[]
  integrations?: Integration[]
  onSyncCabins?: (ids: string[], from: Date, to: Date) => void
  onRemoveCabin?: (id: string) => void
  onAddDrivers?: (ids: string[]) => void
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
        {view === 'dashboard' ? (
          <>
            <DimensionToggle value={dimension} onChange={onDimensionChange} />
            {dimension === 'trucks' ? (
              <TrucksFilter selected={truckFilter} onChange={onTruckFilterChange} />
            ) : (
              <DriversFilter selected={driverFilter} onChange={onDriverFilterChange} />
            )}
          </>
        ) : (
          <TrucksFilter selected={truckFilter} onChange={onTruckFilterChange} />
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
          sync={sync}
          fleet={fleet}
          drivers={drivers}
          integrations={integrations}
          onSyncCabins={(ids, from, to) => onSyncCabins?.(ids, from, to)}
          onRemoveCabin={(id) => onRemoveCabin?.(id)}
          onAddDrivers={(ids) => onAddDrivers?.(ids)}
          onRemoveIntegration={(type, name) => onRemoveIntegration?.(type, name)}
          onConnectIntegration={(type, name, mono) => onConnectIntegration?.(type, name, mono)}
        />
      )}
    </div>
  )
}
