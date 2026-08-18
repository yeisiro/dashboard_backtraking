import { useMemo, useState } from 'react'
import { X, ArrowLeft, Search, Check, Trash2, Plus, RefreshCw, Cable, Truck, User } from 'lucide-react'
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

// Native <select> for a sync window. Native so its popup escapes the modal's
// overflow clipping and stays usable inside the scrolling lists.
function RangeSelect({
  value,
  onChange,
  className = '',
}: {
  value: PeriodKey
  onChange: (v: PeriodKey) => void
  className?: string
}) {
  return (
    <select className={`mf-select ${className}`} value={value} onChange={(e) => onChange(e.target.value as PeriodKey)}>
      {SYNC_PERIODS.map((p) => (
        <option key={p.key} value={p.key}>
          {p.label}
        </option>
      ))}
    </select>
  )
}

type Tab = 'integrations' | 'cabins' | 'drivers'
type Sub = null | 'add-cabin' | 'add-driver' | 'add-integration'

interface Props {
  onClose: () => void
  fleet: FleetCabin[]
  drivers: FleetDriver[]
  integrations: Integration[]
  onUpdateCabinRange: (id: string, range: PeriodKey) => void
  onRemoveCabin: (id: string) => void
  onAddCabins: (ids: string[], range: PeriodKey) => void
  onUpdateDriverRange: (id: string, range: PeriodKey) => void
  onRemoveDriver: (id: string) => void
  onAddDrivers: (ids: string[], range: PeriodKey) => void
  onRemoveIntegration: (type: 'eld' | 'tms', name: string) => void
  onConnectIntegration: (type: 'eld' | 'tms', name: string, mono: string) => void
  onSync: (months: number) => void
}

