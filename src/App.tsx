import { useCallback, useEffect, useState } from 'react'
import Sidebar, { type View, type Version, type V3Page } from './components/Sidebar'
import SignupV3, { type SignupAccount } from './components/SignupV3'
import SetupGuide, { onboardingGaps, setupItems } from './components/SetupGuide'
import ConnectFleetV2, { type WizardTarget } from './components/ConnectFleetV2'
import MyCompanyV3, { type CompanyManageTab } from './components/MyCompanyV3'
import ManageFleetModal from './components/ManageFleetModal'
import Header from './components/Header'
import Toolbar, { type DataTab } from './components/Toolbar'
import { type DeadheadMode } from './components/DeadheadFilter'
import KpiCards from './components/KpiCards'
import MoneyLeakage from './components/MoneyLeakage'
import PotentialRecovery, { type FleetMode } from './components/PotentialRecovery'
import LiveOperations from './components/LiveOperations'
import MarketMap, { type MapFocus } from './components/MarketMap'
import FullData, { type SubTab } from './components/FullData'
import SyncBar from './components/SyncBar'
import Toast from './components/Toast'
import { type SyncState } from './components/ConnectFleetModal'
import {
  type FleetCabin,
  type FleetDriver,
  type Integration,
  type PeriodKey,
  type OnboardingState,
  type OnboardingRequest,
  type RequestType,
  monthsForPeriod,
  DRIVER_POOL,
  EMPTY_ONBOARDING,
  ONBOARDING_LOSS,
} from './data'
import { PeriodContext, initialCompareRange } from './PeriodContext'

