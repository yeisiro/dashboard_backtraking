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
  // Analysis dimension (V2 only): the whole dashboard reads either per truck or
  // per driver — the two filters never coexist, the user switches between them.
  const [analysisDim, setAnalysisDim] = useState<'trucks' | 'drivers'>('trucks')
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

  const startOfDayLocal = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const monthsBetween = (from: Date, to: Date) =>
    Math.max(1, Math.round((to.getTime() - from.getTime()) / (30 * 86400000)))

  // Run the sync bar for an explicit [from, to] window (duration scales with
  // how many months of history the window spans).
  const runSyncRange = (from: Date, to: Date) => {
    const months = monthsBetween(from, to)
    const seconds = SYNC_SECONDS[months] ?? 30
    const inc = 100 / (seconds * 10) // 10 ticks/sec
    setSync({ progress: 0, start: from, target: to, done: false, inc })
  }

  // Sync (or re-sync) the given cabins for a date window: upsert their synced
  // coverage and kick off the background sync. Used by the connect wizard, the
  // manage "Add cabins" flow, and the on-demand per-cabin sync.
  const syncCabins = (cabinIds: string[], from: Date, to: Date) => {
    if (cabinIds.length === 0) return
    setFleet((prev) => {
      const map = new Map(prev.map((c) => [c.id, c]))
      cabinIds.forEach((id) => map.set(id, { id, syncedFrom: from, syncedTo: to }))
      return [...map.values()]
    })
    runSyncRange(from, to)
  }
  const removeCabin = (id: string) => setFleet((prev) => prev.filter((c) => c.id !== id))

  // Drivers carry no sync window — linking just adds them to the DB. `extra`
  // carries manually added drivers (typed in the Connect wizard) whose names
  // aren't in the discovered pool.
  const addDrivers = (driverIds: string[], extra: FleetDriver[] = []) => {
    if (driverIds.length === 0 && extra.length === 0) return
    setDrivers((prev) => {
      const map = new Map(prev.map((d) => [d.id, d]))
      driverIds.forEach((id) => {
        const name = DRIVER_POOL.find((p) => p.id === id)?.name ?? id
        map.set(id, { id, name })
      })
      extra.forEach((d) => map.set(d.id, d))
      return [...map.values()]
    })
  }

  // Track a connected integration (dedupe by type+name).
  const connectIntegration = (type: 'eld' | 'tms', name: string, mono: string) =>
    setIntegrations((prev) =>
      prev.some((i) => i.type === type && i.name === name) ? prev : [...prev, { type, name, mono }],
    )
  const removeIntegration = (type: 'eld' | 'tms', name: string) =>
    setIntegrations((prev) => prev.filter((i) => !(i.type === type && i.name === name)))

  // Connect wizard: link the chosen cabins (over the picked window) + drivers,
  // and start syncing the cabins.
  const linkFleet = (cabinIds: string[], driverIds: string[], range: PeriodKey, extraDrivers: FleetDriver[] = []) => {
    addDrivers(driverIds, extraDrivers)
    if (cabinIds.length > 0) {
      const to = startOfDayLocal(new Date())
      const from = new Date(to.getFullYear(), to.getMonth() - monthsForPeriod(range), to.getDate())
      syncCabins(cabinIds, from, to)
    }
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
              dimension={analysisDim}
              onDimensionChange={setAnalysisDim}
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
              onSyncCabins={syncCabins}
              onRemoveCabin={removeCabin}
              onAddDrivers={addDrivers}
              onRemoveIntegration={removeIntegration}
            />
            {dataTab === 'full' ? (
              <FullData
                band={tripsBand}
                classFilter={classFilter}
                truckFilter={truckFilter}
                onTruckFilterChange={setTruckFilter}
                driverFilter={driverFilter}
                dimension={analysisDim}
                view={view}
                onSubTabChange={setFullDataSubTab}
              />
            ) : (
              <>
                <KpiCards noData={noData} hideMarketPosition={view === 'summary'} />
                <div className={`grid-2 ${view === 'summary' ? 'grid-2-even' : ''}`}>
                  <MoneyLeakage
                    noData={noData}
                    view={view}
                    dimension={analysisDim}
                    hidePoorPlanning={view === 'summary'}
                  />
                  <PotentialRecovery
                    fleetMode={fleetMode}
                    view={view}
                    dimension={analysisDim}
                    hideLeaders={view === 'summary'}
                    onViewTrips={(band, members) => {
                      setTripsBand(band)
                      // Filter Full Data to the picked trucks/drivers — by the
                      // active analysis dimension so the right filter applies.
                      if (members && members.length) {
                        if (analysisDim === 'drivers') setDriverFilter(members)
                        else setTruckFilter(members)
                      }
                      setDataTab('full')
                    }}
                  />
                </div>
                {view === 'summary' && <MarketMap />}
                {view === 'dashboard' && (
                  <div className="grid-live">
                    <LiveOperations noData={noData} />
                    <MarketMap fill dimension={analysisDim} />
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
