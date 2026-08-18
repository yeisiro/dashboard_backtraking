import { useEffect, useMemo, useState } from 'react'
import { X, ArrowLeft, Search, Check, Trash2, Plus, Cable, Truck, User, RefreshCw } from 'lucide-react'
import { type SyncState } from './ConnectFleetModal'
import {
  CABIN_POOL,
  DRIVER_POOL,
  SYNC_PERIODS,
  ELD_PROVIDERS,
  TMS_PROVIDERS,
  monthsForPeriod,
  type PeriodKey,
  type FleetCabin,
  type FleetDriver,
  type Integration,
  type Provider,
} from '../data'

const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fromISO = (s: string) => new Date(s + 'T00:00:00')
const startOfToday = () => {
  const t = new Date()
  return new Date(t.getFullYear(), t.getMonth(), t.getDate())
}
const subMonths = (d: Date, m: number) => new Date(d.getFullYear(), d.getMonth() - m, d.getDate())

type RangeMode = PeriodKey | 'custom'

// Resolve the picked window to a concrete [from, to].
function resolveRange(mode: RangeMode, customFrom: string, customTo: string): { from: Date; to: Date } {
  if (mode === 'custom') return { from: fromISO(customFrom), to: fromISO(customTo) }
  const to = startOfToday()
  return { from: subMonths(to, monthsForPeriod(mode)), to }
}

// Preset/custom date-window picker used by the on-demand sync bar and the
// "Add cabins" flow.
function RangePicker({
  mode,
  onMode,
  from,
  onFrom,
  to,
  onTo,
}: {
  mode: RangeMode
  onMode: (m: RangeMode) => void
  from: string
  onFrom: (v: string) => void
  to: string
  onTo: (v: string) => void
}) {
  return (
    <div className="mf-range">
      <select className="mf-select" value={mode} onChange={(e) => onMode(e.target.value as RangeMode)}>
        {SYNC_PERIODS.map((p) => (
          <option key={p.key} value={p.key}>
            Last {p.label}
          </option>
        ))}
        <option value="custom">Custom range</option>
      </select>
      {mode === 'custom' && (
        <div className="mf-range-custom">
          <input type="date" className="mf-date" value={from} max={to} onChange={(e) => onFrom(e.target.value)} />
          <span className="mf-range-dash">–</span>
          <input type="date" className="mf-date" value={to} min={from} onChange={(e) => onTo(e.target.value)} />
        </div>
      )}
    </div>
  )
}

type Tab = 'integrations' | 'cabins' | 'drivers'
type Sub = null | 'add-cabin' | 'add-driver' | 'add-integration'

interface Props {
  onClose: () => void
  sync?: SyncState | null
  fleet: FleetCabin[]
  drivers: FleetDriver[]
  integrations: Integration[]
  onSyncCabins: (ids: string[], from: Date, to: Date) => void
  onRemoveCabin: (id: string) => void
  onAddDrivers: (ids: string[]) => void
  onRemoveDriver: (id: string) => void
  onRemoveIntegration: (type: 'eld' | 'tms', name: string) => void
  onConnectIntegration: (type: 'eld' | 'tms', name: string, mono: string) => void
}

