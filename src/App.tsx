import { useEffect, useState } from 'react'
import Sidebar, { type View } from './components/Sidebar'
import Header from './components/Header'
import Toolbar, { type DataTab } from './components/Toolbar'
import { type DeadheadMode } from './components/DeadheadFilter'
import KpiCards from './components/KpiCards'
import MoneyLeakage from './components/MoneyLeakage'
import PotentialRecovery, { type FleetMode } from './components/PotentialRecovery'
import LiveOperations from './components/LiveOperations'
import MarketMap from './components/MarketMap'
import FullData, { type SubTab } from './components/FullData'
import SyncBar from './components/SyncBar'
import Toast from './components/Toast'
import { type SyncState } from './components/ConnectFleetModal'
import {
  type FleetCabin,
  type FleetDriver,
  type Integration,
  type PeriodKey,
  monthsForPeriod,
  DRIVER_POOL,
} from './data'
import { PeriodContext, initialCompareRange } from './PeriodContext'

export default function App() {
  const [compareLabel, setCompareLabel] = useState('vs prev 7d')
  const [compareRange, setCompareRange] = useState(initialCompareRange())
  const [rangeDays, setRangeDays] = useState(7)
  const [fleetMode, setFleetMode] = useState<FleetMode>('full')
  const [view, setView] = useState<View>('summary')
  // A "Trips Here" new-tab link (see FuelSavings.tsx's openPlaceTrips) lands
  // here with ?tab=full&class=... — a fresh tab has no in-memory state to
  // inherit, so the query string is what carries the tab/class filter over.
  const [dataTab, setDataTab] = useState<DataTab>(() =>
    new URLSearchParams(window.location.search).get('tab') === 'full' ? 'full' : 'overview',
  )
  const [tripsBand, setTripsBand] = useState<'best' | 'worst' | null>(null)
  const [classFilter, setClassFilter] = useState<string[]>(() => {
    const cls = new URLSearchParams(window.location.search).get('class')
    return cls ? cls.split(',').filter(Boolean) : []
  })
  const [truckFilter, setTruckFilter] = useState<string[]>([])
  const [driverFilter, setDriverFilter] = useState<string[]>([])
  const [deadheadMode, setDeadheadMode] = useState<DeadheadMode>('in-range')
  const [fullDataSubTab, setFullDataSubTab] = useState<SubTab>('Trips')
  // Trips and Fleet Analytics always need each trip's untouched full
  // deadhead to add up right, so the Deadhead filter locks to "Full trip"
  // while either subtab is active.
  const deadheadLocked =
    dataTab === 'full' && (fullDataSubTab === 'Trips' || fullDataSubTab === 'Fleet Analytics')
  useEffect(() => {
    if (deadheadLocked) setDeadheadMode('full-trip')
  }, [deadheadLocked])
  const noData = fleetMode === 'empty'
  const [rangeEnd, setRangeEnd] = useState(() => {
    const t = new Date()
    return new Date(t.getFullYear(), t.getMonth(), t.getDate())
  })
  const setPeriod = (label: string, days: number, range: string, end?: Date) => {
    setCompareLabel(label)
    setRangeDays(days)
    setCompareRange(range)
    if (end) setRangeEnd(end)
  }

  // ── Fleet + background sync ────────────────────────────────────────────
  // The linked cabins, drivers and connected integrations (with each cabin/
  // driver's sync window) live here so the flip from "Connect Fleet" → "Manage
  // Fleet" and the manage view survive across V1/V2.
  const [fleet, setFleet] = useState<FleetCabin[]>([])
  const [drivers, setDrivers] = useState<FleetDriver[]>([])
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [sync, setSync] = useState<SyncState | null>(null)
  const [syncToast, setSyncToast] = useState(false)

  // The sync fills over a window that scales with how much history was asked
  // for — a full year of data takes much longer than a single month.
  const SYNC_SECONDS: Record<number, number> = { 1: 5, 3: 10, 6: 30, 12: 90 }

  const runSync = (months: number) => {
    const t = new Date()
    const target = new Date(t.getFullYear(), t.getMonth(), t.getDate())
    const start = new Date(target.getFullYear(), target.getMonth() - months, target.getDate())
    const seconds = SYNC_SECONDS[months] ?? 10
    // 10 ticks/sec (100ms), so inc per tick = 100% / (seconds × 10).
    const inc = 100 / (seconds * 10)
    setSync({ progress: 0, start, target, done: false, inc })
  }

  // Add cabins to the fleet at a given window (dedupe by id, newest wins).
  const addCabins = (cabinIds: string[], range: PeriodKey) => {
    if (cabinIds.length === 0) return
    setFleet((prev) => {
      const map = new Map(prev.map((c) => [c.id, c]))
      cabinIds.forEach((id) => map.set(id, { id, range }))
      return [...map.values()]
    })
  }
  const updateCabinRange = (id: string, range: PeriodKey) =>
    setFleet((prev) => prev.map((c) => (c.id === id ? { ...c, range } : c)))
  const removeCabin = (id: string) => setFleet((prev) => prev.filter((c) => c.id !== id))

  // Add drivers to the fleet at a given window (dedupe by id, newest wins).
  const addDrivers = (driverIds: string[], range: PeriodKey) => {
    if (driverIds.length === 0) return
    setDrivers((prev) => {
      const map = new Map(prev.map((d) => [d.id, d]))
      driverIds.forEach((id) => {
        const name = DRIVER_POOL.find((p) => p.id === id)?.name ?? id
        map.set(id, { id, name, range })
      })
      return [...map.values()]
    })
  }
  const updateDriverRange = (id: string, range: PeriodKey) =>
    setDrivers((prev) => prev.map((d) => (d.id === id ? { ...d, range } : d)))
  const removeDriver = (id: string) => setDrivers((prev) => prev.filter((d) => d.id !== id))

  // Track a connected integration (dedupe by type+name).
  const connectIntegration = (type: 'eld' | 'tms', name: string, mono: string) =>
    setIntegrations((prev) =>
      prev.some((i) => i.type === type && i.name === name) ? prev : [...prev, { type, name, mono }],
    )
  const removeIntegration = (type: 'eld' | 'tms', name: string) =>
    setIntegrations((prev) => prev.filter((i) => !(i.type === type && i.name === name)))

  // Connect wizard: link the chosen cabins + drivers and start syncing them.
  const linkFleet = (cabinIds: string[], driverIds: string[], range: PeriodKey) => {
    addCabins(cabinIds, range)
    addDrivers(driverIds, range)
    if (cabinIds.length > 0 || driverIds.length > 0) runSync(monthsForPeriod(range))
  }

  // Tick progress to 100 at the pace set by `inc`. Deps are (active, done) —
  // both stable across the per-tick progress updates, so the interval isn't
  // torn down each tick.
  useEffect(() => {
    if (!sync || sync.done) return
    const id = setInterval(() => {
      setSync((s) => {
        if (!s || s.done) return s
        const next = Math.min(100, s.progress + s.inc)
        return { ...s, progress: next, done: next >= 100 }
      })
    }, 100)
    return () => clearInterval(id)
  }, [sync === null, sync?.done])

  // On completion: fire the toast, then retire the bar after a short beat.
  useEffect(() => {
    if (!sync?.done) return
    setSyncToast(true)
    const t = setTimeout(() => setSync(null), 4000)
    return () => clearTimeout(t)
  }, [sync?.done])

  return (
    <PeriodContext.Provider value={{ compareLabel, compareRange, rangeDays, rangeEnd, setPeriod }}>
      <div className="app">
        <Sidebar view={view} onViewChange={setView} />
        <div className="main">
          <Header />
          <main className="content">
            {sync && <SyncBar sync={sync} />}
            <Toolbar
              tab={dataTab}
              onTabChange={setDataTab}
              classFilter={classFilter}
              onClassFilterChange={setClassFilter}
              truckFilter={truckFilter}
              onTruckFilterChange={setTruckFilter}
              driverFilter={driverFilter}
              onDriverFilterChange={setDriverFilter}
              view={view}
              deadheadMode={deadheadMode}
              onDeadheadModeChange={setDeadheadMode}
              deadheadLocked={deadheadLocked}
              onStartSync={linkFleet}
              onConnectIntegration={connectIntegration}
              sync={sync}
              fleet={fleet}
              drivers={drivers}
              integrations={integrations}
              onUpdateCabinRange={updateCabinRange}
              onRemoveCabin={removeCabin}
              onAddCabins={addCabins}
              onUpdateDriverRange={updateDriverRange}
              onRemoveDriver={removeDriver}
              onAddDrivers={addDrivers}
              onRemoveIntegration={removeIntegration}
              onSyncFleet={runSync}
            />
            {dataTab === 'full' ? (
              <FullData
                band={tripsBand}
                classFilter={classFilter}
                truckFilter={truckFilter}
                onTruckFilterChange={setTruckFilter}
                driverFilter={driverFilter}
                view={view}
                onSubTabChange={setFullDataSubTab}
              />
            ) : (
              <>
                <KpiCards noData={noData} hideMarketPosition={view === 'summary'} />
                <div className={`grid-2 ${view === 'summary' ? 'grid-2-even' : ''}`}>
                  <MoneyLeakage noData={noData} hidePoorPlanning={view === 'summary'} />
                  <PotentialRecovery
                    fleetMode={fleetMode}
                    hideLeaders={view === 'summary'}
                    onViewTrips={(band) => {
                      setTripsBand(band)
                      setDataTab('full')
                    }}
                  />
                </div>
                {view === 'summary' && <MarketMap />}
                {view === 'dashboard' && (
                  <div className="grid-live">
                    <LiveOperations noData={noData} />
                    <MarketMap fill />
                  </div>
                )}
              </>
            )}

            <div className="fleet-sim">
              <span className="fleet-sim-label">Preview dashboard with</span>
              {(
                [
                  { v: 'full', label: 'Full fleet' },
                  { v: 'small', label: 'Small fleet (3)' },
                  { v: 'single', label: 'Single truck' },
                  { v: 'empty', label: 'No truck data' },
                ] as { v: FleetMode; label: string }[]
              ).map((o) => (
                <button
                  key={o.v}
                  className={`fleet-sim-btn ${fleetMode === o.v ? 'active' : ''}`}
                  onClick={() => setFleetMode(o.v)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </main>
        </div>
        {syncToast && (
          <Toast
            message="Fleet connected — your operation is ready in the dashboard."
            onDone={() => setSyncToast(false)}
          />
        )}
      </div>
    </PeriodContext.Provider>
  )
}
