import { useState, type ReactNode } from 'react'
import {
  Users,
  Truck,
  Search,
  Plus,
  Copy,
  Pencil,
  Mail,
  Phone,
  Share2,
  FileText,
  Upload,
  Package,
  Container,
  User,
  Bell,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Fuel,
  Receipt,
  Cable,
  Clock,
  Check,
  X,
  CreditCard,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react'
import { AddCabForm, AddTrailerForm, AddDriverForm } from './EquipmentForms'
import type { WizardTarget } from './ConnectFleetV2'
import type { SignupAccount } from './SignupV3'
import {
  FUEL_CARD_CATALOG,
  ONBOARDING_LOSS,
  type FleetCabin,
  type FleetDriver,
  type OnboardingGap,
  type OnboardingRequest,
  type OnboardingState,
  type RequestType,
} from '../data'

// V3 · My Company, modeled on production (efdata.efrouting.com/home/my-company,
// recorded 2026-11-12) and wired to the same onboarding state as Connect Fleet,
// so whatever the org did in the wizard shows up here and vice versa:
//  · Integrations: ELD / TMS status from the wizard (connected, request sent,
//    not connected). Before the sync, "Set up" reopens the wizard at that step;
//    after it, "Manage" opens Manage Fleet at the matching tab.
//  · Fleet data, Employee accounts and Equipment list what was linked, plus
//    anything created by hand — with the same forms as the wizard.
//  · Fuel cards: production's "Add fuel cards" modal, but one active card (as
//    in the wizard) and the same requests (custom card / efRouting card).
//  · New: "Setup requests" — where the org follows every request (fuel
//    transactions included) after the setup guide is closed.

export type CompanyManageTab = 'integrations' | 'cabins' | 'drivers' | 'trailers'

const fmtShort = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const initials = (s: string) =>
  s.trim().split(/[\s@.]+/).filter(Boolean).map((w) => w[0]?.toUpperCase() ?? '').join('').slice(0, 2) || '?'
const PAGE = 5
const TRAILER_TYPES = ['Reefer', 'Dry Van', 'Flatbed', 'Reefer', 'Step Deck']
const plateFor = (i: number) => `${500 + ((i * 37) % 99)}-${String(1000 + ((i * 7919) % 9000)).slice(0, 4)}`

const REQUEST_TITLE: Record<RequestType, (d: string) => string> = {
  eld: (d) => `Connect ${d} (ELD)`,
  tms: (d) => `Connect ${d} (TMS)`,
  'fuel-card': (d) => `Set up your ${d.split(' — ')[0]} fuel card`,
  'efrouting-card': () => 'Issue your efRouting Fuel Card',
  transactions: () => 'Share your fuel transactions',
}
const REQUEST_GAP: Partial<Record<RequestType, OnboardingGap>> = {
  eld: 'eld-pending',
  tms: 'tms-pending',
  'fuel-card': 'fuelcard-pending',
  transactions: 'transactions',
}
const REQUEST_ICON: Record<RequestType, ReactNode> = {
  eld: <Cable size={15} />,
  tms: <Cable size={15} />,
  'fuel-card': <Fuel size={15} />,
  'efrouting-card': <CreditCard size={15} />,
  transactions: <Receipt size={15} />,
}
const STATUS_STEPS: { key: OnboardingRequest['status']; label: string }[] = [
  { key: 'received', label: 'Received' },
  { key: 'in-progress', label: 'In progress' },
  { key: 'resolved', label: 'Resolved' },
]

function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE))
  const from = total === 0 ? 0 : page * PAGE + 1
  const to = Math.min(total, (page + 1) * PAGE)
  return (
    <div className="mc-pager">
      <span>
        {from} - {to} of {total}
      </span>
      <button disabled={page === 0} onClick={() => onPage(0)} aria-label="First page">
        <ChevronsLeft size={15} />
      </button>
      <button disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Previous page">
        <ChevronLeft size={15} />
      </button>
      <button disabled={page >= pages - 1} onClick={() => onPage(page + 1)} aria-label="Next page">
        <ChevronRight size={15} />
      </button>
      <button disabled={page >= pages - 1} onClick={() => onPage(pages - 1)} aria-label="Last page">
        <ChevronsRight size={15} />
      </button>
    </div>
  )
}

