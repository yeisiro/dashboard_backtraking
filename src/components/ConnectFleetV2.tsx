import { useEffect, useMemo, useState } from 'react'
import {
  X, ArrowLeft, ChevronRight, ChevronDown, Search, Check, Plus, UserPlus,
  Clock, HelpCircle, ShieldCheck, CreditCard, Fuel, Receipt, ClipboardCheck,
} from 'lucide-react'
import { CredentialsForm, UnsupportedForm } from './IntegrationForms'
import { AddCabForm, AddTrailerForm, AddDriverForm } from './EquipmentForms'
import {
  CABIN_POOL, DRIVER_POOL, TRAILER_POOL, SYNC_PERIODS, ELD_PROVIDERS, TMS_PROVIDERS, SUPPORTED_ELD,
  SUPPORTED_TMS, FUEL_CARD_CATALOG, labelForPeriod,
  type PeriodKey, type Provider, type FleetDriver, type OnboardingState, type OnboardingRequest,
  type RequestType,
  type OnboardingGap,
  ONBOARDING_LOSS,
} from '../data'
import type { SyncState } from './ConnectFleetModal'

// V2 onboarding wizard. Asks only for the minimum needed to start syncing —
// ELD, TMS, fleet (cabins, drivers, trailers), data range and fuel card — in
// that order, then a review that offers fuel transactions as an optional
// accuracy boost. Progress lives in App (`ob`), so closing the modal never
// loses it and reopening resumes at the first pending step. Anything that
// isn't self-serve (unsupported ELD/TMS, custom fuel card, efRouting card,
// transactions) becomes a request the efRouting team processes.
type Step =
  | 'eld' | 'eld-cred' | 'eld-other'
  | 'tms' | 'tms-cred' | 'tms-other'
  | 'fleet' | 'add-cab' | 'add-trailer' | 'add-driver' | 'range'
  | 'fuel' | 'fuel-add' | 'fuel-privacy' | 'fuel-custom'
  | 'review' | 'syncing'

type SourceType = 'eld' | 'tms'
type FleetTab = 'cabins' | 'drivers' | 'trailers'

const eldList = ELD_PROVIDERS.filter((p) => SUPPORTED_ELD.includes(p.name))
const tmsList = TMS_PROVIDERS.filter((p) => SUPPORTED_TMS.includes(p.name))
const STEP_LABELS = ['ELD', 'TMS', 'Fleet', 'Data range', 'Fuel card', 'Review']

function stepIndexOf(step: Step): number {
  if (step.startsWith('eld')) return 0
  if (step.startsWith('tms')) return 1
  if (step === 'fleet' || step.startsWith('add-')) return 2
  if (step === 'range') return 3
  if (step.startsWith('fuel')) return 4
  return 5
}

// Where to reopen the wizard: the first minimum that isn't covered yet.
// Where the setup guide (V3) can open the wizard.
export type WizardTarget = 'eld' | 'tms' | 'fleet' | 'range' | 'fuel' | 'review'

function firstPendingStep(ob: OnboardingState): Step {
  if (!ob.eld) return 'eld'
  if (!ob.tms) return 'tms'
  if (!ob.fleetDone) return 'fleet'
  if (!ob.range) return 'range'
  if (!ob.fuelCard) return 'fuel'
  return 'review'
}

const BACK: Partial<Record<Step, Step>> = {
  'eld-cred': 'eld',
  'eld-other': 'eld',
  tms: 'eld',
  'tms-cred': 'tms',
  'tms-other': 'tms',
  fleet: 'tms',
  'add-cab': 'fleet',
  'add-trailer': 'fleet',
  'add-driver': 'fleet',
  range: 'fleet',
  fuel: 'range',
  'fuel-add': 'fuel',
  'fuel-privacy': 'fuel-add',
  'fuel-custom': 'fuel-privacy',
  review: 'fuel',
}

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2) || '?'

const shortDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

interface Props {
  ob: OnboardingState
  onChange: (patch: Partial<OnboardingState>) => void
  requests: OnboardingRequest[]
  onRequest: (type: RequestType, detail: string) => void
  onConnectIntegration?: (type: SourceType, name: string, mono: string, label?: string) => void
  onStartSync: () => void
  sync?: SyncState | null
  onClose: () => void
  // V3: integration-terms consent, "what you'll miss" on pending items, and
  // opening straight at a step from the setup guide.
  v3?: boolean
  initialStep?: WizardTarget
}

