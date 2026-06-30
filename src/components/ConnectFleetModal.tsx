import { useEffect, useState } from 'react'
import {
  X,
  ArrowLeft,
  ChevronRight,
  RefreshCw,
  Upload,
  Search,
  Check,
  Truck,
} from 'lucide-react'

type Step =
  | 'chooser'
  | 'tms-list'
  | 'tms-cred'
  | 'tms-manage'
  | 'tms-unlink'
  | 'eld-list'
  | 'eld-cred'
  | 'eld-manage'
  | 'eld-unlink'
  | 'syncing'
  | 'connected'
  | 'upload'
  | 'upload-success'

interface Tms {
  name: string
  mono: string
  url: string
}

const tmsList: Tms[] = [
  { name: 'Datatruck', mono: 'Da', url: 'https://xxxxx.datatruck.io/api/' },
  { name: 'Alvys', mono: 'Al', url: 'https://api.alvys.com/' },
  { name: 'McLeod LoadMaster', mono: 'Mc', url: 'https://api.mcleodsoftware.com/' },
  { name: 'Trimble TMW Suite', mono: 'Tr', url: 'https://api.trimble.com/' },
  { name: 'MercuryGate', mono: 'MG', url: 'https://api.mercurygate.com/' },
  { name: 'Project44', mono: 'P4', url: 'https://api.project44.com/' },
]

interface EldField {
  key: string
  label: string
  placeholder: string
  secret?: boolean // masked in the connected detail view
}

interface Eld {
  name: string
  mono: string
  vehicles: string
  fields: EldField[]
}

const eldList: Eld[] = [
  {
    name: 'Samsara',
    mono: 'Sa',
    vehicles: '18 trucks',
    fields: [
      { key: 'apikey', label: 'API key', placeholder: 'Enter the API key', secret: true },
    ],
  },
  {
    name: 'Geotab',
    mono: 'Ge',
    vehicles: '25 trucks',
    fields: [
      { key: 'user', label: 'User', placeholder: 'Enter the User', secret: true },
      { key: 'database', label: 'Database', placeholder: 'Enter the Database' },
      { key: 'password', label: 'Password', placeholder: 'Enter the Password', secret: true },
    ],
  },
]

// Geotab ships pre-connected as a live example of a linked ELD.
const GEOTAB_EXAMPLE: Record<string, string> = {
  user: 'fleet_admin',
  database: '1234',
  password: 'geotab-secret',
}

// Columns mirror the "Add new cab" form fields, one row per truck.
const TEMPLATE_COLUMNS = [
  'cab_name',
  'eld_id',
  'vin',
  'license_plate',
  'fuel_type',
  'max_hitch_lb',
  'axle_config',
  'tank_capacity_gal',
  'mpg',
]

const TEMPLATE_ROWS = [
  [
    'Blue Runner', 'ELD-88231', '1FUJGLDR5HLHZ1234', 'TX-9921AB',
    'Diesel', '80000', '6x4', '200', '6.8',
  ],
  [
    'Night Owl', 'ELD-88232', '3HSDJAPR8LN567890', 'GA-4471CD',
    'Diesel', '52000', '4x2', '150', '7.2',
  ],
]