export default function ManageFleetModal({
  onClose,
  fleet,
  drivers,
  integrations,
  onUpdateCabinRange,
  onRemoveCabin,
  onAddCabins,
  onUpdateDriverRange,
  onRemoveDriver,
  onAddDrivers,
  onRemoveIntegration,
  onConnectIntegration,
  onSync,
}: Props) {
  const [tab, setTab] = useState<Tab>('integrations')
  const [sub, setSub] = useState<Sub>(null)
  // Deeper history is what forces a re-pull, so only widening/adding sets this.
  const [pendingMonths, setPendingMonths] = useState(0)
  const bumpPending = (months: number) => setPendingMonths((m) => Math.max(m, months))

  // ── Cabins ──
  const [cabinQuery, setCabinQuery] = useState('')
  const cabinsShown = fleet.filter((c) => c.id.toLowerCase().includes(cabinQuery.toLowerCase()))
  const [addCabinQuery, setAddCabinQuery] = useState('')
  const [addCabinSel, setAddCabinSel] = useState<string[]>([])
  const [addCabinRange, setAddCabinRange] = useState<PeriodKey>('3m')
  const fleetIds = useMemo(() => new Set(fleet.map((c) => c.id)), [fleet])
  const availCabins = useMemo(() => CABIN_POOL.filter((id) => !fleetIds.has(id)), [fleetIds])
  const cabinAddShown = availCabins.filter((id) => id.toLowerCase().includes(addCabinQuery.toLowerCase()))
  const allCabinAddSel = cabinAddShown.length > 0 && cabinAddShown.every((id) => addCabinSel.includes(id))

  const changeCabinRange = (id: string, next: PeriodKey) => {
    const cur = fleet.find((c) => c.id === id)
    if (cur && monthsForPeriod(next) > monthsForPeriod(cur.range)) bumpPending(monthsForPeriod(next))
    onUpdateCabinRange(id, next)
  }

  // ── Drivers ──
  const [driverQuery, setDriverQuery] = useState('')
  const driversShown = drivers.filter((d) => d.name.toLowerCase().includes(driverQuery.toLowerCase()))
  const [addDriverQuery, setAddDriverQuery] = useState('')
  const [addDriverSel, setAddDriverSel] = useState<string[]>([])
  const [addDriverRange, setAddDriverRange] = useState<PeriodKey>('3m')
  const driverIds = useMemo(() => new Set(drivers.map((d) => d.id)), [drivers])
  const availDrivers = useMemo(() => DRIVER_POOL.filter((d) => !driverIds.has(d.id)), [driverIds])
  const driverAddShown = availDrivers.filter((d) => d.name.toLowerCase().includes(addDriverQuery.toLowerCase()))
  const allDriverAddSel = driverAddShown.length > 0 && driverAddShown.every((d) => addDriverSel.includes(d.id))

  const changeDriverRange = (id: string, next: PeriodKey) => {
    const cur = drivers.find((d) => d.id === id)
    if (cur && monthsForPeriod(next) > monthsForPeriod(cur.range)) bumpPending(monthsForPeriod(next))
    onUpdateDriverRange(id, next)
  }

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

  const finish = () => {
    if (pendingMonths > 0) onSync(pendingMonths)
    onClose()
  }

  const TABS: { key: Tab; label: string; icon: typeof Cable; count: number }[] = [
    { key: 'integrations', label: 'Integrations', icon: Cable, count: integrations.length },
    { key: 'cabins', label: 'Cabins', icon: Truck, count: fleet.length },
    { key: 'drivers', label: 'Drivers', icon: User, count: drivers.length },
  ]

  // ─────────────────────── Add sub-views ───────────────────────
  if (sub === 'add-cabin' || sub === 'add-driver' || sub === 'add-integration') {
    const isCabin = sub === 'add-cabin'
    const isDriver = sub === 'add-driver'
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal cfm" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <button
              className="cfm-back"
              onClick={() => {
                setSub(null)
                resetAddIntegration()
              }}
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <span className="cfm-title">
              {isCabin ? 'Add cabins' : isDriver ? 'Add drivers' : 'Add integration'}
            </span>
            <button className="cfm-x" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          {/* Add cabins */}
          {isCabin && (
            <>
              <div className="modal-body">
                <div className="field">
                  <label>Sync window for new cabins</label>
                  <RangeSelect value={addCabinRange} onChange={setAddCabinRange} className="mf-select-block" />
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
                        <button
                          key={id}
                          className={`lc-row ${s ? 'sel' : ''}`}
                          onClick={() => setAddCabinSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))}
                        >
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
                    onAddCabins(addCabinSel, addCabinRange)
                    bumpPending(monthsForPeriod(addCabinRange))
                    setAddCabinSel([])
                    setSub(null)
                  }}
                >
                  Add cabins
                </button>
              </div>
            </>
          )}

          {/* Add drivers */}
          {isDriver && (
            <>
              <div className="modal-body">
                <div className="field">
                  <label>Sync window for new drivers</label>
                  <RangeSelect value={addDriverRange} onChange={setAddDriverRange} className="mf-select-block" />
                </div>
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
                        allDriverAddSel
                          ? p.filter((id) => !driverAddShown.some((d) => d.id === id))
                          : [...new Set([...p, ...driverAddShown.map((d) => d.id)])],
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
                        <button
                          key={d.id}
                          className={`lc-row ${s ? 'sel' : ''}`}
                          onClick={() => setAddDriverSel((p) => (p.includes(d.id) ? p.filter((x) => x !== d.id) : [...p, d.id]))}
                        >
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
                    onAddDrivers(addDriverSel, addDriverRange)
                    bumpPending(monthsForPeriod(addDriverRange))
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
                        <button
                          key={p.name}
                          className={`cfm-tms-card${already ? ' connected' : ''}`}
                          disabled={already}
                          onClick={() => {
                            setIntProvider(p)
                            setIntValues({})
                          }}
                        >
                          <span className="cfm-tms-logo">{p.mono}</span>
                          <span className="cfm-tms-name">{p.name}</span>
                          {already ? (
                            <span className="cfm-conn-badge"><Check size={11} strokeWidth={3} /> Connected</span>
                          ) : null}
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
                        <input
                          type={f.secret ? 'password' : 'text'}
                          placeholder={f.placeholder}
                          value={intValues[f.key] ?? ''}
                          onChange={(e) => setIntValues((v) => ({ ...v, [f.key]: e.target.value }))}
                        />
                      </div>
                      <span className="cfm-oblig">Obligatory</span>
                    </div>
                  ))}
                  <button
                    className="cfm-primary"
                    disabled={!intComplete}
                    onClick={() => {
                      onConnectIntegration(intType, intProvider.name, intProvider.mono)
                      bumpPending(3) // pull ~3 months of history for the new source
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
                      <div className="mf-int-sub">
                        {i.type.toUpperCase()} · <span className="mf-int-ok">Synchronized</span>
                      </div>
                    </div>
                    <button className="mf-unlink" onClick={() => onRemoveIntegration(i.type, i.name)}>
                      Unlink
                    </button>
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
              <div className="tf-scroll mf-list">
                {cabinsShown.length === 0 ? (
                  <p className="mf-empty">No cabins linked yet.</p>
                ) : (
                  cabinsShown.map((c) => (
                    <div className="mf-row" key={c.id}>
                      <span className="mf-id">{c.id}</span>
                      <div className="mf-row-right">
                        <span className="mf-range-label">Sync</span>
                        <RangeSelect value={c.range} onChange={(v) => changeCabinRange(c.id, v)} />
                        <button className="mf-remove" onClick={() => onRemoveCabin(c.id)} aria-label={`Remove ${c.id}`}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* Drivers */}
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
                      <div className="mf-row-right">
                        <span className="mf-range-label">Sync</span>
                        <RangeSelect value={d.range} onChange={(v) => changeDriverRange(d.id, v)} />
                        <button className="mf-remove" onClick={() => onRemoveDriver(d.id)} aria-label={`Remove ${d.name}`}>
                          <Trash2 size={16} />
                        </button>
                      </div>
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
          {pendingMonths > 0 && (
            <span className="mf-pending">
              <RefreshCw size={13} /> Changes will sync on finish
            </span>
          )}
          <button className="btn-pill" onClick={finish}>
            {pendingMonths > 0 ? 'Sync & finish' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  )
}
