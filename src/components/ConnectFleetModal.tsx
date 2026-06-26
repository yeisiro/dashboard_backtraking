import { useEffect, useState } from 'react'
import {
  X,
  ArrowLeft,
  ChevronRight,
  RefreshCw,
  Upload,
  Search,
  Check,
} from 'lucide-react'

type Step =
  | 'chooser'
  | 'tms-list'
  | 'tms-cred'
  | 'syncing'
  | 'connected'
  | 'upload'
  | 'upload-success'

interface Tms {
  name: string
  mono: string
}

const tmsList: Tms[] = [
  { name: 'McLeod LoadMaster', mono: 'Mc' },
  { name: 'Trimble TMW Suite', mono: 'Tr' },
  { name: 'MercuryGate', mono: 'MG' },
  { name: 'TMW TruckMate', mono: 'TM' },
  { name: 'Samsara', mono: 'Sa' },
  { name: 'Project44', mono: 'P4' },
]

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
  const [authMethod, setAuthMethod] = useState<'oauth' | 'apikey'>('oauth')
  const [fileName, setFileName] = useState('')

  // Auto-advance from the syncing screen to the connected screen.
  useEffect(() => {
    if (step !== 'syncing') return
    const t = setTimeout(() => setStep('connected'), 2200)
    return () => clearTimeout(t)
  }, [step])

  const filtered = tmsList.filter((t) =>
    t.name.toLowerCase().includes(query.toLowerCase()),
  )

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
                Import your trucks from a TMS or upload a file to start tracking
                lanes and performance.
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
                  <span className="cfm-option-tag green">Recommended · Live sync</span>
                  <span className="cfm-option-desc">
                    Link your TMS via API for automatic fleet updates. Trucks,
                    lanes, and load data sync continuously.
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
                    Upload a CSV or Excel file with your truck list, lanes, and
                    load history. You can re-upload anytime to update.
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
                {filtered.map((t) => (
                  <button
                    key={t.name}
                    className="cfm-tms-card"
                    onClick={() => {
                      setTms(t)
                      setAuthMethod('oauth')
                      setStep('tms-cred')
                    }}
                  >
                    <span className="cfm-tms-logo">{t.mono}</span>
                    <span className="cfm-tms-name">{t.name}</span>
                  </button>
                ))}
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
                Authorize efRouting to sync your trucks, lanes, and loads.
              </p>

              <div className="cfm-seg">
                <button
                  className={authMethod === 'oauth' ? 'active' : ''}
                  onClick={() => setAuthMethod('oauth')}
                >
                  OAuth 2.0
                  <span className="cfm-seg-rec">Recommended</span>
                </button>
                <button
                  className={authMethod === 'apikey' ? 'active' : ''}
                  onClick={() => setAuthMethod('apikey')}
                >
                  API key
                </button>
              </div>

              {authMethod === 'oauth' ? (
                <>
                  <div className="cfm-note">
                    You'll be redirected to {tms.name} to authorize read access.
                    efRouting never stores your password — only a revocable access
                    token.
                  </div>
                  <button
                    className="cfm-primary"
                    onClick={() => setStep('syncing')}
                  >
                    Authorize with {tms.name}
                  </button>
                </>
              ) : (
                <>
                  <div className="field">
                    <label>Account / Company ID</label>
                    <div className="field-input">
                      <input placeholder="e.g. ACME-123456" />
                    </div>
                  </div>
                  <div className="field">
                    <label>API token</label>
                    <div className="field-input">
                      <input placeholder="Paste your API token" />
                    </div>
                  </div>
                  <div className="field">
                    <label>Environment</label>
                    <div className="cfm-seg sub">
                      <button className="active">Production</button>
                      <button>Sandbox</button>
                    </div>
                  </div>
                  <button
                    className="cfm-primary"
                    onClick={() => setStep('syncing')}
                  >
                    Connect
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {/* ---------- Syncing ---------- */}
        {step === 'syncing' && (
          <div className="modal-body cfm-center">
            <span className="cfm-circle blue spin">
              <RefreshCw size={30} />
            </span>
            <h3 className="cfm-status-title">Syncing with {tms?.name}</h3>
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
            <h3 className="cfm-status-title">{tms?.name} connected</h3>
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