export default function App() {
  const [compareLabel, setCompareLabel] = useState('vs prev 7d')
  const [compareRange, setCompareRange] = useState(initialCompareRange())
  const [rangeDays, setRangeDays] = useState(7)
  const [fleetMode, setFleetMode] = useState<FleetMode>('full')
  // V1 = summary, V2 = full dashboard, V3 = full onboarding (sign-up first,
  // then the V2 dashboard). `view` is what the dashboard components read.
  const [version, setVersion] = useState<Version>('v1')
  const view: View = version === 'v1' ? 'summary' : 'dashboard'
  // V3: the account created in the sign-up flow (null = still signing up).
  const [v3Account, setV3Account] = useState<SignupAccount | null>(null)
  // V3 setup guide: expanded right after sign-up; can be minimized, and only
  // closed once the minimum is done.
  const [guideOpen, setGuideOpen] = useState(true)
  const [guideDismissed, setGuideDismissed] = useState(false)
  // Step the guide asked the wizard to open at (consumed by Toolbar).
  const [wizardTarget, setWizardTarget] = useState<WizardTarget | null>(null)
  const clearWizardTarget = useCallback(() => setWizardTarget(null), [])
  // V3 page (Dashboard / My Company). My Company hosts its own wizard and
  // Manage Fleet so they open over it instead of jumping to the dashboard.
  const [v3Page, setV3Page] = useState<V3Page>('dashboard')
  const [companyWizard, setCompanyWizard] = useState<{ at?: WizardTarget } | null>(null)
  const [companyManage, setCompanyManage] = useState<CompanyManageTab | null>(null)
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
  // A truck clicked in Live Operation Monitoring, isolated on the Fleet map.
  const [mapFocus, setMapFocus] = useState<MapFocus | null>(null)
  // A load id clicked in Live Operation Monitoring — seeds the Trips search so
  // Full Data opens pre-filtered to that single load.
  const [tripSearchSeed, setTripSearchSeed] = useState<string | null>(null)
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

  // Track a connected integration (dedupe by type+name). `label` is the
  // operator's reference name; defaults to the provider name when blank.
  const connectIntegration = (type: 'eld' | 'tms', name: string, mono: string, label?: string) =>
    setIntegrations((prev) =>
      prev.some((i) => i.type === type && i.name === name)
        ? prev
        : [...prev, { type, name, mono, label: label?.trim() || name }],
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

  // ── V2 onboarding ───────────────────────────────────────────────────────
  // Wizard progress + the requests it opens live here so closing the modal
  // never loses them and reopening resumes at the first pending step.
  const [onboarding, setOnboarding] = useState<OnboardingState>(EMPTY_ONBOARDING)
  const [requests, setRequests] = useState<OnboardingRequest[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  // Stable so the toast's auto-dismiss timer isn't reset by the sync ticks.
  const clearNotice = useCallback(() => setNotice(null), [])
  const patchOnboarding = (patch: Partial<OnboardingState>) => setOnboarding((o) => ({ ...o, ...patch }))

  const REQUEST_NOTICE: Record<RequestType, string> = {
    eld: "Request sent — we'll set up your ELD and let you know when it's ready.",
    tms: "Request sent — we'll set up your TMS and let you know when it's ready.",
    'fuel-card': "Request sent — we'll contact you to set up your fuel card.",
    'efrouting-card': "Request sent — you'll get an email with your efRouting Fuel Card details.",
    transactions: "Request sent — we'll reach out to coordinate your fuel transactions.",
  }
  const addRequest = (type: RequestType, detail: string) => {
    setRequests((prev) => [
      ...prev,
      { id: `REQ-${prev.length + 1}`, type, detail, status: 'received', createdAt: new Date() },
    ])
    setNotice(REQUEST_NOTICE[type])
  }

  const startOnboardingSync = (ob: OnboardingState = onboarding) => {
    linkFleet(ob.cabins, DRIVER_POOL.map((d) => d.id), ob.range ?? '3m', ob.manualDrivers)
    patchOnboarding({ syncStarted: true })
  }

  // Prototype stand-in for the efRouting team closing every open request
  // (flow F5). Applies each request's effect: a custom fuel card replaces the
  // temporary efRouting one, a newly supported TMS/ELD connects and syncs the
  // same range the org picked, and the org gets a notice.
  const pendingRequests = requests.filter((r) => r.status !== 'resolved')
  const receivedRequests = requests.filter((r) => r.status === 'received')
  // Prototype: the team picks the new requests up (Received → In progress).
  const startRequests = () => {
    if (receivedRequests.length === 0) return
    setRequests((prev) => prev.map((r) => (r.status === 'received' ? { ...r, status: 'in-progress' } : r)))
    setNotice(`Our team started working on ${receivedRequests.length} request${receivedRequests.length === 1 ? '' : 's'}.`)
  }
  const resolveRequests = () => {
    if (pendingRequests.length === 0) return
    const ob = onboarding
    const patch: Partial<OnboardingState> = {}
    const notes: string[] = []
    pendingRequests.forEach((r) => {
      if (r.type === 'fuel-card' && ob.fuelCard?.kind === 'custom') {
        patch.fuelCard = { kind: 'catalog', name: ob.fuelCard.provider }
        notes.push(`${ob.fuelCard.provider} fuel card active, fuel analysis recalculated`)
      }
      if (r.type === 'eld' || r.type === 'tms') {
        // From the wizard (the onboarding source itself) or from Manage Fleet
        // (an extra provider) — either way it now connects.
        const src = ob[r.type]
        const fromWizard = src?.status === 'unsupported' && src.name === r.detail
        if (fromWizard) patch[r.type] = { ...src, status: 'connected' }
        const mono = fromWizard
          ? src.mono
          : r.detail.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? '').join('').slice(0, 2)
        connectIntegration(r.type, r.detail, mono)
        notes.push(`${r.detail} connected`)
      }
      if (r.type === 'transactions') notes.push('fuel transactions set up')
      if (r.type === 'efrouting-card') notes.push('efRouting Fuel Card issued')
    })
    setRequests((prev) => prev.map((r) => ({ ...r, status: 'resolved' })))
    const next = { ...ob, ...patch }
    setOnboarding(next)
    // ELD/TMS now connected: sync the range the org already picked. If the
    // sync never started (ELD was the blocker) and the rest is done, start it.
    const sourceResolved = pendingRequests.some((r) => r.type === 'eld' || r.type === 'tms')
    if (sourceResolved && next.eld?.status === 'connected' && next.fleetDone && next.range && next.fuelCard) {
      if (next.syncStarted) {
        const to = startOfDayLocal(new Date())
        runSyncRange(new Date(to.getFullYear(), to.getMonth() - monthsForPeriod(next.range), to.getDate()), to)
      } else {
        startOnboardingSync(next)
      }
    }
    setNotice(`Your requests were resolved: ${notes.join(' · ')}.`)
  }

  // A brand-new organization: nothing connected, linked or requested.
  const resetOrg = () => {
    setOnboarding(EMPTY_ONBOARDING)
    setRequests([])
    setFleet([])
    setDrivers([])
    setIntegrations([])
    setSync(null)
  }
  // V3 sign-up finished: the new org lands on the dashboard (sample data) with
  // nothing connected yet, ready to start its own Connect Fleet.
  const completeSignup = useCallback((acct: SignupAccount) => {
    setOnboarding(EMPTY_ONBOARDING)
    setRequests([])
    setFleet([])
    setDrivers([])
    setIntegrations([])
    setSync(null)
    setDataTab('overview')
    setGuideOpen(true)
    setGuideDismissed(false)
    setV3Page('dashboard')
    setV3Account(acct)
  }, [])

  // V3: closing the wizard half-way leaves a reminder of what's left.
  const onWizardClosed = () => {
    if (version !== 'v3' || onboarding.syncStarted) return
    const left = setupItems(onboarding).filter((i) => i.state === 'todo').length
    if (left > 0)
      setNotice(`You have ${left} setup step${left === 1 ? '' : 's'} left — pick up anytime from the setup guide.`)
  }
  // Closing the guide with requests still open points to where to follow them.
  const dismissGuide = () => {
    setGuideDismissed(true)
    if (pendingRequests.length > 0)
      setNotice('Follow your open requests anytime in My Company → Setup requests.')
  }
  const shareTransactions = () => {
    addRequest('transactions', 'Share fuel transactions')
    patchOnboarding({ transactionsContact: true })
  }

  // V3: notices on the KPI cards affected by what's skipped or pending.
  const v3Gaps = version === 'v3' && v3Account ? onboardingGaps(onboarding, requests) : []
  const kpiNotes: Record<string, { text: string; tip: string }> = {}
  if (v3Gaps.includes('fuelcard-pending'))
    kpiNotes.Fuel = { text: 'efRouting network', tip: ONBOARDING_LOSS['fuelcard-pending'].loss }
  else if (v3Gaps.includes('transactions') && onboarding.syncStarted)
    kpiNotes.Fuel = { text: 'Estimated from ELD', tip: ONBOARDING_LOSS.transactions.loss }
  if (v3Gaps.includes('tms-pending'))
    kpiNotes.Profitability = { text: 'No TMS yet', tip: ONBOARDING_LOSS['tms-pending'].loss }
  const initials = (name: string) =>
    name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() ?? '').join('').slice(0, 2)

  // Prototype controls for the onboarding (shown on the dashboard and My Company).
  const onboardingSim = (
    <>
      <span className="fleet-sim-label fleet-sim-sep">Onboarding requests</span>
      <button
        className="fleet-sim-btn"
        disabled={receivedRequests.length === 0}
        onClick={startRequests}
        title="Simulates the efRouting team starting on the new requests"
      >
        Start {receivedRequests.length} new
      </button>
      <button
        className="fleet-sim-btn"
        disabled={pendingRequests.length === 0}
        onClick={resolveRequests}
        title="Simulates the efRouting team resolving every open request"
      >
        Resolve {pendingRequests.length} pending
      </button>
      <button className="fleet-sim-btn" onClick={resetOrg} title="Start the onboarding over as a brand-new organization">
        Reset onboarding
      </button>
      {version === 'v3' && (
        <button
          className="fleet-sim-btn"
          onClick={() => {
            resetOrg()
            setV3Account(null)
          }}
          title="Go back to the start of the V3 sign-up"
        >
          Restart sign-up
        </button>
      )}
    </>
  )

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

  // V3 starts at sign-up, full screen (as in production). A small switcher
  // keeps the other versions one click away.
  if (version === 'v3' && !v3Account) {
    return (
      <>
        <SignupV3 onComplete={completeSignup} />
        <div className="su-versions">
          {(['v1', 'v2', 'v3'] as Version[]).map((v) => (
            <button key={v} className={version === v ? 'active' : ''} onClick={() => setVersion(v)}>
              {v.toUpperCase()}
            </button>
          ))}
        </div>
      </>
    )
  }

  return (
    <PeriodContext.Provider value={{ compareLabel, compareRange, rangeDays, rangeEnd, setPeriod }}>
      <div
        className={`app ${
          version === 'v3' && v3Account && !guideDismissed ? (guideOpen ? 'has-guide-open' : 'has-guide-pill') : ''
        }`}
      >
        <Sidebar
          version={version}
          onVersionChange={setVersion}
          page={version === 'v3' && v3Account ? v3Page : undefined}
          onPageChange={setV3Page}
        />
        <div className="main">
          <Header initials={version === 'v3' && v3Account ? initials(v3Account.name) || 'DP' : 'DP'} />
          <main className="content">
            {sync && <SyncBar sync={sync} />}
            {version === 'v3' && v3Account && v3Page === 'company' ? (
              <>
                <MyCompanyV3
                  account={v3Account}
                  ob={{ ...EMPTY_ONBOARDING, ...onboarding }}
                  onChange={patchOnboarding}
                  requests={requests}
                  onRequest={addRequest}
                  fleet={fleet}
                  drivers={drivers}
                  onAddDrivers={(extra) => addDrivers([], extra)}
                  onOpenWizard={(at) => setCompanyWizard({ at })}
                  onOpenManage={setCompanyManage}
                  onShareTransactions={shareTransactions}
                />
                <div className="fleet-sim">{onboardingSim}</div>
              </>
            ) : (
            <>
            <Toolbar
              tab={dataTab}
              onTabChange={(t) => {
                // A deliberate tab switch clears any load-seeded Trips search.
                setTripSearchSeed(null)
                setDataTab(t)
              }}
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
              onboarding={onboarding}
              onOnboardingChange={patchOnboarding}
              requests={requests}
              onRequest={addRequest}
              onStartOnboardingSync={() => startOnboardingSync()}
              v3={version === 'v3'}
              wizardTarget={wizardTarget}
              onWizardTargetHandled={clearWizardTarget}
              onWizardClosed={onWizardClosed}
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
                searchSeed={tripSearchSeed}
              />
            ) : (
              <>
                <KpiCards noData={noData} hideMarketPosition={view === 'summary'} cardNotes={kpiNotes} />
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
                      setTripSearchSeed(null)
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
                    <LiveOperations
                      noData={noData}
                      onFocusTruck={setMapFocus}
                      focusedId={mapFocus?.label ?? null}
                      onOpenLoad={(loadRef) => {
                        setTripSearchSeed(loadRef)
                        setTruckFilter([])
                        setDriverFilter([])
                        setTripsBand(null)
                        setMapFocus(null)
                        setDataTab('full')
                      }}
                    />
                    <MarketMap
                      fill
                      dimension={analysisDim}
                      focus={mapFocus}
                      onClearFocus={() => setMapFocus(null)}
                    />
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
              {view === 'dashboard' && onboardingSim}
            </div>
            </>
            )}
          </main>
        </div>
        {syncToast && (
          <Toast
            message="Fleet connected — your operation is ready in the dashboard."
            onDone={() => setSyncToast(false)}
          />
        )}
        {notice && !syncToast && <Toast message={notice} onDone={clearNotice} duration={5500} />}
        {version === 'v3' && v3Account && !guideDismissed && (
          <SetupGuide
            ob={{ ...EMPTY_ONBOARDING, ...onboarding }}
            requests={requests}
            sync={sync}
            open={guideOpen}
            onToggle={setGuideOpen}
            onOpenWizard={(t) => {
              if (v3Page === 'company') return setCompanyWizard({ at: t })
              setDataTab('overview')
              setWizardTarget(t)
            }}
            onShareTransactions={shareTransactions}
            onDismiss={dismissGuide}
            onTrackRequests={v3Page === 'company' ? undefined : () => setV3Page('company')}
          />
        )}
        {/* V3 · My Company hosts its own wizard and Manage Fleet. */}
        {companyWizard && (
          <ConnectFleetV2
            ob={{ ...EMPTY_ONBOARDING, ...onboarding }}
            onChange={patchOnboarding}
            requests={requests}
            onRequest={addRequest}
            onConnectIntegration={connectIntegration}
            onStartSync={() => startOnboardingSync()}
            sync={sync}
            onClose={() => {
              setCompanyWizard(null)
              onWizardClosed()
            }}
            v3
            initialStep={companyWizard.at}
          />
        )}
        {companyManage && (
          <ManageFleetModal
            onClose={() => setCompanyManage(null)}
            sync={sync}
            fleet={fleet}
            drivers={drivers}
            integrations={integrations}
            onSyncCabins={syncCabins}
            onRemoveCabin={removeCabin}
            onAddDrivers={(ids) => addDrivers(ids)}
            onRemoveIntegration={removeIntegration}
            onConnectIntegration={connectIntegration}
            v2
            v3
            trailers={onboarding.trailers}
            onTrailersChange={(ids) => patchOnboarding({ trailers: ids })}
            requests={requests}
            onRequest={addRequest}
            initialTab={companyManage}
          />
        )}
      </div>
    </PeriodContext.Provider>
  )
}