function Cell({ v, k }: { v: ReactNode; k: string }) {
  return (
    <div className="mc-cell">
      <span className="mc-cell-v">{v}</span>
      <span className="mc-cell-k">{k}</span>
    </div>
  )
}

function Shell({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal cfm cfm2 mc-modal" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

// ── Fuel cards modal (production "Add fuel cards", one active card) ──
function FuelCardsModal({
  ob,
  fuelType,
  onFuelType,
  onChange,
  onRequest,
  onClose,
}: {
  ob: OnboardingState
  fuelType: string
  onFuelType: (t: string) => void
  onChange: (patch: Partial<OnboardingState>) => void
  onRequest: (type: RequestType, detail: string) => void
  onClose: () => void
}) {
  const current = ob.fuelCard?.kind === 'catalog' ? ob.fuelCard.name : null
  const [sel, setSel] = useState<string | null>(current)
  const [type, setType] = useState(fuelType)
  const [view, setView] = useState<'list' | 'add'>('list')
  const [promoHidden, setPromoHidden] = useState(false)
  const [provider, setProvider] = useState('')
  const [details, setDetails] = useState('')
  const [consent, setConsent] = useState(false)
  const custom = ob.fuelCard?.kind === 'custom' ? ob.fuelCard.provider : null

  const save = () => {
    if (sel && sel !== current) onChange({ fuelCard: { kind: 'catalog', name: sel } })
    onFuelType(type)
    onClose()
  }
  const requestEf = () => {
    if (!ob.efroutingCardRequested) onRequest('efrouting-card', 'efRouting Fuel Card')
    onChange({ efroutingCardRequested: true, fuelCard: { kind: 'catalog', name: 'efRouting' } })
    setSel('efRouting')
  }
  const sendCustom = () => {
    const name = provider.trim()
    if (!name) return
    onRequest('fuel-card', details.trim() ? `${name} — ${details.trim()}` : name)
    onChange({ fuelCard: { kind: 'custom', provider: name } })
    setSel(null)
    setView('list')
  }

  return (
    <Shell onClose={onClose}>
      <div className="modal-head">
        {view === 'add' ? (
          <button className="cfm-back" onClick={() => setView('list')} aria-label="Back">
            <ChevronLeft size={18} />
          </button>
        ) : (
          <span style={{ width: 18 }} />
        )}
        <span className="cfm-title">{view === 'add' ? 'Add new fuel card' : 'Fuel cards'}</span>
        <button className="cfm-x" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </div>
      {view === 'list' ? (
        <>
          <div className="modal-body">
            <div className="field">
              <label>Type of fuel</label>
              <select className="mc-select" value={type} onChange={(e) => setType(e.target.value)}>
                {['Diesel', 'Regular', 'Midgrade', 'Premium'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <span className="mc-field-label">Select fuel card · one active card per company</span>
            <div className="mc-fc-list">
              <button className="mc-fc-add" onClick={() => setView('add')}>
                <Plus size={14} /> Add New Fuel Card
              </button>
              {FUEL_CARD_CATALOG.map((c) => {
                const on = sel === c.name
                return (
                  <button key={c.name} className="mc-fc-row" onClick={() => setSel(c.name)} role="radio" aria-checked={on}>
                    <span className={`mc-switch ${on ? 'on' : ''}`} />
                    <span className="mc-fc-name">{c.name}</span>
                    {c.name === 'efRouting' && ob.efroutingCardRequested && (
                      <span className="mc-pill blue">Card requested</span>
                    )}
                    {c.name === 'efRouting' && custom && !sel && <span className="mc-pill">Temporary</span>}
                  </button>
                )
              })}
              {custom && (
                <div className="mc-fc-row">
                  <span className={`mc-switch ${!sel ? 'on' : ''}`} />
                  <span className="mc-fc-name">{custom}</span>
                  <span className="mc-pill yellow">Request sent</span>
                </div>
              )}
            </div>
            {custom && !sel && (
              <p className="mc-note">
                We&apos;re setting up {custom}. Meanwhile your fuel analysis uses the efRouting network.
              </p>
            )}
            {!promoHidden && !ob.efroutingCardRequested && (
              <div className="mc-promo">
                <span className="mc-promo-ico">
                  <CreditCard size={16} />
                </span>
                <div>
                  <b>
                    Save up to <em>$0.80/gal</em> with the efRouting Fuel Card
                  </b>
                  <span>Exclusive discounts at 20,000+ stations across the US.</span>
                  <button className="mc-promo-cta" onClick={requestEf}>
                    Request Your Card <ArrowRight size={14} />
                  </button>
                </div>
                <button className="mc-promo-x" onClick={() => setPromoHidden(true)} aria-label="Dismiss">
                  <X size={13} />
                </button>
              </div>
            )}
          </div>
          <div className="modal-foot">
            <button className="btn-text" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-pill" onClick={save}>
              Save changes
            </button>
          </div>
        </>
      ) : (
        <div className="modal-body">
          <div className="mc-privacy">
            <ShieldCheck size={16} />
            <span>
              We never ask for your card number, CVV or PIN — only your provider and anything that helps us load its
              stations and discounts.
            </span>
          </div>
          <div className="field">
            <label>Fuel card provider</label>
            <div className="field-input">
              <input
                autoFocus
                placeholder="e.g. Pilot, TA Petro, Comdata…"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
              />
            </div>
            <span className="cfm-oblig">Required</span>
          </div>
          <div className="field">
            <label>Account details (optional)</label>
            <textarea
              className="cfm-textarea"
              placeholder="e.g. your account manager or program name"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>
          <label className="it-consent-row">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              I agree that efRouting may contact me and my fuel card provider to set up my card&apos;s stations and
              discounts.
            </span>
          </label>
          <button className="cfm-primary" disabled={!provider.trim() || !consent} onClick={sendCustom}>
            Send request
          </button>
        </div>
      )}
    </Shell>
  )
}

interface Props {
  account: SignupAccount
  ob: OnboardingState
  onChange: (patch: Partial<OnboardingState>) => void
  requests: OnboardingRequest[]
  onRequest: (type: RequestType, detail: string) => void
  fleet: FleetCabin[]
  drivers: FleetDriver[]
  onAddDrivers: (extra: FleetDriver[]) => void
  onOpenWizard: (t?: WizardTarget) => void
  onOpenManage: (tab: CompanyManageTab) => void
  onShareTransactions: () => void
}

export default function MyCompanyV3({
  account,
  ob,
  onChange,
  requests,
  onRequest,
  fleet,
  drivers,
  onAddDrivers,
  onOpenWizard,
  onOpenManage,
  onShareTransactions,
}: Props) {
  const synced = ob.syncStarted
  const [empTab, setEmpTab] = useState<'all' | 'drivers' | 'dispatchers'>('all')
  const [empPage, setEmpPage] = useState(0)
  const [eqTab, setEqTab] = useState<'trailers' | 'units'>('trailers')
  const [eqPage, setEqPage] = useState(0)
  const [onlyUnassigned, setOnlyUnassigned] = useState(false)
  const [modal, setModal] = useState<null | 'fuel' | 'add-cab' | 'add-trailer' | 'add-driver'>(null)
  const [fuelType, setFuelType] = useState('Diesel')
  const [docs, setDocs] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState<string | null>(null)

  const copy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {})
    setCopied(key)
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1400)
  }

  // ---------- Fleet (same sources as Connect Fleet) ----------
  const eldName = ob.eld?.status === 'connected' ? ob.eld.name : null
  const manualCabNames = new Set(ob.manualCabins.map((c) => c.name))
  const units = [
    ...(synced ? fleet.filter((c) => !manualCabNames.has(c.id)) : []).map((c) => ({
      name: c.id,
      plate: plateFor(Number(c.id) || c.id.length),
      source: eldName ? `ELD · ${eldName}` : 'ELD',
      manual: false,
    })),
    ...ob.manualCabins.map((c) => ({ name: c.name, plate: c.plate || '—', source: 'Created manually', manual: true })),
  ]
  const manualTrailerNames = new Set(ob.manualTrailers.map((t) => t.name))
  const trailers = [
    ...(synced ? ob.trailers.filter((t) => !manualTrailerNames.has(t)) : []).map((name, i) => ({
      name,
      plate: plateFor(i + 3),
      type: TRAILER_TYPES[i % TRAILER_TYPES.length],
      manual: false,
    })),
    ...ob.manualTrailers.map((t) => ({ name: t.name, plate: t.plate || '—', type: t.type, manual: true })),
  ]
  const invitedIds = new Set(ob.manualDrivers.map((d) => d.id))
  const people = [
    ...(synced ? drivers : []),
    ...ob.manualDrivers.filter((d) => !(synced && drivers.some((x) => x.id === d.id))),
  ]
  // Drivers synced from the ELD take a unit / trailer in order; invited ones don't yet.
  const active = people.filter((d) => !invitedIds.has(d.id))
  const unitOf = (i: number) => units[i]?.name
  const trailerOf = (i: number) => (i % 3 === 1 ? trailers[i]?.name : undefined)
  // Invited drivers first, so a new invite shows up right where it was added.
  const ordered = [...people.filter((d) => invitedIds.has(d.id)).reverse(), ...people.filter((d) => !invitedIds.has(d.id))]
  const employees = ordered.map((d) => {
    const i = active.indexOf(d)
    const invited = invitedIds.has(d.id)
    const unit = invited ? undefined : unitOf(i)
    const trailer = invited ? undefined : trailerOf(i)
    const email = invited
      ? d.name
      : `${d.name.toLowerCase().replace(/[^a-z]+/g, '.')}@${(account.company || 'company').toLowerCase().replace(/[^a-z]+/g, '')}.com`
    return {
      id: d.id,
      name: invited ? d.name.split('@')[0] : d.name,
      unit,
      trailer,
      email,
      role: 'Driver',
      status: invited ? 'Invited' : unit && trailer ? 'Assigned' : 'Available',
    }
  })
  const admin = {
    id: 'admin',
    name: account.name,
    unit: undefined,
    trailer: undefined,
    email: account.email,
    role: 'Admin',
    status: 'Active',
  }
  const empRows = empTab === 'drivers' ? employees : empTab === 'dispatchers' ? [admin] : [admin, ...employees]
  const unitDriver = (i: number) => (active[i] ? active[i].name : null)
  const trailerDriver = (i: number) => {
    const k = active.findIndex((_, j) => trailerOf(j) === trailers[i]?.name)
    return k >= 0 ? active[k].name : null
  }
  const unassignedCount =
    units.filter((_, i) => !unitDriver(i)).length + trailers.filter((_, i) => !trailerDriver(i)).length
  const eqAll =
    eqTab === 'units'
      ? units.map((u, i) => ({ ...u, type: u.source, driver: unitDriver(i) }))
      : trailers.map((t, i) => ({ ...t, driver: trailerDriver(i) }))
  const eqRows = onlyUnassigned ? eqAll.filter((r) => !r.driver) : eqAll

  // ---------- Requests ----------
  const open = requests.filter((r) => r.status !== 'resolved')
  const reqOf = (t: RequestType) => [...requests].reverse().find((r) => r.type === t)
  const txReq = reqOf('transactions')
  const lastSync = fleet.length ? fleet.reduce((a, c) => (c.syncedTo > a ? c.syncedTo : a), fleet[0].syncedTo) : null

  const sourceRow = (type: 'eld' | 'tms') => {
    const src = ob[type]
    const label = type === 'eld' ? 'ELD' : 'TMS'
    const state = !src ? 'off' : src.status === 'connected' ? 'on' : 'wait'
    return (
      <div className="mc-int" key={type}>
        <div>
          <span className="mc-int-name">{label}</span>
          <span className={`mc-int-status ${state}`}>
            <i />
            {!src ? 'Not connected' : src.status === 'connected' ? `Connected · ${src.name}` : `Request sent · ${src.name}`}
          </span>
        </div>
        <button className="mc-btn" onClick={() => (synced ? onOpenManage('integrations') : onOpenWizard(type))}>
          {synced ? 'Manage' : src ? 'Edit' : 'Set up'}
        </button>
      </div>
    )
  }

  const fleetRow = (icon: ReactNode, label: string, count: number, tab: CompanyManageTab) => (
    <div className="mc-int" key={label}>
      <span className="mc-int-ico">{icon}</span>
      <div>
        <span className="mc-int-name">{label}</span>
        <span className="mc-int-sub">
          {count} linked{lastSync ? ` • Synced ${fmtShort(lastSync)}` : ''}
        </span>
      </div>
      <button className="mc-btn" onClick={() => onOpenManage(tab)}>
        Manage
      </button>
    </div>
  )

  const DOCS = ['Full Carrier Packet', 'Certificate of Insurance', 'MC/DOT Authority', 'W9 Form']
  const docCount = DOCS.filter((d) => docs[d]).length

  return (
    <div className="mc">
      <div className="mc-crumb">
        <span>Home</span>
        <ChevronRight size={13} />
        <b>My Company</b>
      </div>

      <div className="mc-grid">
        {/* ================= Left column ================= */}
        <div className="mc-col">
          <section className="mc-card mc-profile">
            <span className="mc-avatar lg">{initials(account.name)}</span>
            <span className="mc-profile-name">{account.name}</span>
            <span className="mc-dim">Admin account</span>
          </section>

          <section className="mc-card">
            <div className="mc-company">
              <span className="mc-avatar sq">{initials(account.company)}</span>
              <div>
                <span className="mc-company-name">{account.company}</span>
                {account.mc || account.dot ? (
                  <button
                    className="mc-mc"
                    onClick={() => copy('mc', account.mc ? `MC ${account.mc}` : `DOT ${account.dot}`)}
                  >
                    {account.mc ? `MC ${account.mc}` : `DOT ${account.dot}`}
                    {copied === 'mc' ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                ) : (
                  <span className="mc-dim">No MC / DOT yet</span>
                )}
              </div>
            </div>
            <div className="mc-plan">
              <span className="mc-ef">ef</span>
              <span className="mc-pill green">Free trial</span>
              <button className="mc-link">Get Plan</button>
              <button className="mc-icon" aria-label="Edit company">
                <Pencil size={14} />
              </button>
            </div>
            <div className="mc-contact">
              <Mail size={15} />
              <div>
                <span>{account.email}</span>
                <span className="mc-dim">Email</span>
              </div>
              <button className="mc-icon" onClick={() => copy('email', account.email)} aria-label="Copy email">
                {copied === 'email' ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <div className="mc-contact">
              <Phone size={15} />
              <div>
                <span>{account.phone}</span>
                <span className="mc-dim">Phone</span>
              </div>
              <button className="mc-icon" onClick={() => copy('phone', account.phone)} aria-label="Copy phone">
                {copied === 'phone' ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </section>

          <section className="mc-card">
            <div className="mc-card-head">
              <span className="mc-card-title">Carrier packet</span>
              <button className="mc-icon round" aria-label="Share carrier packet">
                <Share2 size={14} />
              </button>
            </div>
            <div className="mc-packet">
              <Package size={14} /> Carrier Packet <span className="mc-dim">{docCount} files</span>
            </div>
            {DOCS.map((d) => (
              <div className="mc-doc" key={d}>
                <FileText size={14} />
                <span className={docs[d] ? '' : 'mc-dim'}>{d}</span>
                {docs[d] ? (
                  <Check size={14} className="mc-ok" />
                ) : (
                  <button className="mc-link sm" onClick={() => setDocs((x) => ({ ...x, [d]: true }))}>
                    <Upload size={12} /> Upload
                  </button>
                )}
              </div>
            ))}
          </section>

          <section className="mc-card">
            <span className="mc-card-title">Integrations</span>
            {!synced && (
              <div className="mc-connect">
                <span>Connect your ELD, TMS and fleet to replace the sample data with your own operation.</span>
                <button className="mc-cta" onClick={() => onOpenWizard()}>
                  <Cable size={14} /> {ob.eld || ob.tms || ob.fleetDone ? 'Continue setup' : 'Connect your fleet'}
                </button>
              </div>
            )}
            <span className="mc-sub-title">Connected systems</span>
            {sourceRow('eld')}
            {sourceRow('tms')}
            {synced && (
              <>
                <span className="mc-sub-title">Fleet data</span>
                {fleetRow(<Truck size={15} />, 'Units', units.length, 'cabins')}
                {fleetRow(<Container size={15} />, 'Trailers', trailers.length, 'trailers')}
                {fleetRow(<User size={15} />, 'Drivers', employees.length, 'drivers')}
              </>
            )}
          </section>

          <section className="mc-card">
            <div className="mc-card-head">
              <span className="mc-card-title">Fuel cards</span>
              <button className="mc-btn ghost" onClick={() => setModal('fuel')}>
                {ob.fuelCard ? 'Edit' : 'Add'} <Plus size={13} />
              </button>
            </div>
            {!ob.fuelCard && <span className="mc-dim mc-pad">No fuel card yet — it&apos;s part of your setup.</span>}
            {ob.fuelCard?.kind === 'catalog' && (
              <div className="mc-fc">
                <span>{ob.fuelCard.name}</span>
                {ob.fuelCard.name === 'efRouting' && ob.efroutingCardRequested && reqOf('efrouting-card')?.status !== 'resolved' && (
                  <span className="mc-pill blue">Card requested</span>
                )}
                <span className="mc-pill green">{fuelType}</span>
              </div>
            )}
            {ob.fuelCard?.kind === 'custom' && (
              <>
                <div className="mc-fc">
                  <span>{ob.fuelCard.provider}</span>
                  <span className="mc-pill yellow">Request sent</span>
                </div>
                <div className="mc-fc">
                  <span>efRouting</span>
                  <span className="mc-pill">Temporary</span>
                  <span className="mc-pill green">{fuelType}</span>
                </div>
              </>
            )}
            {/* Fuel transactions: the optional step, tracked right next to the card. */}
            <div className="mc-tx">
              <Receipt size={15} />
              <div>
                <span className="mc-int-name">Fuel transactions</span>
                <span className="mc-int-sub">
                  {!txReq
                    ? 'Not shared · fuel spend is estimated from your ELD (~95%)'
                    : txReq.status === 'resolved'
                      ? 'Shared · exact fuel spend per transaction'
                      : txReq.status === 'in-progress'
                        ? 'In progress · we’re setting it up with you'
                        : 'Request sent · we’ll reach out to coordinate it'}
                </span>
              </div>
              {!txReq ? (
                <button className="mc-btn" onClick={onShareTransactions}>
                  Contact me
                </button>
              ) : (
                <span className={`mc-pill ${txReq.status === 'resolved' ? 'green' : 'yellow'}`}>
                  {STATUS_STEPS.find((s) => s.key === txReq.status)?.label}
                </span>
              )}
            </div>
          </section>
        </div>

        {/* ================= Right column ================= */}
        <div className="mc-col wide">
          {requests.length > 0 && (
            <section className="mc-card">
              <div className="mc-card-head">
                <span className="mc-card-title with-ico">
                  <Clock size={16} /> Setup requests
                </span>
                <span className="mc-dim">
                  {open.length > 0 ? `${open.length} open` : 'All resolved'} · our team handles these for you
                </span>
              </div>
              <div className="mc-reqs">
                {[...requests]
                  .sort((a, b) => Number(a.status === 'resolved') - Number(b.status === 'resolved'))
                  .map((r) => {
                    const idx = STATUS_STEPS.findIndex((s) => s.key === r.status)
                    const gap = REQUEST_GAP[r.type]
                    return (
                      <div className={`mc-req ${r.status}`} key={r.id}>
                        <span className="mc-req-ico">{REQUEST_ICON[r.type]}</span>
                        <div className="mc-req-main">
                          <span className="mc-req-title">{REQUEST_TITLE[r.type](r.detail)}</span>
                          <span className="mc-dim">
                            {r.id} · Sent {fmtDate(r.createdAt)}
                          </span>
                          {r.status !== 'resolved' && gap && (
                            <span className="mc-req-loss">Meanwhile: {ONBOARDING_LOSS[gap].loss}</span>
                          )}
                        </div>
                        <div className="mc-steps" aria-label={`Status: ${STATUS_STEPS[idx].label}`}>
                          {STATUS_STEPS.map((s, i) => (
                            <span key={s.key} className={`mc-step ${i < idx ? 'done' : i === idx ? 'now' : ''}`}>
                              <i>{i < idx || r.status === 'resolved' ? <Check size={10} strokeWidth={3} /> : null}</i>
                              {s.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </section>
          )}

          <section className="mc-card">
            <div className="mc-card-head">
              <span className="mc-card-title with-ico">
                <Users size={17} /> Employee accounts
              </span>
              <div className="mc-head-actions">
                <button className="mc-icon round" aria-label="Search employees">
                  <Search size={15} />
                </button>
                <button className="mc-btn ghost" onClick={() => setModal('add-driver')}>
                  Add new <Plus size={13} />
                </button>
              </div>
            </div>
            <div className="mc-tabs">
              {(['all', 'drivers', 'dispatchers'] as const).map((t) => (
                <button
                  key={t}
                  className={empTab === t ? 'active' : ''}
                  onClick={() => {
                    setEmpTab(t)
                    setEmpPage(0)
                  }}
                >
                  {t === 'all' ? 'All' : t === 'drivers' ? 'Drivers' : 'Dispatchers'}
                </button>
              ))}
            </div>
            {empTab === 'drivers' && employees.length === 0 ? (
              <div className="mc-empty">
                <b>Your driver list is empty</b>
                <span>
                  {synced ? 'Use Add new to invite a driver.' : 'Drivers come in when you connect your ELD — or invite them with Add new.'}
                </span>
              </div>
            ) : (
              <>
                <div className="mc-table">
                  {empRows.slice(empPage * PAGE, (empPage + 1) * PAGE).map((e) => (
                    <div className="mc-row emp" key={e.id}>
                      <div className="mc-cell person">
                        <span className="mc-avatar sm">{initials(e.name)}</span>
                        <div>
                          <span className="mc-cell-v">{e.name}</span>
                          <span className="mc-cell-k">Name</span>
                        </div>
                      </div>
                      <Cell v={e.role === 'Admin' ? '—' : (e.unit ?? 'Unassigned')} k="Unit" />
                      <Cell v={e.role === 'Admin' ? '—' : (e.trailer ?? 'Unassigned')} k="Trailer" />
                      <Cell v={<span className="mc-ellipsis">{e.email}</span>} k="Email address" />
                      <Cell v={e.role} k="Role" />
                      <span className={`mc-status ${e.status.toLowerCase()}`}>{e.status}</span>
                    </div>
                  ))}
                </div>
                <Pager page={empPage} total={empRows.length} onPage={setEmpPage} />
              </>
            )}
          </section>

          <section className="mc-card">
            <div className="mc-card-head">
              <span className="mc-card-title with-ico">
                <Truck size={17} /> Equipment
              </span>
              <div className="mc-head-actions">
                {unassignedCount > 0 && (
                  <button
                    className={`mc-unassigned ${onlyUnassigned ? 'on' : ''}`}
                    onClick={() => {
                      setOnlyUnassigned((v) => !v)
                      setEqPage(0)
                    }}
                    title="Show only equipment without a driver"
                  >
                    Unassigned <Bell size={13} />
                    <span className="mc-badge">{unassignedCount}</span>
                  </button>
                )}
                <button className="mc-icon round" aria-label="Search equipment">
                  <Search size={15} />
                </button>
                <button className="mc-btn ghost" onClick={() => setModal(eqTab === 'units' ? 'add-cab' : 'add-trailer')}>
                  Add new <Plus size={13} />
                </button>
              </div>
            </div>
            <div className="mc-tabs">
              {(['trailers', 'units'] as const).map((t) => (
                <button
                  key={t}
                  className={eqTab === t ? 'active' : ''}
                  onClick={() => {
                    setEqTab(t)
                    setEqPage(0)
                  }}
                >
                  {t === 'trailers' ? 'Trailers' : 'Units'}
                </button>
              ))}
            </div>
            {eqRows.length === 0 ? (
              <div className="mc-empty">
                <b>{onlyUnassigned ? 'Everything has a driver' : `No ${eqTab} yet`}</b>
                <span>
                  {synced
                    ? `Use Add new to create one.`
                    : `They come in when you connect your fleet — or create one with Add new.`}
                </span>
              </div>
            ) : (
              <>
                <div className="mc-table">
                  {eqRows.slice(eqPage * PAGE, (eqPage + 1) * PAGE).map((r) => (
                    <div className="mc-row eq" key={r.name}>
                      <Cell v={r.name} k={eqTab === 'units' ? 'Unit name' : 'Trailer name'} />
                      <Cell v={r.plate} k="Plate Number" />
                      <Cell v={r.type} k={eqTab === 'units' ? 'Source' : 'Trailer Type'} />
                      <div className="mc-cell person">
                        <span className={`mc-avatar sm ${r.driver ? '' : 'muted'}`}>{r.driver ? initials(r.driver) : 'D'}</span>
                        <div>
                          <span className="mc-cell-v">{r.driver ?? 'Unassigned'}</span>
                          <span className="mc-cell-k">Driver</span>
                        </div>
                      </div>
                      <span className="mc-status available">Available</span>
                    </div>
                  ))}
                </div>
                <Pager page={eqPage} total={eqRows.length} onPage={setEqPage} />
              </>
            )}
          </section>
        </div>
      </div>

      {modal === 'fuel' && (
        <FuelCardsModal
          ob={ob}
          fuelType={fuelType}
          onFuelType={setFuelType}
          onChange={onChange}
          onRequest={onRequest}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'add-cab' && (
        <Shell onClose={() => setModal(null)}>
          <div className="modal-body">
            <AddCabForm
              takenNames={units.map((u) => u.name)}
              onCancel={() => setModal(null)}
              onAdd={(cab) => {
                onChange({ manualCabins: [...ob.manualCabins, cab], cabins: [...ob.cabins, cab.name] })
                setEqTab('units')
                setModal(null)
              }}
            />
          </div>
        </Shell>
      )}
      {modal === 'add-trailer' && (
        <Shell onClose={() => setModal(null)}>
          <div className="modal-body">
            <AddTrailerForm
              takenNames={trailers.map((t) => t.name)}
              onCancel={() => setModal(null)}
              onAdd={(t) => {
                onChange({ manualTrailers: [...ob.manualTrailers, t], trailers: [...ob.trailers, t.name] })
                setEqTab('trailers')
                setModal(null)
              }}
            />
          </div>
        </Shell>
      )}
      {modal === 'add-driver' && (
        <Shell onClose={() => setModal(null)}>
          <div className="modal-body">
            <AddDriverForm
              takenEmails={ob.manualDrivers.map((d) => d.name)}
              onCancel={() => setModal(null)}
              onAdd={({ email }) => {
                const d = { id: `DRV-NEW-${Date.now()}`, name: email }
                onChange({ manualDrivers: [...ob.manualDrivers, d] })
                // After the sync the driver joins the linked roster right away.
                if (synced) onAddDrivers([d])
                setEmpTab('drivers')
                setModal(null)
              }}
            />
          </div>
        </Shell>
      )}
    </div>
  )
}
