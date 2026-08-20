import { useEffect, useMemo, useState } from 'react'
import { X, ArrowLeft, ChevronRight, ChevronDown, Search, Check, Plus, UserPlus } from 'lucide-react'
import { CABIN_POOL, DRIVER_POOL, SYNC_PERIODS, ELD_PROVIDERS, TMS_PROVIDERS, type PeriodKey, type Provider, type FleetDriver } from '../data'

// End-to-end onboarding wizard: connect the ELD, then the TMS, link the cabins
// we discover across both, pick how much history to pull, and watch it sync.
// Runs in both V1 and V2 (Toolbar mounts it). It's a preview flow — the sync
// step fills a progress bar over ~5s and finishes with a completion toast.
type Step = 'eld' | 'eld-cred' | 'tms' | 'tms-cred' | 'cabins' | 'drivers' | 'period' | 'syncing'

// Provider metadata + credential fields live in data.ts so the connect wizard
// and the manage → Integrations tab ask for exactly the same inputs.
const eldList = ELD_PROVIDERS
const tmsList = TMS_PROVIDERS

// Cabins "discovered" across the connected TMS + ELD, and the sync windows on
// offer, both shared with the manage-fleet view (see data.ts).
const CABINS = CABIN_POOL
const PERIODS = SYNC_PERIODS

// Live sync state, owned by App so it survives closing this modal and drives
// the top SyncBar. Shared shape (structural typing avoids a circular import).
export interface SyncState {
  progress: number
  start: Date // oldest date being synced (fixed)
  target: Date // newest date = today (final end of the window)
  done: boolean
  inc: number // progress added per 100ms tick — scales the fill to the range size
}

const money2 = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const STEP_LABELS = ['ELD', 'TMS', 'Cabins', 'Drivers', 'Data range']
function stepIndexOf(step: Step): number {
  if (step === 'eld' || step === 'eld-cred') return 0
  if (step === 'tms' || step === 'tms-cred') return 1
  if (step === 'cabins') return 2
  if (step === 'drivers') return 3
  return 4 // period / syncing
}

interface Props {
  onClose: () => void
  // Link the chosen cabins + drivers at the chosen window and kick off the
  // background sync (App owns both). The modal then shows a live view to leave.
  onStartSync?: (cabinIds: string[], driverIds: string[], range: PeriodKey, extraDrivers?: FleetDriver[]) => void
  // Record a connected ELD/TMS so Manage → Integrations can list it.
  onConnectIntegration?: (type: 'eld' | 'tms', name: string, mono: string) => void
  // Live sync state fed back from App while the modal stays open.
  sync?: SyncState | null
}