export default function ManageFleetModal({
  onClose,
  sync,
  fleet,
  drivers,
  integrations,
  onSyncCabins,
  onRemoveCabin,
  onAddDrivers,
  onRemoveDriver,
  onRemoveIntegration,
  onConnectIntegration,
}: Props) {
  const [tab, setTab] = useState<Tab>('integrations')
  const [sub, setSub] = useState<Sub>(null)

  // Cabins currently being processed by the in-modal sync (so we can show a
  // progress readout on their rows without closing the modal). Cleared once the
  // background sync finishes and retires.
  const [syncingIds, setSyncingIds] = useState<string[]>([])
  const syncActive = !!sync && !sync.done
  const syncPct = Math.round(sync?.progress ?? 0)
  useEffect(() => {
    if (sync === null) setSyncingIds([])
  }, [sync])

  const defFrom = toISO(subMonths(startOfToday(), 3))
  const defTo = toISO(startOfToday())

  // ── Cabins: on-demand sync selection + window ──
  const [cabinQuery, setCabinQuery] = useState('')
  const cabinsShown = fleet.filter((c) => c.id.toLowerCase().includes(cabinQuery.toLowerCase()))
  const [syncSel, setSyncSel] = useState<string[]>([])
  const [rangeMode, setRangeMode] = useState<RangeMode>('3m')
  const [customFrom, setCustomFrom] = useState(defFrom)
  const [customTo, setCustomTo] = useState(defTo)
  const allCabinsSelected = cabinsShown.length > 0 && cabinsShown.every((c) => syncSel.includes(c.id))
  const toggleSync = (id: string) =>
    setSyncSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const doSyncSelected = () => {
    const { from, to } = resolveRange(rangeMode, customFrom, customTo)
    setSyncingIds(syncSel)
    onSyncCabins(syncSel, from, to)
    setSyncSel([])
  }

  // ── Add cabins ──
  const [addCabinQuery, setAddCabinQuery] = useState('')
  const [addCabinSel, setAddCabinSel] = useState<string[]>([])
  const [addRangeMode, setAddRangeMode] = useState<RangeMode>('3m')
  const [addFrom, setAddFrom] = useState(defFrom)
  const [addTo, setAddTo] = useState(defTo)
  const fleetIds = useMemo(() => new Set(fleet.map((c) => c.id)), [fleet])
  const availCabins = useMemo(() => CABIN_POOL.filter((id) => !fleetIds.has(id)), [fleetIds])
  const cabinAddShown = availCabins.filter((id) => id.toLowerCase().includes(addCabinQuery.toLowerCase()))
  const allCabinAddSel = cabinAddShown.length > 0 && cabinAddShown.every((id) => addCabinSel.includes(id))

  // ── Drivers ──
  const [driverQuery, setDriverQuery] = useState('')
  const driversShown = drivers.filter((d) => d.name.toLowerCase().includes(driverQuery.toLowerCase()))
  const [addDriverQuery, setAddDriverQuery] = useState('')
  const [addDriverSel, setAddDriverSel] = useState<string[]>([])
  const driverIds = useMemo(() => new Set(drivers.map((d) => d.id)), [drivers])
  const availDrivers = useMemo(() => DRIVER_POOL.filter((d) => !driverIds.has(d.id)), [driverIds])
  const driverAddShown = availDrivers.filter((d) => d.name.toLowerCase().includes(addDriverQuery.toLowerCase()))
  const allDriverAddSel = driverAddShown.length > 0 && driverAddShown.every((d) => addDriverSel.includes(d.id))

  // ── Add integration ──
  const [intType, setIntType] = useState<'eld' | 'tms'>('eld')
  const [intProvider, setIntProvider] = useState<Provider | null>(null)
  const [intValues, setIntValues] = useState<Record<string, string>>({})
  const providers = intType === 'eld' ? ELD_PROVIDERS : TMS_PROVIDERS
  const connectedNames = new Set(integrations.map((i) => i.type + ':' + i.name))
  const intComplete = !!intProvider && intProvider.fields.every((f) => (intValues[f.key] ?? '').trim())
  const resetAddIntegration = () => {
    setIntProvider(null)
    setIntValues({})
  }

  // ─────────────────────── Add sub-views ───────────────────────
  if (sub === 'add-cabin' || sub === 'add-driver' || sub === 'add-integration') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal cfm" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <button className="cfm-back" onClick={() => { setSub(null); resetAddIntegration() }} aria-label="Back">
              <ArrowLeft size={18} />
            </button>
            <span className="cfm-title">
              {sub === 'add-cabin' ? 'Add cabins' : sub === 'add-driver' ? 'Add drivers' : 'Add integration'}
            </span>
            <button className="cfm-x" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          {/* Add cabins */}
          {sub === 'add-cabin' && (
            <>
              <div className="modal-body">
                <div className="field">
                  <label>Sync window for new cabins</label>
                  <RangePicker mode={addRangeMode} onMode={setAddRangeMode} from={addFrom} onFrom={setAddFrom} to={addTo} onTo={setAddTo} />
                </div>
                <div className="tf-search">
                  <Search size={15} color="var(--text-muted)" />
                  <input placeholder="Search by ID or plate..." value={addCabinQuery} onChange={(e) => setAddCabinQuery(e.target.value)} />
                </div>
                <div className="lc-bar">
                  <span className="lc-count">{addCabinSel.length} of {availCabins.length} selected</span>
                  <button
                    className="lc-selectall"
                    onClick={() =>
                      setAddCabinSel((p) =>
                        allCabinAddSel ? p.filter((id) => !cabinAddShown.includes(id)) : [...new Set([...p, ...cabinAddShown])],
                      )
                    }
                  >
                    {allCabinAddSel ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <div className="tf-scroll lc-list">
                  {cabinAddShown.length === 0 ? (
                    <p className="mf-empty">No more cabins available to add.</p>
                  ) : (
                    cabinAddShown.map((id) => {
                      const s = addCabinSel.includes(id)
                      return (
                        <button key={id} className={`lc-row ${s ? 'sel' : ''}`} onClick={() => setAddCabinSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))}>
                          <span className="lc-box">{s && <Check size={13} strokeWidth={3} />}</span>
                          <span className="lc-id">{id}</span>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
              <div className="modal-foot">
                <button className="btn-text" onClick={() => setSub(null)}>Cancel</button>
                <button
                  className="btn-pill"
                  disabled={addCabinSel.length === 0}
                  onClick={() => {
                    const { from, to } = resolveRange(addRangeMode, addFrom, addTo)
                    setSyncingIds(addCabinSel)
                    onSyncCabins(addCabinSel, from, to)
                    setAddCabinSel([])
                    setSub(null)
                  }}
                >
                  Add &amp; sync
                </button>
              </div>
            </>
          )}

          {/* Add drivers (no sync window) */}
          {sub === 'add-driver' && (
            <>
              <div className="modal-body">
                <p className="cfm-sub">Pick the drivers to add to your DB.</p>
                <div className="tf-search">
                  <Search size={15} color="var(--text-muted)" />
                  <input placeholder="Search driver..." value={addDriverQuery} onChange={(e) => setAddDriverQuery(e.target.value)} />
                </div>
                <div className="lc-bar">
                  <span className="lc-count">{addDriverSel.length} of {availDrivers.length} selected</span>
                  <button
                    className="lc-selectall"
                    onClick={() =>
                      setAddDriverSel((p) =>
                        allDriverAddSel ? p.filter((id) => !driverAddShown.some((d) => d.id === id)) : [...new Set([...p, ...driverAddShown.map((d) => d.id)])],
                      )
                    }
                  >
                    {allDriverAddSel ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <div className="tf-scroll lc-list">
                  {driverAddShown.length === 0 ? (
                    <p className="mf-empty">No more drivers available to add.</p>
                  ) : (
                    driverAddShown.map((d) => {
                      const s = addDriverSel.includes(d.id)
                      return (
                        <button key={d.id} className={`lc-row ${s ? 'sel' : ''}`} onClick={() => setAddDriverSel((p) => (p.includes(d.id) ? p.filter((x) => x !== d.id) : [...p, d.id]))}>
                          <span className="lc-box">{s && <Check size={13} strokeWidth={3} />}</span>
                          <span className="lc-id">{d.name}</span>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
              <div className="modal-foot">
                <button className="btn-text" onClick={() => setSub(null)}>Cancel</button>
                <button
                  className="btn-pill"
                  disabled={addDriverSel.length === 0}
                  onClick={() => {
                    onAddDrivers(addDriverSel)
                    setAddDriverSel([])
                    setSub(null)
                  }}
                >
                  Add drivers
                </button>
              </div>
            </>
          )}

          {/* Add integration */}
          {sub === 'add-integration' && (
            <div className="modal-body">
              {!intProvider ? (
                <>
                  <div className="cfm-seg">
                    <button className={intType === 'eld' ? 'active' : ''} onClick={() => setIntType('eld')}>ELD</button>
                    <button className={intType === 'tms' ? 'active' : ''} onClick={() => setIntType('tms')}>TMS</button>
                  </div>
                  <p className="cfm-sub">Choose a {intType.toUpperCase()} provider to connect.</p>
                  <div className="cfm-tms-grid one">
                    {providers.map((p) => {
                      const already = connectedNames.has(intType + ':' + p.name)
                      return (
                        <button key={p.name} className={`cfm-tms-card${already ? ' connected' : ''}`} disabled={already} onClick={() => { setIntProvider(p); setIntValues({}) }}>
                          <span className="cfm-tms-logo">{p.mono}</span>
                          <span className="cfm-tms-name">{p.name}</span>
                          {already && <span className="cfm-conn-badge"><Check size={11} strokeWidth={3} /> Connected</span>}
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : (
                <>
                  <div className="cfm-cred-head">
                    <span className="cfm-tms-logo sm">{intProvider.mono}</span>
                    <span>Connect {intProvider.name}</span>
                  </div>
                  {intProvider.fields.map((f) => (
                    <div className="field" key={f.key}>
                      <label>{f.label}</label>
                      <div className="field-input">
                        <input type={f.secret ? 'password' : 'text'} placeholder={f.placeholder} value={intValues[f.key] ?? ''} onChange={(e) => setIntValues((v) => ({ ...v, [f.key]: e.target.value }))} />
                      </div>
                      {f.hintTemplate ? (
                        <span className="cfm-hint">
                          Your API URL: <b>{f.hintTemplate.replace('{v}', (intValues[f.key] || '[company]').trim() || '[company]')}</b>
                        </span>
                      ) : (
                        <span className="cfm-oblig">Required</span>
                      )}
                    </div>
                  ))}
                  <button
                    className="cfm-primary"
                    disabled={!intComplete}
                    onClick={() => {
                      onConnectIntegration(intType, intProvider.name, intProvider.mono)
                      resetAddIntegration()
                      setSub(null)
                    }}
                  >
                    Connect {intProvider.name}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─────────────────────── Main hub ───────────────────────
  const TABS: { key: Tab; label: string; icon: typeof Cable; count: number }[] = [
    { key: 'integrations', label: 'Integrations', icon: Cable, count: integrations.length },
    { key: 'cabins', label: 'Cabins', icon: Truck, count: fleet.length },
    { key: 'drivers', label: 'Drivers', icon: User, count: drivers.length },
  ]
  const addLabel = tab === 'cabins' ? 'Add cabins' : tab === 'drivers' ? 'Add drivers' : 'Add integration'
  const openAdd = () => setSub(tab === 'cabins' ? 'add-cabin' : tab === 'drivers' ? 'add-driver' : 'add-integration')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal cfm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span style={{ width: 18 }} />
          <span className="cfm-title">Manage fleet</span>
          <button className="cfm-x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="mf-tabs">
          {TABS.map((t) => (
            <button key={t.key} className={`mf-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              <t.icon size={14} />
              {t.label}
              <span className="mf-tab-count">{t.count}</span>
            </button>
          ))}
        </div>

        <div className="modal-body">
          {/* Integrations */}
          {tab === 'integrations' && (
            integrations.length === 0 ? (
              <p className="mf-empty">No integrations connected yet.</p>
            ) : (
              <div className="mf-list">
                {integrations.map((i) => (
                  <div className="mf-int-row" key={i.type + i.name}>
                    <span className="cfm-tms-logo sm">{i.mono}</span>
                    <div className="mf-int-txt">
                      <div className="mf-int-name">{i.name}</div>
                      <div className="mf-int-sub">{i.type.toUpperCase()} · <span className="mf-int-ok">Synchronized</span></div>
                    </div>
                    <button className="mf-unlink" onClick={() => onRemoveIntegration(i.type, i.name)}>Unlink</button>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Cabins */}
          {tab === 'cabins' && (
            <>
              <div className="tf-search">
                <Search size={15} color="var(--text-muted)" />
                <input placeholder="Search by ID or plate..." value={cabinQuery} onChange={(e) => setCabinQuery(e.target.value)} />
              </div>

              {/* On-demand sync bar */}
              <div className="mf-syncbar">
                <button
                  className="mf-checkall"
                  onClick={() =>
                    setSyncSel((p) => (allCabinsSelected ? p.filter((id) => !cabinsShown.some((c) => c.id === id)) : [...new Set([...p, ...cabinsShown.map((c) => c.id)])]))
                  }
                >
                  <span className={`lc-box ${allCabinsSelected ? 'on' : ''}`}>{allCabinsSelected && <Check size={13} strokeWidth={3} />}</span>
                  Select all
                </button>
                <RangePicker mode={rangeMode} onMode={setRangeMode} from={customFrom} onFrom={setCustomFrom} to={customTo} onTo={setCustomTo} />
                <button className="mf-sync-now" disabled={syncSel.length === 0} onClick={doSyncSelected}>
                  <RefreshCw size={14} /> Sync {syncSel.length || ''}
                </button>
              </div>

              {/* In-modal progress while the picked cabins process */}
              {syncActive && syncingIds.length > 0 && (
                <div className="mf-progress">
                  <div className="mf-progress-row">
                    <span className="mf-progress-lbl">
                      <RefreshCw size={13} className="refresh-spin" /> Syncing {syncingIds.length}{' '}
                      {syncingIds.length === 1 ? 'cabin' : 'cabins'}…
                    </span>
                    <span className="mf-progress-pct">{syncPct}%</span>
                  </div>
                  <div className="mf-progress-track">
                    <div className="mf-progress-fill" style={{ width: `${syncPct}%` }} />
                  </div>
                </div>
              )}

              <div className="tf-scroll mf-list">
                {cabinsShown.length === 0 ? (
                  <p className="mf-empty">No cabins linked yet.</p>
                ) : (
                  cabinsShown.map((c) => {
                    const sel = syncSel.includes(c.id)
                    const processing = syncActive && syncingIds.includes(c.id)
                    return (
                      <div className={`mf-crow ${processing ? 'processing' : ''}`} key={c.id}>
                        <button className="mf-check" onClick={() => toggleSync(c.id)} aria-label={`Select ${c.id}`} disabled={processing}>
                          <span className={`lc-box ${sel ? 'on' : ''}`}>{sel && <Check size={13} strokeWidth={3} />}</span>
                        </button>
                        <span className="mf-id">{c.id}</span>
                        {processing ? (
                          <span className="mf-synced mf-syncing">
                            <RefreshCw size={12} className="refresh-spin" /> Syncing… {syncPct}%
                          </span>
                        ) : (
                          <span className="mf-synced">Synced {fmtDate(c.syncedFrom)} – {fmtDate(c.syncedTo)}</span>
                        )}
                        <button className="mf-remove" onClick={() => onRemoveCabin(c.id)} aria-label={`Remove ${c.id}`}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </>
          )}

          {/* Drivers (no sync window) */}
          {tab === 'drivers' && (
            <>
              <div className="tf-search">
                <Search size={15} color="var(--text-muted)" />
                <input placeholder="Search driver..." value={driverQuery} onChange={(e) => setDriverQuery(e.target.value)} />
              </div>
              <div className="tf-scroll mf-list">
                {driversShown.length === 0 ? (
                  <p className="mf-empty">No drivers linked yet.</p>
                ) : (
                  driversShown.map((d) => (
                    <div className="mf-row" key={d.id}>
                      <span className="mf-id mf-id-driver">{d.name}</span>
                      <button className="mf-remove" onClick={() => onRemoveDriver(d.id)} aria-label={`Remove ${d.name}`}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <div className="modal-foot">
          <button className="cfm-add-btn" onClick={openAdd}>
            <Plus size={16} /> {addLabel}
          </button>
          <button className="btn-pill" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
