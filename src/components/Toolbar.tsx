import { useEffect, useState } from 'react'
import { Plus, Settings2, Truck, User } from 'lucide-react'
import ClassFilter from './ClassFilter'
import TrucksFilter from './TrucksFilter'
import DriversFilter from './DriversFilter'
import DateFilter from './DateFilter'
import DeadheadFilter, { type DeadheadMode } from './DeadheadFilter'
import ConnectFleetModal, { type SyncState } from './ConnectFleetModal'
import ConnectFleetV2, { type WizardTarget } from './ConnectFleetV2'
import ManageFleetModal from './ManageFleetModal'
import RefreshButton from './RefreshButton'
import {
  type FleetCabin,
  type FleetDriver,
  type Integration,
  type PeriodKey,
  type OnboardingState,
  type OnboardingRequest,
  type RequestType,
  EMPTY_ONBOARDING,
} from '../data'

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
  onboarding,
  onOnboardingChange,
  requests = [],
  onRequest,
  onStartOnboardingSync,
  v3 = false,
  wizardTarget = null,
  onWizardTargetHandled,
  onWizardClosed,
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
  onConnectIntegration?: (type: 'eld' | 'tms', name: string, mono: string, label?: string) => void
  sync?: SyncState | null
  fleet?: FleetCabin[]
  drivers?: FleetDriver[]
  integrations?: Integration[]
  onSyncCabins?: (ids: string[], from: Date, to: Date) => void
  onRemoveCabin?: (id: string) => void
  onAddDrivers?: (ids: string[]) => void
  onRemoveIntegration?: (type: 'eld' | 'tms', name: string) => void
  // V2 onboarding (progress + requests live in App so they survive closing).
  onboarding?: OnboardingState
  onOnboardingChange?: (patch: Partial<OnboardingState>) => void
  requests?: OnboardingRequest[]
  onRequest?: (type: RequestType, detail: string) => void
  onStartOnboardingSync?: () => void
  // V3: integration consent + the setup guide opening the wizard at a step.
  v3?: boolean
  wizardTarget?: WizardTarget | null
  onWizardTargetHandled?: () => void
  onWizardClosed?: () => void
}) {
  const [showConnect, setShowConnect] = useState(false)
  // Step the wizard opens at (set by the V3 setup guide; else first pending).
  const [openAt, setOpenAt] = useState<WizardTarget | undefined>(undefined)
  useEffect(() => {
    if (!wizardTarget) return
    setOpenAt(wizardTarget)
    setShowConnect(true)
    onWizardTargetHandled?.()
  }, [wizardTarget, onWizardTargetHandled])
  const [showManage, setShowManage] = useState(false)
  const isV2 = view === 'dashboard'
  // V1 flips to Manage Fleet as soon as anything is connected. V2 keeps
  // Connect Fleet until the sync starts, so a half-finished onboarding always
  // reopens the wizard where it was left.
  const connected = isV2
    ? !!onboarding?.syncStarted
    : fleet.length > 0 || drivers.length > 0 || integrations.length > 0
  // V2 shows the button in every view (it's the only entry point); V1 keeps
  // its original visibility.
  const showFleetButton = isV2 || (!(view === 'summary' && tab === 'overview') && tab !== 'full')

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
        {showFleetButton && (
          connected ? (
            <button className="btn-primary" onClick={() => setShowManage(true)}>
              Manage Fleet
              <Settings2 size={15} />
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={() => {
                setOpenAt(undefined)
                setShowConnect(true)
              }}
            >
              Connect Fleet
              <Plus size={15} />
            </button>
          )
        )}
      </div>

      {showConnect && isV2 && onboarding && (
        <ConnectFleetV2
          // Defaults fill any field an older in-memory state (hot reload) lacks.
          ob={{ ...EMPTY_ONBOARDING, ...onboarding }}
          onChange={(patch) => onOnboardingChange?.(patch)}
          requests={requests}
          onRequest={(type, detail) => onRequest?.(type, detail)}
          onConnectIntegration={onConnectIntegration}
          onStartSync={() => onStartOnboardingSync?.()}
          sync={sync}
          onClose={() => {
            setShowConnect(false)
            onWizardClosed?.()
          }}
          v3={v3}
          initialStep={openAt}
        />
      )}
      {showConnect && !isV2 && (
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
          onConnectIntegration={(type, name, mono, label) => onConnectIntegration?.(type, name, mono, label)}
          v2={isV2}
          trailers={onboarding?.trailers ?? []}
          onTrailersChange={(ids) => onOnboardingChange?.({ trailers: ids })}
          requests={requests}
          onRequest={(type, detail) => onRequest?.(type, detail)}
          v3={v3}
        />
      )}
    </div>
  )
}