export default function ConnectFleetModal({ onClose, onStartSync, onConnectIntegration, sync }: Props) {
  const [step, setStep] = useState<Step>('eld')

  // ELD + TMS selection/credentials.
  const [eld, setEld] = useState<Provider | null>(null)
  const [eldValues, setEldValues] = useState<Record<string, string>>({})
  const [tms, setTms] = useState<Provider | null>(null)
  const [tmsValues, setTmsValues] = useState<Record<string, string>>({})
  const [tmsQuery, setTmsQuery] = useState('')

  // Cabins linking.
  const [cabinQuery, setCabinQuery] = useState('')
  const [selectedCabins, setSelectedCabins] = useState<string[]>([])

  // Drivers. Every driver discovered across the ELD + TMS is integrated — the
  // list is read-only. The operator can add anyone the systems missed by name;
  // those manual entries are the only removable rows.
  const [driverQuery, setDriverQuery] = useState('')
  const [manualDrivers, setManualDrivers] = useState<FleetDriver[]>([])
  const [addingDriver, setAddingDriver] = useState(false)
  const [newDriverName, setNewDriverName] = useState('')
  const allDrivers: (FleetDriver & { manual: boolean })[] = useMemo(
    () => [
      ...DRIVER_POOL.map((d) => ({ ...d, manual: false })),
      ...manualDrivers.map((d) => ({ ...d, manual: true })),
    ],
    [manualDrivers],
  )
  const driversFiltered = useMemo(
    () => allDrivers.filter((d) => d.name.toLowerCase().includes(driverQuery.toLowerCase())),
    [allDrivers, driverQuery],
  )
  const addManualDriver = () => {
    const name = newDriverName.trim()
    if (!name) return
    setManualDrivers((p) => [...p, { id: `DRV-NEW-${p.length + 1}`, name }])
    setNewDriverName('')
    setAddingDriver(false)
  }
  const removeManualDriver = (id: string) =>
    setManualDrivers((p) => p.filter((d) => d.id !== id))

  // Data range (sync progress itself lives in App, read via the `sync` prop).
  const [range, setRange] = useState<PeriodKey>('3m')
  const [rangeOpen, setRangeOpen] = useState(false)
  const progress = sync?.progress ?? 0

  const eldComplete = !!eld && eld.fields.every((f) => (eldValues[f.key] ?? '').trim())
  const tmsComplete = !!tms && tms.fields.every((f) => (tmsValues[f.key] ?? '').trim())
  const tmsFiltered = tmsList.filter((t) => t.name.toLowerCase().includes(tmsQuery.toLowerCase()))
  const cabinsFiltered = useMemo(
    () => CABINS.filter((c) => c.toLowerCase().includes(cabinQuery.toLowerCase())),
    [cabinQuery],
  )
  const allShownSelected =
    cabinsFiltered.length > 0 && cabinsFiltered.every((c) => selectedCabins.includes(c))

  const toggleCabin = (id: string) =>
    setSelectedCabins((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const toggleAllShown = () =>
    setSelectedCabins((p) =>
      allShownSelected ? p.filter((c) => !cabinsFiltered.includes(c)) : [...new Set([...p, ...cabinsFiltered])],
    )

  // Once the sync finishes, close the modal (App keeps the completion toast +
  // the top bar). If the user left earlier via "Continue in background", the
  // modal is already gone and this never runs.
  useEffect(() => {
    if (step === 'syncing' && progress >= 100) {
      const t = setTimeout(() => onClose(), 700)
      return () => clearTimeout(t)
    }
  }, [step, progress, onClose])

  // The newest date available so far — grows from `start` toward `target` as
  // the back-to-front sync catches up.
  const availableEnd = sync
    ? new Date(sync.start.getTime() + (sync.target.getTime() - sync.start.getTime()) * (progress / 100))
    : new Date()

  const syncMessage =
    progress < 25
      ? `Fetching loads from ${tms?.name ?? 'your TMS'}…`
      : progress < 55
        ? `Pulling telematics from ${eld?.name ?? 'your ELD'}…`
        : progress < 85
          ? 'Matching cabins and computing lanes…'
          : 'Finishing up…'

  const idx = stepIndexOf(step)
  const back: Partial<Record<Step, Step>> = {
    'eld-cred': 'eld',
    tms: 'eld-cred',
    'tms-cred': 'tms',
    cabins: 'tms-cred',
    drivers: 'cabins',
    period: 'drivers',
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal cfm" onClick={(e) => e.stopPropagation()}>
        {step !== 'syncing' && (
          <>
            <div className="modal-head">
              {back[step] ? (
                <button className="cfm-back" onClick={() => setStep(back[step]!)} aria-label="Back">
                  <ArrowLeft size={18} />
                </button>
              ) : (
                <span style={{ width: 18 }} />
              )}
              <span className="cfm-title">Connect your fleet</span>
              <button className="cfm-x" onClick={onClose} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="cfm-steps">
              {STEP_LABELS.map((label, i) => (
                <div
                  key={label}
                  className={`cfm-step ${i === idx ? 'active' : ''} ${i < idx ? 'done' : ''}`}
                >
                  <span className="cfm-step-dot">{i < idx ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
                  <span className="cfm-step-label">{label}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ---------- Step 1: ELD provider ---------- */}
        {step === 'eld' && (
          <div className="modal-body">
            <p className="cfm-sub">Choose your electronic logging device provider to connect.</p>
            <div className="cfm-tms-grid one">
              {eldList.map((e) => (
                <button
                  key={e.name}
                  className="cfm-tms-card"
                  onClick={() => {
                    setEld(e)
                    setEldValues({})
                    setStep('eld-cred')
                  }}
                >
                  <span className="cfm-tms-logo">{e.mono}</span>
                  <span className="cfm-tms-name">{e.name}</span>
                  <ChevronRight size={15} className="cfm-card-arrow" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ---------- Step 1b: ELD credentials ---------- */}
        {step === 'eld-cred' && eld && (
          <div className="modal-body">
            <div className="cfm-cred-head">
              <span className="cfm-tms-logo sm">{eld.mono}</span>
              <span>Connect {eld.name}</span>
            </div>
            {eld.fields.map((f) => (
              <div className="field" key={f.key}>
                <label>{f.label}</label>
                <div className="field-input">
                  <input
                    type={f.secret ? 'password' : 'text'}
                    placeholder={f.placeholder}
                    value={eldValues[f.key] ?? ''}
                    onChange={(ev) => setEldValues((v) => ({ ...v, [f.key]: ev.target.value }))}
                  />
                </div>
                <span className="cfm-oblig">Required</span>
              </div>
            ))}
            <button
              className="cfm-primary"
              disabled={!eldComplete}
              onClick={() => {
                onConnectIntegration?.('eld', eld.name, eld.mono)
                setStep('tms')
              }}
            >
              Integrate ELD
            </button>
          </div>
        )}

        {/* ---------- Step 2: TMS provider ---------- */}
        {step === 'tms' && (
          <div className="modal-body">
            <p className="cfm-sub">Now connect your transportation management system.</p>
            <div className="tf-search">
              <Search size={15} color="var(--text-muted)" />
              <input
                placeholder="Search integrations"
                value={tmsQuery}
                onChange={(e) => setTmsQuery(e.target.value)}
              />
            </div>
            <div className="cfm-tms-grid">
              {tmsFiltered.map((t) => (
                <button
                  key={t.name}
                  className="cfm-tms-card"
                  onClick={() => {
                    setTms(t)
                    setTmsValues({})
                    setStep('tms-cred')
                  }}
                >
                  <span className="cfm-tms-logo">{t.mono}</span>
                  <span className="cfm-tms-name">{t.name}</span>
                  <ChevronRight size={15} className="cfm-card-arrow" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ---------- Step 2b: TMS credentials ---------- */}
        {step === 'tms-cred' && tms && (
          <div className="modal-body">
            <div className="cfm-cred-head">
              <span className="cfm-tms-logo sm">{tms.mono}</span>
              <span>Connect {tms.name}</span>
            </div>
            <p className="cfm-sub">Enter your {tms.name} credentials to sync trucks, lanes, and loads.</p>
            {tms.fields.map((f) => (
              <div className="field" key={f.key}>
                <label>{f.label}</label>
                <div className="field-input">
                  <input
                    type={f.secret ? 'password' : 'text'}
                    placeholder={f.placeholder}
                    value={tmsValues[f.key] ?? ''}
                    onChange={(e) => setTmsValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  />
                </div>
                {f.hintTemplate ? (
                  <span className="cfm-hint">
                    Your API URL: <b>{f.hintTemplate.replace('{v}', (tmsValues[f.key] || '[company]').trim() || '[company]')}</b>
                  </span>
                ) : (
                  <span className="cfm-oblig">Required</span>
                )}
              </div>
            ))}
            <button
              className="cfm-primary"
              disabled={!tmsComplete}
              onClick={() => {
                onConnectIntegration?.('tms', tms.name, tms.mono)
                setStep('cabins')
              }}
            >
              Connect TMS
            </button>
          </div>
        )}

        {/* ---------- Step 3: Link cabins ---------- */}
        {step === 'cabins' && (
          <>
            <div className="modal-body">
              <p className="cfm-sub">
                Select the cabins we found across your {eld?.name ?? 'ELD'} and {tms?.name ?? 'TMS'} to add
                to efRouting.
              </p>
              <div className="tf-search">
                <Search size={15} color="var(--text-muted)" />
                <input
                  placeholder="Search by ID or plate..."
                  value={cabinQuery}
                  onChange={(e) => setCabinQuery(e.target.value)}
                />
              </div>
              <div className="lc-bar">
                <span className="lc-count">
                  {selectedCabins.length} of {CABINS.length} selected
                </span>
                <button className="lc-selectall" onClick={toggleAllShown}>
                  {allShownSelected ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="tf-scroll lc-list">
                {cabinsFiltered.map((id) => {
                  const sel = selectedCabins.includes(id)
                  return (
                    <button key={id} className={`lc-row ${sel ? 'sel' : ''}`} onClick={() => toggleCabin(id)}>
                      <span className="lc-box">{sel && <Check size={13} strokeWidth={3} />}</span>
                      <span className="lc-id">{id}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn-text" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn-pill"
                disabled={selectedCabins.length === 0}
                onClick={() => setStep('drivers')}
              >
                Link units
              </button>
            </div>
          </>
        )}

        {/* ---------- Step 4: Drivers (read-only; all get integrated) ---------- */}
        {step === 'drivers' && (
          <>
            <div className="modal-body">
              <p className="cfm-sub">
                These {allDrivers.length} drivers were found across your {eld?.name ?? 'ELD'} and{' '}
                {tms?.name ?? 'TMS'}. They'll all be added to efRouting — add anyone we missed below.
              </p>
              <div className="tf-search">
                <Search size={15} color="var(--text-muted)" />
                <input
                  placeholder="Search driver..."
                  value={driverQuery}
                  onChange={(e) => setDriverQuery(e.target.value)}
                />
              </div>
              <div className="lc-bar">
                <span className="lc-count">{allDrivers.length} drivers will be integrated</span>
                <button className="lc-selectall" onClick={() => setAddingDriver((a) => !a)}>
                  <Plus size={13} /> Add driver
                </button>
              </div>
              {addingDriver && (
                <div className="cfm-addrow">
                  <input
                    autoFocus
                    placeholder="Driver full name"
                    value={newDriverName}
                    onChange={(e) => setNewDriverName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addManualDriver()}
                  />
                  <button className="cfm-addrow-btn" disabled={!newDriverName.trim()} onClick={addManualDriver}>
                    Add
                  </button>
                </div>
              )}
              <div className="tf-scroll lc-list">
                {driversFiltered.map((d) => (
                  <div key={d.id} className="lc-row static">
                    <UserPlus size={14} className="lc-drv-icon" />
                    <span className="lc-id">{d.name}</span>
                    {d.manual && <span className="cfm-new-chip">Added</span>}
                    {d.manual && (
                      <button
                        className="lc-undo"
                        onClick={() => removeManualDriver(d.id)}
                        aria-label={`Remove ${d.name}`}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn-text" onClick={onClose}>
                Cancel
              </button>
              <button className="btn-pill" onClick={() => setStep('period')}>
                Continue
              </button>
            </div>
          </>
        )}

        {/* ---------- Step 5: Data range ---------- */}
        {step === 'period' && (
          <>
            <div className="modal-body cfm-period">
              <p className="cfm-sub">
                How much history should we pull to build your operation? We'll sync and process this
                range across every linked cabin.
              </p>
              <div className="field">
                <label>Data range</label>
                <div className="cfm-select">
                  <button className="cfm-select-trigger" onClick={() => setRangeOpen((o) => !o)}>
                    <span>{PERIODS.find((p) => p.key === range)?.label}</span>
                    <ChevronDown size={16} className="chev" />
                  </button>
                  {rangeOpen && (
                    <>
                      <div className="cfm-select-backdrop" onClick={() => setRangeOpen(false)} />
                      <div className="cfm-select-menu">
                        {PERIODS.map((p) => (
                          <button
                            key={p.key}
                            className={`cfm-select-opt ${range === p.key ? 'active' : ''}`}
                            onClick={() => {
                              setRange(p.key)
                              setRangeOpen(false)
                            }}
                          >
                            {p.label}
                            {range === p.key && <Check size={15} />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn-text" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn-pill"
                onClick={() => {
                  onStartSync?.(selectedCabins, DRIVER_POOL.map((d) => d.id), range, manualDrivers)
                  setStep('syncing')
                }}
              >
                Start sync
              </button>
            </div>
          </>
        )}

        {/* ---------- Syncing (live; leavable) ---------- */}
        {step === 'syncing' && (
          <div className="modal-body cfm-center cfm-sync">
            <h3 className="cfm-status-title">Syncing your operation</h3>
            <p className="cfm-status-sub">{syncMessage}</p>
            <div className="cfm-progress">
              <div className="cfm-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="cfm-progress-pct">{Math.round(progress)}%</span>
            {sync && (
              <p className="cfm-sync-range">
                We sync oldest → newest, so your dashboard already has data from{' '}
                <b>{money2(sync.start)}</b> through <b>{money2(availableEnd)}</b>.
              </p>
            )}
            <button className="cfm-go" onClick={onClose}>
              Continue in background
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