function csvCell(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

function downloadTemplate() {
  const lines = [
    TEMPLATE_COLUMNS.join(','),
    ...TEMPLATE_ROWS.map((r) => r.map(csvCell).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'efrouting_fleet_template.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

interface Props {
  onClose: () => void
}

export default function ConnectFleetModal({ onClose }: Props) {
  const [step, setStep] = useState<Step>('chooser')
  const [tms, setTms] = useState<Tms | null>(null)
  const [query, setQuery] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [fileName, setFileName] = useState('')
  // Datatruck ships pre-connected as a live example of a linked TMS.
  const [connected, setConnected] = useState<string[]>(['Datatruck'])

  // ELD state — Geotab ships pre-connected as a live example.
  const [eld, setEld] = useState<Eld | null>(null)
  const [eldValues, setEldValues] = useState<Record<string, string>>({})
  const [eldConnected, setEldConnected] = useState<Record<string, Record<string, string>>>({
    Geotab: GEOTAB_EXAMPLE,
  })
  const [connectingType, setConnectingType] = useState<'tms' | 'eld'>('tms')

  const activeName = connectingType === 'eld' ? eld?.name : tms?.name

  // Auto-advance from the syncing screen to the connected screen.
  useEffect(() => {
    if (step !== 'syncing') return
    const t = setTimeout(() => {
      if (connectingType === 'tms' && tms) {
        setConnected((c) => (c.includes(tms.name) ? c : [...c, tms.name]))
      } else if (connectingType === 'eld' && eld) {
        setEldConnected((prev) => ({ ...prev, [eld.name]: eldValues }))
      }
      setStep('connected')
    }, 2200)
    return () => clearTimeout(t)
  }, [step, connectingType, tms, eld, eldValues])

  const filtered = tmsList.filter((t) =>
    t.name.toLowerCase().includes(query.toLowerCase()),
  )

  const eldComplete =
    !!eld && eld.fields.every((f) => (eldValues[f.key] ?? '').trim())

  const handleFile = (name: string) => {
    setFileName(name)
    setStep('upload-success')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal cfm" onClick={(e) => e.stopPropagation()}>
        {/* ---------- Chooser ---------- */}
        {step === 'chooser' && (
          <>
            <div className="modal-head">
              <span className="cfm-title">Connect your fleet</span>
              <button className="cfm-x" onClick={onClose} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p className="cfm-sub">
                Connect a TMS or ELD, or upload a file to start tracking lanes
                and performance.
              </p>

              <button className="cfm-option" onClick={() => setStep('tms-list')}>
                <span className="cfm-option-icon blue">
                  <RefreshCw size={20} />
                </span>
                <span className="cfm-option-main">
                  <span className="cfm-option-title">
                    Connect TMS
                    <ChevronRight size={16} className="cfm-arrow" />
                  </span>
                  <span className="cfm-option-tag green">Live sync</span>
                  <span className="cfm-option-desc">
                    Auto-sync trucks, lanes, and loads via API.
                  </span>
                </span>
              </button>

              <button className="cfm-option" onClick={() => setStep('eld-list')}>
                <span className="cfm-option-icon blue">
                  <Truck size={20} />
                </span>
                <span className="cfm-option-main">
                  <span className="cfm-option-title">
                    Connect ELD
                    <ChevronRight size={16} className="cfm-arrow" />
                  </span>
                  <span className="cfm-option-tag green">Live telematics</span>
                  <span className="cfm-option-desc">
                    Stream real-time location, hours, and engine data.
                  </span>
                </span>
              </button>

              <button className="cfm-option" onClick={() => setStep('upload')}>
                <span className="cfm-option-icon">
                  <Upload size={20} />
                </span>
                <span className="cfm-option-main">
                  <span className="cfm-option-title">
                    Upload file
                    <ChevronRight size={16} className="cfm-arrow" />
                  </span>
                  <span className="cfm-option-tag">One time import</span>
                  <span className="cfm-option-desc">
                    Import your fleet from a CSV or Excel file.
                  </span>
                </span>
              </button>
            </div>
          </>
        )}

        {/* ---------- TMS list ---------- */}
        {step === 'tms-list' && (
          <>
            <div className="modal-head">
              <button
                className="cfm-back"
                onClick={() => setStep('chooser')}
                aria-label="Back"
              >
                <ArrowLeft size={18} />
              </button>
              <span className="cfm-title">Connect TMS</span>
            </div>
            <div className="modal-body">
              <p className="cfm-sub">Select your transportation management system.</p>
              <div className="tf-search">
                <Search size={15} color="var(--text-muted)" />
                <input
                  placeholder="Search integrations"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="cfm-tms-grid">
                {filtered.map((t) => {
                  const isConnected = connected.includes(t.name)
                  return (
                    <button
                      key={t.name}
                      className={`cfm-tms-card${isConnected ? ' connected' : ''}`}
                      onClick={() => {
                        setTms(t)
                        if (isConnected) {
                          setStep('tms-manage')
                        } else {
                          setApiKey('')
                          setStep('tms-cred')
                        }
                      }}
                    >
                      <span className="cfm-tms-logo">{t.mono}</span>
                      <span className="cfm-tms-name">{t.name}</span>
                      {isConnected ? (
                        <span className="cfm-conn-badge">
                          <Check size={11} strokeWidth={3} />
                          Connected
                        </span>
                      ) : (
                        <ChevronRight size={15} className="cfm-card-arrow" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* ---------- TMS credentials ---------- */}
        {step === 'tms-cred' && tms && (
          <>
            <div className="modal-head">
              <button
                className="cfm-back"
                onClick={() => setStep('tms-list')}
                aria-label="Back"
              >
                <ArrowLeft size={18} />
              </button>
              <span className="cfm-title">Connect {tms.name}</span>
            </div>
            <div className="modal-body">
              <p className="cfm-sub">
                Enter your {tms.name} API key to sync your trucks, lanes, and
                loads.
              </p>

              <div className="field">
                <label>API key</label>
                <div className="field-input">
                  <input
                    placeholder="Enter the API key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
                <span className="cfm-oblig">Obligatory</span>
              </div>

              <button
                className="cfm-primary"
                disabled={!apiKey.trim()}
                onClick={() => {
                  setConnectingType('tms')
                  setStep('syncing')
                }}
              >
                Connect
              </button>
            </div>
          </>
        )}

        {/* ---------- TMS manage (already connected) ---------- */}
        {step === 'tms-manage' && tms && (
          <>
            <div className="modal-head">
              <button
                className="cfm-back"
                onClick={() => setStep('tms-list')}
                aria-label="Back"
              >
                <ArrowLeft size={18} />
              </button>
              <span className="cfm-tms-logo sm">{tms.mono}</span>
              <span className="cfm-title">{tms.name}</span>
              <button
                className="cfm-unlink"
                onClick={() => setStep('tms-unlink')}
              >
                Unlink
              </button>
            </div>
            <div className="modal-body">
              <p className="cfm-detail-head">{tms.name} information</p>
              <div className="cfm-detail">
                <div className="cfm-detail-row">
                  <span className="cfm-detail-label">Status</span>
                  <span className="cfm-detail-value green">Synchronized</span>
                </div>
                <div className="cfm-detail-row">
                  <span className="cfm-detail-label">API key</span>
                  <span className="cfm-detail-value">*****</span>
                </div>
                <div className="cfm-detail-row">
                  <span className="cfm-detail-label">URL</span>
                  <span className="cfm-detail-value">{tms.url}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ---------- TMS unlink confirmation ---------- */}
        {step === 'tms-unlink' && tms && (
          <>
            <div className="modal-head">
              <span className="cfm-title">{tms.name}</span>
              <span className="cfm-tms-logo sm">{tms.mono}</span>
            </div>
            <div className="modal-body">
              <h3 className="cfm-confirm-title">
                Are you sure you want to unlink the {tms.name}?
              </h3>
              <p className="cfm-confirm-sub">
                Once unlinked, real-time data from {tms.name} will no longer be
                available for your fleet.
              </p>
              <div className="cfm-confirm-actions">
                <button
                  className="cfm-confirm-unlink"
                  onClick={() => {
                    setConnected((c) => c.filter((n) => n !== tms.name))
                    setStep('tms-list')
                  }}
                >
                  Unlink
                </button>
                <button
                  className="cfm-primary keep"
                  onClick={() => setStep('tms-manage')}
                >
                  Keep integration
                </button>
              </div>
            </div>
          </>
        )}

        {/* ---------- ELD provider list ---------- */}
        {step === 'eld-list' && (
          <>
            <div className="modal-head">
              <button
                className="cfm-back"
                onClick={() => setStep('chooser')}
                aria-label="Back"
              >
                <ArrowLeft size={18} />
              </button>
              <span className="cfm-title">Select ELD Provider</span>
            </div>
            <div className="modal-body">
              <p className="cfm-sub">
                Choose your electronic logging device provider.
              </p>
              <div className="cfm-tms-grid one">
                {eldList.map((e) => {
                  const isConnected = !!eldConnected[e.name]
                  return (
                    <button
                      key={e.name}
                      className={`cfm-tms-card${isConnected ? ' connected' : ''}`}
                      onClick={() => {
                        setEld(e)
                        if (isConnected) {
                          setStep('eld-manage')
                        } else {
                          setEldValues({})
                          setStep('eld-cred')
                        }
                      }}
                    >
                      <span className="cfm-tms-logo">{e.mono}</span>
                      <span className="cfm-tms-name">{e.name}</span>
                      {isConnected ? (
                        <span className="cfm-conn-badge">
                          <Check size={11} strokeWidth={3} />
                          Connected
                        </span>
                      ) : (
                        <ChevronRight size={15} className="cfm-card-arrow" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* ---------- ELD credentials ---------- */}
        {step === 'eld-cred' && eld && (
          <>
            <div className="modal-head">
              <button
                className="cfm-back"
                onClick={() => setStep('eld-list')}
                aria-label="Back"
              >
                <ArrowLeft size={18} />
              </button>
              <span className="cfm-tms-logo sm">{eld.mono}</span>
              <span className="cfm-title">{eld.name}</span>
            </div>
            <div className="modal-body">
              {eld.fields.map((f) => (
                <div className="field" key={f.key}>
                  <label>{f.label}</label>
                  <div className="field-input">
                    <input
                      type={f.secret ? 'password' : 'text'}
                      placeholder={f.placeholder}
                      value={eldValues[f.key] ?? ''}
                      onChange={(ev) =>
                        setEldValues((v) => ({ ...v, [f.key]: ev.target.value }))
                      }
                    />
                  </div>
                  <span className="cfm-oblig">Obligatory</span>
                </div>
              ))}

              <div className="cfm-confirm-actions">
                <button className="cfm-confirm-unlink" onClick={() => setStep('eld-list')}>
                  Go back
                </button>
                <button
                  className="cfm-primary keep"
                  disabled={!eldComplete}
                  onClick={() => {
                    setConnectingType('eld')
                    setStep('syncing')
                  }}
                >
                  Integrate
                </button>
              </div>
            </div>
          </>
        )}

        {/* ---------- ELD manage (already connected) ---------- */}
        {step === 'eld-manage' && eld && (
          <>
            <div className="modal-head">
              <button
                className="cfm-back"
                onClick={() => setStep('eld-list')}
                aria-label="Back"
              >
                <ArrowLeft size={18} />
              </button>
              <span className="cfm-tms-logo sm">{eld.mono}</span>
              <span className="cfm-title">{eld.name}</span>
              <button className="cfm-unlink" onClick={() => setStep('eld-unlink')}>
                Unlink
              </button>
            </div>
            <div className="modal-body">
              <p className="cfm-detail-head">{eld.name} information</p>
              <div className="cfm-detail">
                <div className="cfm-detail-row">
                  <span className="cfm-detail-label">Status</span>
                  <span className="cfm-detail-value green">Synchronized</span>
                </div>
                {eld.fields.map((f) => {
                  const val = eldConnected[eld.name]?.[f.key] ?? ''
                  return (
                    <div className="cfm-detail-row" key={f.key}>
                      <span className="cfm-detail-label">{f.label}</span>
                      <span className="cfm-detail-value">
                        {f.secret ? '*'.repeat(Math.max(val.length, 5)) : val}
                      </span>
                    </div>
                  )
                })}
                <div className="cfm-detail-row">
                  <span className="cfm-detail-label">Vehicles</span>
                  <span className="cfm-detail-value">{eld.vehicles}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ---------- ELD unlink confirmation ---------- */}
        {step === 'eld-unlink' && eld && (
          <>
            <div className="modal-head">
              <span className="cfm-title">{eld.name}</span>
              <span className="cfm-tms-logo sm">{eld.mono}</span>
            </div>
            <div className="modal-body">
              <h3 className="cfm-confirm-title">
                Are you sure you want to unlink the {eld.name}?
              </h3>
              <p className="cfm-confirm-sub">
                Once unlinked, real-time data from {eld.name} will no longer be
                available for your fleet.
              </p>
              <div className="cfm-confirm-actions">
                <button
                  className="cfm-confirm-unlink"
                  onClick={() => {
                    setEldConnected((prev) => {
                      const next = { ...prev }
                      delete next[eld.name]
                      return next
                    })
                    setStep('eld-list')
                  }}
                >
                  Unlink
                </button>
                <button
                  className="cfm-primary keep"
                  onClick={() => setStep('eld-manage')}
                >
                  Keep integration
                </button>
              </div>
            </div>
          </>
        )}

        {/* ---------- Syncing ---------- */}
        {step === 'syncing' && (
          <div className="modal-body cfm-center">
            <span className="cfm-circle blue spin">
              <RefreshCw size={30} />
            </span>
            <h3 className="cfm-status-title">Syncing with {activeName}</h3>
            <p className="cfm-status-sub">
              Importing your fleet data. This usually takes under a minute.
            </p>
          </div>
        )}

        {/* ---------- Connected ---------- */}
        {step === 'connected' && (
          <div className="modal-body cfm-center">
            <span className="cfm-circle green">
              <Check size={32} strokeWidth={3} />
            </span>
            <h3 className="cfm-status-title">{activeName} connected</h3>
            <p className="cfm-status-sub">Your fleet is now syncing in real time.</p>
            <button className="cfm-go" onClick={onClose}>
              Go to overview
            </button>
          </div>
        )}

        {/* ---------- Upload ---------- */}
        {step === 'upload' && (
          <>
            <div className="modal-head">
              <button
                className="cfm-back"
                onClick={() => setStep('chooser')}
                aria-label="Back"
              >
                <ArrowLeft size={18} />
              </button>
              <span className="cfm-title">Upload fleet file</span>
            </div>
            <div className="modal-body">
              <p className="cfm-sub">
                Upload a CSV or Excel file with your truck and lane data.
              </p>

              <label
                className="cfm-dropzone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const f = e.dataTransfer.files?.[0]
                  if (f) handleFile(f.name)
                }}
              >
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFile(f.name)
                  }}
                />
                <Upload size={26} color="var(--text-dim)" />
                <span className="cfm-drop-title">Drag and drop your file here</span>
                <span className="cfm-drop-sub">
                  or <b>browse files</b> · .csv, .xlsx up to 10MB
                </span>
              </label>

              <div className="cfm-or">
                <span />
                OR
                <span />
              </div>

              <p className="cfm-template-q">Not sure about the format?</p>
              <button className="cfm-template-btn" onClick={downloadTemplate}>
                Download template
              </button>
            </div>
          </>
        )}

        {/* ---------- Upload success ---------- */}
        {step === 'upload-success' && (
          <div className="modal-body cfm-center">
            <span className="cfm-circle green">
              <Check size={32} strokeWidth={3} />
            </span>
            <h3 className="cfm-status-title">{fileName.toUpperCase()} imported</h3>
            <p className="cfm-status-sub">
              Your trucks are now visible in the fleet map.
            </p>
            <button className="cfm-go" onClick={onClose}>
              Go to overview
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