export default function ConnectFleetV2({
  ob,
  onChange,
  requests,
  onRequest,
  onConnectIntegration,
  onStartSync,
  sync,
  onClose,
  v3 = false,
  initialStep,
}: Props) {
  const [step, setStep] = useState<Step>(() => initialStep ?? firstPendingStep(ob))
  // V3: consent to be contacted for a custom fuel card.
  const [cardConsent, setCardConsent] = useState(false)

  // Provider being connected (credentials themselves are never persisted —
  // only the resulting connection is), and the prefill for the "not listed" form.
  const [provider, setProvider] = useState<Provider | null>(null)
  const [otherPrefill, setOtherPrefill] = useState('')

  // Fleet step.
  const [fleetTab, setFleetTab] = useState<FleetTab>('cabins')
  const [query, setQuery] = useState('')

  // Data range (committed to `ob` on Continue).
  const [range, setRange] = useState<PeriodKey>(ob.range ?? '3m')
  const [rangeOpen, setRangeOpen] = useState(false)

  // Custom fuel card request.
  const [cardProvider, setCardProvider] = useState('')
  const [cardDetails, setCardDetails] = useState('')
  const [upsellHidden, setUpsellHidden] = useState(false)

  const progress = sync?.progress ?? 0
  const sourceOf = (t: SourceType) => (t === 'eld' ? ob.eld : ob.tms)
  const pendingRequest = (type: RequestType) =>
    requests.some((r) => r.type === type && r.status !== 'resolved')

  // Close shortly after the sync completes (App keeps the toast + top bar).
  useEffect(() => {
    if (step === 'syncing' && progress >= 100) {
      const t = setTimeout(() => onClose(), 700)
      return () => clearTimeout(t)
    }
  }, [step, progress, onClose])

  // ---------- ELD / TMS ----------
  const openCredentials = (type: SourceType, p: Provider) => {
    setProvider(p)
    setStep(type === 'eld' ? 'eld-cred' : 'tms-cred')
  }

  // Credentials passed validation (see IntegrationForms).
  const connected = (type: SourceType, label: string) => {
    if (!provider) return
    onConnectIntegration?.(type, provider.name, provider.mono, label)
    const src = { status: 'connected' as const, name: provider.name, mono: provider.mono, label }
    onChange(type === 'eld' ? { eld: src } : { tms: src })
    setStep(type === 'eld' ? 'tms' : 'fleet')
  }

  const openOther = (type: SourceType, prefill = '') => {
    setOtherPrefill(prefill)
    setStep(type === 'eld' ? 'eld-other' : 'tms-other')
  }

  const sendOther = (type: SourceType, name: string) => {
    onRequest(type, name)
    const src = { status: 'unsupported' as const, name, mono: initials(name) }
    onChange(type === 'eld' ? { eld: src } : { tms: src })
    setStep(type === 'eld' ? 'tms' : 'fleet')
  }

  // ---------- Fleet ----------
  const sourcesText = (() => {
    const names = [ob.eld, ob.tms].filter((s) => s?.status === 'connected').map((s) => s!.name)
    return names.length ? names.join(' and ') : null
  })()
  // Units discovered across the connected sources, plus anything created by
  // hand (same forms as My Company). Without a connected ELD/TMS, manual
  // creation is how the org builds its fleet.
  const cabinPool = [...ob.manualCabins.map((c) => c.name), ...(sourcesText ? CABIN_POOL : [])]
  const trailerPool = [...ob.manualTrailers.map((t) => t.name), ...(sourcesText ? TRAILER_POOL : [])]
  const manualCabNames = new Set(ob.manualCabins.map((c) => c.name))
  const manualTrailerNames = new Set(ob.manualTrailers.map((t) => t.name))
  const allDrivers: (FleetDriver & { manual: boolean })[] = useMemo(
    () => [
      ...ob.manualDrivers.map((d) => ({ ...d, manual: true })),
      ...(sourcesText ? DRIVER_POOL.map((d) => ({ ...d, manual: false })) : []),
    ],
    [ob.manualDrivers, sourcesText],
  )
  const q = query.toLowerCase()
  const cabinsShown = cabinPool.filter((c) => c.toLowerCase().includes(q))
  const trailersShown = trailerPool.filter((t) => t.toLowerCase().includes(q))
  const driversShown = allDrivers.filter((d) => d.name.toLowerCase().includes(q))

  const toggleIn = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  const allSelected = (shown: string[], sel: string[]) => shown.length > 0 && shown.every((x) => sel.includes(x))
  const toggleAll = (shown: string[], sel: string[]) =>
    allSelected(shown, sel) ? sel.filter((x) => !shown.includes(x)) : [...new Set([...sel, ...shown])]

  const removeManual = (key: 'cabins' | 'trailers', name: string) =>
    onChange(
      key === 'cabins'
        ? { manualCabins: ob.manualCabins.filter((c) => c.name !== name), cabins: ob.cabins.filter((x) => x !== name) }
        : {
            manualTrailers: ob.manualTrailers.filter((t) => t.name !== name),
            trailers: ob.trailers.filter((x) => x !== name),
          },
    )

  // ---------- Fuel card ----------
  const requestEfRoutingCard = () => {
    if (!ob.efroutingCardRequested) onRequest('efrouting-card', 'efRouting Fuel Card')
    onChange({ efroutingCardRequested: true, fuelCard: { kind: 'catalog', name: 'efRouting' } })
  }
  const sendCustomCard = () => {
    const name = cardProvider.trim()
    if (!name) return
    onRequest('fuel-card', cardDetails.trim() ? `${name} — ${cardDetails.trim()}` : name)
    onChange({ fuelCard: { kind: 'custom', provider: name } })
    setCardProvider('')
    setCardDetails('')
    setStep('fuel')
  }

  // ---------- Review ----------
  const eldBlocked = ob.eld?.status === 'unsupported'
  const missing = [
    !ob.eld && 'ELD',
    !ob.tms && 'TMS',
    !ob.fleetDone && 'Fleet',
    !ob.range && 'Data range',
    !ob.fuelCard && 'Fuel card',
  ].filter(Boolean) as string[]
  const canSync = missing.length === 0 && !eldBlocked

  const syncMessage =
    progress < 25
      ? ob.tms?.status === 'connected'
        ? `Fetching loads from ${ob.tms.name}…`
        : 'Preparing your operation…'
      : progress < 55
        ? `Pulling telematics from ${ob.eld?.name ?? 'your ELD'}…`
        : progress < 85
          ? 'Matching cabins, trailers and computing lanes…'
          : 'Finishing up…'
  const availableEnd = sync
    ? new Date(sync.start.getTime() + (sync.target.getTime() - sync.start.getTime()) * (progress / 100))
    : new Date()

  const idx = stepIndexOf(step)

  // ---------- Shared bits ----------
  const sourcePicker = (type: SourceType) => {
    const list = type === 'eld' ? eldList : tmsList
    const current = sourceOf(type)
    return (
      <>
        <div className="modal-body">
          <p className="cfm-sub">
            {type === 'eld'
              ? 'Connect your ELD so we can read your operation: trucks, drivers, trailers, miles and hours.'
              : 'Connect your TMS so we can bring in your loads and revenue.'}
          </p>
          <div className="cfm-tms-grid one">
            {list.map((p) => {
              const isCurrent = current?.status === 'connected' && current.name === p.name
              return (
                <button
                  key={p.name}
                  className={`cfm-tms-card ${isCurrent ? 'connected' : ''}`}
                  onClick={() => openCredentials(type, p)}
                >
                  <span className="cfm-tms-logo">{p.mono}</span>
                  <span className="cfm-tms-name">{p.name}</span>
                  {isCurrent ? (
                    <span className="cfm-conn-badge">
                      <Check size={11} strokeWidth={3} /> Connected
                    </span>
                  ) : (
                    <ChevronRight size={15} className="cfm-card-arrow" />
                  )}
                </button>
              )
            })}
            {current?.status === 'unsupported' && (
              <div className="cfm-tms-card pending">
                <span className="cfm-tms-logo">{current.mono}</span>
                <span className="cfm-tms-name">{current.name}</span>
                <span className="cfm-req-badge">Request sent</span>
              </div>
            )}
          </div>
          <button className="cfm-notlisted" onClick={() => openOther(type)}>
            <HelpCircle size={15} />
            My {type === 'eld' ? 'ELD' : 'TMS'} isn&apos;t listed
          </button>
        </div>
        {current && (
          <div className="modal-foot">
            <button className="btn-text" onClick={onClose}>
              Close
            </button>
            <button className="btn-pill" onClick={() => setStep(type === 'eld' ? 'tms' : 'fleet')}>
              Continue
            </button>
          </div>
        )}
      </>
    )
  }

  const credentialsForm = (type: SourceType) =>
    provider && (
      <div className="modal-body">
        <CredentialsForm
          key={provider.name}
          type={type}
          provider={provider}
          onConnected={(label) => connected(type, label)}
          onAskHelp={(name) => openOther(type, name)}
          requireConsent={v3}
        />
      </div>
    )

  const otherForm = (type: SourceType) => (
    <div className="modal-body">
      <UnsupportedForm
        key={otherPrefill}
        type={type}
        prefill={otherPrefill}
        note={
          type === 'eld'
            ? "We'll set up the connection for you and let you know when it's ready. Until then you'll keep seeing sample data, since your operation is read from the ELD."
            : "You can keep going: we'll sync your operation from your ELD now, and add your loads and revenue as soon as your TMS is connected."
        }
        onSubmit={(name) => sendOther(type, name)}
      />
    </div>
  )

  const setList = (key: 'cabins' | 'trailers', next: string[]) =>
    onChange(key === 'cabins' ? { cabins: next } : { trailers: next })

  const selectList = (shown: string[], sel: string[], key: 'cabins' | 'trailers', total: number) => {
    const manual = key === 'cabins' ? manualCabNames : manualTrailerNames
    const noun = key === 'cabins' ? 'cab' : 'trailer'
    return (
      <>
        <div className="lc-bar">
          <span className="lc-count">
            {sel.length} of {total} selected
          </span>
          <span className="lc-actions">
            {shown.length > 0 && (
              <button className="lc-selectall" onClick={() => setList(key, toggleAll(shown, sel))}>
                {allSelected(shown, sel) ? 'Deselect all' : 'Select all'}
              </button>
            )}
            <button className="lc-selectall" onClick={() => setStep(key === 'cabins' ? 'add-cab' : 'add-trailer')}>
              <Plus size={13} /> Add {noun}
            </button>
          </span>
        </div>
        {total === 0 ? (
          <p className="mf-empty">
            No {key} yet. Add your {key} manually — you can link them to your ELD later.
          </p>
        ) : (
          <div className="tf-scroll lc-list">
            {shown.map((id) => {
              const on = sel.includes(id)
              return (
                <div key={id} className={`lc-row ${on ? 'sel' : ''}`} onClick={() => setList(key, toggleIn(sel, id))}>
                  <span className="lc-box">{on && <Check size={13} strokeWidth={3} />}</span>
                  <span className="lc-id">{id}</span>
                  {manual.has(id) && <span className="cfm-new-chip">Added</span>}
                  {manual.has(id) && (
                    <button
                      className="lc-undo"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeManual(key, id)
                      }}
                      aria-label={`Remove ${id}`}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </>
    )
  }

  // A row in the review checklist.
  const reviewRow = (
    title: string,
    value: string | null,
    tone: 'ok' | 'warn' | 'err' | 'missing',
    note: string | null,
    edit: Step,
    gap?: OnboardingGap,
  ) => (
    <div className={`cfm-rv-row ${tone}`} key={title}>
      <span className="cfm-rv-ico">
        {tone === 'ok' ? <Check size={13} strokeWidth={3} /> : tone === 'missing' ? '!' : <Clock size={12} />}
      </span>
      <div className="cfm-rv-main">
        <span className="cfm-rv-title">{title}</span>
        <span className="cfm-rv-value">{value ?? 'Not completed'}</span>
        {note && <span className="cfm-rv-note">{note}</span>}
        {v3 && gap && (
          <span className="cfm-rv-miss">
            <b>What you&apos;ll miss:</b> {ONBOARDING_LOSS[gap].loss}
          </span>
        )}
      </div>
      <button className="cfm-rv-edit" onClick={() => setStep(edit)}>
        {tone === 'missing' ? 'Complete' : 'Edit'}
      </button>
    </div>
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal cfm cfm2" onClick={(e) => e.stopPropagation()}>
        {step !== 'syncing' && (
          <>
            <div className="modal-head">
              {BACK[step] ? (
                <button className="cfm-back" onClick={() => setStep(BACK[step]!)} aria-label="Back">
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
              {STEP_LABELS.map((l, i) => (
                <div key={l} className={`cfm-step ${i === idx ? 'active' : ''} ${i < idx ? 'done' : ''}`}>
                  <span className="cfm-step-dot">{i < idx ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
                  <span className="cfm-step-label">{l}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {step === 'eld' && sourcePicker('eld')}
        {step === 'eld-cred' && credentialsForm('eld')}
        {step === 'eld-other' && otherForm('eld')}
        {step === 'tms' && sourcePicker('tms')}
        {step === 'tms-cred' && credentialsForm('tms')}
        {step === 'tms-other' && otherForm('tms')}

        {/* ---------- Fleet: cabins, drivers, trailers ---------- */}
        {step === 'fleet' && (
          <>
            <div className="modal-body">
              <p className="cfm-sub">
                {sourcesText
                  ? `Choose the part of your fleet to analyze. We found these units in ${sourcesText} — add any that are missing.`
                  : "We can't read your units yet because your ELD and TMS aren't connected. Add your cabins, drivers and trailers manually to continue."}
              </p>
              <div className="cfm-fleet-tabs">
                {(
                  [
                    ['cabins', 'Cabins', ob.cabins.length],
                    ['drivers', 'Drivers', allDrivers.length],
                    ['trailers', 'Trailers', ob.trailers.length],
                  ] as [FleetTab, string, number][]
                ).map(([k, l, n]) => (
                  <button
                    key={k}
                    className={`mf-tab ${fleetTab === k ? 'active' : ''}`}
                    onClick={() => {
                      setFleetTab(k)
                      setQuery('')
                    }}
                  >
                    {l} <span className="mf-tab-count">{n}</span>
                  </button>
                ))}
              </div>
              {(fleetTab === 'cabins' ? cabinPool : fleetTab === 'trailers' ? trailerPool : allDrivers).length > 0 && (
                <div className="tf-search">
                  <Search size={15} color="var(--text-muted)" />
                  <input
                    placeholder={fleetTab === 'drivers' ? 'Search driver...' : 'Search by ID or plate...'}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              )}
              {fleetTab === 'cabins' && selectList(cabinsShown, ob.cabins, 'cabins', cabinPool.length)}
              {fleetTab === 'trailers' && selectList(trailersShown, ob.trailers, 'trailers', trailerPool.length)}
              {fleetTab === 'drivers' && (
                <>
                  <div className="lc-bar">
                    <span className="lc-count">{allDrivers.length} drivers will be integrated</span>
                    <button className="lc-selectall" onClick={() => setStep('add-driver')}>
                      <Plus size={13} /> Add driver
                    </button>
                  </div>
                  {allDrivers.length === 0 ? (
                    <p className="mf-empty">No drivers yet. Invite your drivers by email.</p>
                  ) : (
                    <div className="tf-scroll lc-list">
                      {driversShown.map((d) => (
                        <div key={d.id} className="lc-row static">
                          <UserPlus size={14} className="lc-drv-icon" />
                          <span className="lc-id">{d.name}</span>
                          {d.manual && <span className="cfm-new-chip">Invited</span>}
                          {d.manual && (
                            <button
                              className="lc-undo"
                              onClick={() => onChange({ manualDrivers: ob.manualDrivers.filter((m) => m.id !== d.id) })}
                              aria-label={`Remove ${d.name}`}
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-foot">
              {ob.cabins.length === 0 ? (
                <span className="cfm-foot-msg">
                  {cabinPool.length ? 'Select at least one cabin to continue' : 'Add at least one cabin to continue'}
                </span>
              ) : (
                <button className="btn-text" onClick={onClose}>
                  Close
                </button>
              )}
              <button
                className="btn-pill"
                disabled={ob.cabins.length === 0}
                onClick={() => {
                  onChange({ fleetDone: true })
                  setStep('range')
                }}
              >
                Continue
              </button>
            </div>
          </>
        )}

        {/* ---------- Manual equipment / drivers (same forms as My Company) ---------- */}
        {step === 'add-cab' && (
          <div className="modal-body">
            <AddCabForm
              takenNames={cabinPool}
              onCancel={() => setStep('fleet')}
              onAdd={(cab) => {
                onChange({ manualCabins: [...ob.manualCabins, cab], cabins: [...ob.cabins, cab.name] })
                setFleetTab('cabins')
                setStep('fleet')
              }}
            />
          </div>
        )}
        {step === 'add-trailer' && (
          <div className="modal-body">
            <AddTrailerForm
              takenNames={trailerPool}
              onCancel={() => setStep('fleet')}
              onAdd={(t) => {
                onChange({ manualTrailers: [...ob.manualTrailers, t], trailers: [...ob.trailers, t.name] })
                setFleetTab('trailers')
                setStep('fleet')
              }}
            />
          </div>
        )}
        {step === 'add-driver' && (
          <div className="modal-body">
            <AddDriverForm
              takenEmails={ob.manualDrivers.map((d) => d.name)}
              onCancel={() => setStep('fleet')}
              onAdd={({ email }) => {
                onChange({ manualDrivers: [...ob.manualDrivers, { id: `DRV-NEW-${Date.now()}`, name: email }] })
                setFleetTab('drivers')
                setStep('fleet')
              }}
            />
          </div>
        )}

        {/* ---------- Data range ---------- */}
        {step === 'range' && (
          <>
            <div className="modal-body cfm-period">
              <p className="cfm-sub">
                How much history should we pull to build your operation? More history takes longer to sync, and
                you can always add more later from Manage Fleet.
              </p>
              <div className="field">
                <label>Data range</label>
                <div className="cfm-select">
                  <button className="cfm-select-trigger" onClick={() => setRangeOpen((o) => !o)}>
                    <span>{SYNC_PERIODS.find((p) => p.key === range)?.label}</span>
                    <ChevronDown size={16} className="chev" />
                  </button>
                  {rangeOpen && (
                    <>
                      <div className="cfm-select-backdrop" onClick={() => setRangeOpen(false)} />
                      <div className="cfm-select-menu">
                        {SYNC_PERIODS.map((p) => (
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
                Close
              </button>
              <button
                className="btn-pill"
                onClick={() => {
                  onChange({ range })
                  setStep('fuel')
                }}
              >
                Continue
              </button>
            </div>
          </>
        )}

        {/* ---------- Fuel card: pick one or request one ---------- */}
        {step === 'fuel' && (
          <>
            <div className="modal-body">
              <p className="cfm-sub">
                Which fuel card does your fleet use? We calculate your fuel savings and leakage with its stations and
                discounts.
              </p>
              <div className="cfm-fc-list">
                {FUEL_CARD_CATALOG.map((c) => {
                  const on = ob.fuelCard?.kind === 'catalog' && ob.fuelCard.name === c.name
                  return (
                    <button
                      key={c.name}
                      className={`cfm-fc-row ${on ? 'sel' : ''}`}
                      onClick={() => onChange({ fuelCard: { kind: 'catalog', name: c.name } })}
                    >
                      <span className={`cfm-radio ${on ? 'on' : ''}`} />
                      <span className="cfm-tms-logo sm">{c.mono}</span>
                      <span className="cfm-fc-main">
                        <span className="cfm-fc-name">
                          {c.name}
                          {c.name === 'efRouting' && ob.efroutingCardRequested && (
                            <span className="cfm-req-badge">Card requested</span>
                          )}
                        </span>
                        <span className="cfm-fc-note">{c.note}</span>
                      </span>
                    </button>
                  )
                })}
                {ob.fuelCard?.kind === 'custom' && (
                  <div className="cfm-fc-row sel custom">
                    <span className="cfm-radio on" />
                    <span className="cfm-tms-logo sm">{initials(ob.fuelCard.provider)}</span>
                    <span className="cfm-fc-main">
                      <span className="cfm-fc-name">
                        {ob.fuelCard.provider} <span className="cfm-req-badge">Request sent</span>
                      </span>
                      <span className="cfm-fc-note">
                        We&apos;re setting up your card. Meanwhile we use the efRouting fuel card.
                      </span>
                    </span>
                  </div>
                )}
                <button className="cfm-fc-add" onClick={() => setStep('fuel-add')}>
                  <Plus size={15} /> Add new fuel card
                </button>
              </div>
              {!upsellHidden && !ob.efroutingCardRequested && (
                <div className="cfm-upsell">
                  <span className="cfm-upsell-ico">
                    <CreditCard size={17} />
                  </span>
                  <div className="cfm-upsell-main">
                    <span className="cfm-upsell-title">
                      Save up to <b>$0.80/gal</b> with the efRouting Fuel Card
                    </span>
                    <span className="cfm-upsell-sub">Exclusive discounts at 20,000+ stations across the US</span>
                    <button className="cfm-upsell-cta" onClick={requestEfRoutingCard}>
                      Request your card <ChevronRight size={14} />
                    </button>
                  </div>
                  <button className="cfm-upsell-x" onClick={() => setUpsellHidden(true)} aria-label="Dismiss">
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
            <div className="modal-foot">
              <button className="btn-text" onClick={onClose}>
                Close
              </button>
              <button className="btn-pill" disabled={!ob.fuelCard} onClick={() => setStep('review')}>
                Continue
              </button>
            </div>
          </>
        )}

        {step === 'fuel-add' && (
          <div className="modal-body">
            <p className="cfm-sub">You can request a new fuel card with efRouting or add your existing fuel card.</p>
            <button
              className="cfm-option"
              onClick={() => {
                requestEfRoutingCard()
                setStep('fuel')
              }}
            >
              <span className="cfm-option-icon blue">
                <Fuel size={19} />
              </span>
              <span className="cfm-option-main">
                <span className="cfm-option-title">Request efRouting Fuel Card</span>
                <span className="cfm-option-tag">Get a fuel card provided by efRouting</span>
              </span>
            </button>
            <button className="cfm-option" onClick={() => setStep('fuel-privacy')}>
              <span className="cfm-option-icon">
                <Plus size={19} />
              </span>
              <span className="cfm-option-main">
                <span className="cfm-option-title">Add your existing fuel card</span>
                <span className="cfm-option-tag">Submit your current fuel card details</span>
              </span>
            </button>
          </div>
        )}

        {step === 'fuel-privacy' && (
          <div className="modal-body">
            <div className="cfm-privacy-head">
              <ShieldCheck size={22} />
              <span>We value your privacy and security</span>
            </div>
            <div className="cfm-privacy-item">
              <Check size={15} strokeWidth={3} />
              <div>
                <b>No sensitive information required</b>
                <span>We will never ask for your card number, CVV, PIN or any confidential card details.</span>
              </div>
            </div>
            <div className="cfm-privacy-item">
              <Check size={15} strokeWidth={3} />
              <div>
                <b>What we need</b>
                <span>
                  Only your fuel card provider name and any account details that help us optimize your fuel
                  savings.
                </span>
              </div>
            </div>
            <button className="cfm-primary" onClick={() => setStep('fuel-custom')}>
              I understand, continue
            </button>
          </div>
        )}

        {step === 'fuel-custom' && (
          <div className="modal-body">
            <p className="cfm-sub">
              We&apos;ll contact you to get the stations and discounts your card gives you access to. Meanwhile we
              use the efRouting fuel card, so your fuel analysis never runs without a network.
            </p>
            <div className="field">
              <label>Fuel card provider</label>
              <div className="field-input">
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. Pilot, TA Petro, Comdata…"
                  value={cardProvider}
                  onChange={(e) => setCardProvider(e.target.value)}
                />
              </div>
              <span className="cfm-oblig">Required</span>
            </div>
            <div className="field">
              <label>Account details (optional)</label>
              <textarea
                className="cfm-textarea"
                placeholder="Anything that helps us set it up — e.g. your account manager or program name"
                value={cardDetails}
                onChange={(e) => setCardDetails(e.target.value)}
              />
            </div>
            {v3 && (
              <label className="it-consent-row">
                <input type="checkbox" checked={cardConsent} onChange={(e) => setCardConsent(e.target.checked)} />
                <span>
                  I agree that efRouting may contact me and my fuel card provider to set up my card&apos;s stations
                  and discounts.
                </span>
              </label>
            )}
            <button
              className="cfm-primary"
              disabled={!cardProvider.trim() || (v3 && !cardConsent)}
              onClick={sendCustomCard}
            >
              Send request
            </button>
          </div>
        )}

        {/* ---------- Review ---------- */}
        {step === 'review' && (
          <>
            <div className="modal-body">
              <p className="cfm-sub">Here&apos;s what we&apos;ll use to build your operation.</p>
              <div className="cfm-rv">
                {reviewRow(
                  'ELD',
                  ob.eld ? ob.eld.name : null,
                  !ob.eld ? 'missing' : ob.eld.status === 'connected' ? 'ok' : 'err',
                  ob.eld?.status === 'unsupported'
                    ? "Request sent. We can't sync until your ELD is connected — we'll let you know when it's ready."
                    : null,
                  'eld',
                  ob.eld?.status === 'unsupported' ? 'eld-pending' : undefined,
                )}
                {reviewRow(
                  'TMS',
                  ob.tms ? ob.tms.name : null,
                  !ob.tms ? 'missing' : ob.tms.status === 'connected' ? 'ok' : 'warn',
                  ob.tms?.status === 'unsupported'
                    ? 'Request sent. We sync from your ELD now and add loads and revenue once your TMS is connected.'
                    : null,
                  'tms',
                  ob.tms?.status === 'unsupported' ? 'tms-pending' : undefined,
                )}
                {reviewRow(
                  'Fleet',
                  ob.fleetDone
                    ? [
                        [ob.cabins.length, 'cabin'],
                        [allDrivers.length, 'driver'],
                        [ob.trailers.length, 'trailer'],
                      ]
                        .map(([n, w]) => `${n} ${w}${n === 1 ? '' : 's'}`)
                        .join(' · ')
                    : null,
                  ob.fleetDone ? 'ok' : 'missing',
                  null,
                  'fleet',
                )}
                {reviewRow('Data range', ob.range ? labelForPeriod(ob.range) : null, ob.range ? 'ok' : 'missing', null, 'range')}
                {reviewRow(
                  'Fuel card',
                  !ob.fuelCard
                    ? null
                    : ob.fuelCard.kind === 'catalog'
                      ? ob.fuelCard.name
                      : `efRouting (temporary) · ${ob.fuelCard.provider} requested`,
                  !ob.fuelCard ? 'missing' : ob.fuelCard.kind === 'catalog' ? 'ok' : 'warn',
                  ob.fuelCard?.kind === 'custom' ? "We'll switch to your card as soon as it's set up." : null,
                  'fuel',
                  ob.fuelCard?.kind === 'custom' ? 'fuelcard-pending' : undefined,
                )}
              </div>

              <div className="cfm-tx">
                <span className="cfm-tx-ico">
                  <Receipt size={17} />
                </span>
                <div className="cfm-tx-main">
                  <span className="cfm-tx-title">Get the most accurate fuel numbers</span>
                  <span className="cfm-tx-body">
                    We estimate your fuel consumption and spend from your ELD with ~95% accuracy. Share your fuel
                    transaction records and we&apos;ll use them as the source for your fuel spend and overspend.
                  </span>
                  {ob.transactionsContact || pendingRequest('transactions') ? (
                    <span className="cfm-tx-done">
                      <Check size={13} strokeWidth={3} /> We&apos;ll reach out to coordinate it with you
                    </span>
                  ) : (
                    <>
                    {v3 && (
                      <span className="cfm-rv-miss">
                        <b>If you skip it:</b> {ONBOARDING_LOSS.transactions.loss}
                      </span>
                    )}
                    <button
                      className="cfm-tx-cta"
                      onClick={() => {
                        onRequest('transactions', 'Share fuel transactions')
                        onChange({ transactionsContact: true })
                      }}
                    >
                      Contact me to set this up
                    </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-foot">
              {missing.length > 0 ? (
                <span className="cfm-foot-msg">Complete {missing.join(', ')} to start syncing</span>
              ) : eldBlocked ? (
                <span className="cfm-foot-msg">We&apos;ll start syncing once your ELD is connected</span>
              ) : (
                <button className="btn-text" onClick={onClose}>
                  Close
                </button>
              )}
              {eldBlocked && missing.length === 0 ? (
                <button className="btn-pill" onClick={onClose}>
                  Done
                </button>
              ) : (
                <button
                  className="btn-pill"
                  disabled={!canSync}
                  onClick={() => {
                    onStartSync()
                    setStep('syncing')
                  }}
                >
                  <ClipboardCheck size={15} /> Start sync
                </button>
              )}
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
                We sync oldest → newest, so your dashboard already has data from <b>{shortDate(sync.start)}</b>{' '}
                through <b>{shortDate(availableEnd)}</b>.
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
