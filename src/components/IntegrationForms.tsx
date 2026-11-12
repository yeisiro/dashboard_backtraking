import { useState } from 'react'
import { Loader2, AlertCircle, Clock, HelpCircle } from 'lucide-react'
import type { Provider } from '../data'

// Shared by the V2 Connect Fleet wizard and V2 Manage Fleet, so connecting an
// ELD/TMS behaves the same everywhere: credentials are tested before moving on
// (invalid vs. provider-down are told apart), and an unlisted provider becomes
// a request instead of a dead end.

type SourceType = 'eld' | 'tms'
type Validation = 'idle' | 'validating' | 'invalid' | 'timeout'

// Integration terms, kept short: what we read, why, what we never do, and how
// to revoke. Shown from the consent checkbox on every connection (V3).
export function IntegrationTerms({ provider }: { provider: string }) {
  return (
    <div className="it-terms">
      <div className="it-terms-title">efRouting Integration Terms · {provider}</div>
      <ul>
        <li>
          <b>Read-only access.</b> We only read data from {provider}; we never create, edit or delete anything in
          your account.
        </li>
        <li>
          <b>What we read.</b> Vehicles, drivers, trailers, locations, miles, hours and fuel data (ELD), or loads,
          stops and revenue (TMS), for the units you choose to sync.
        </li>
        <li>
          <b>Why.</b> To build your operation in efRouting: profitability, money leakage, fuel savings and route
          recommendations.
        </li>
        <li>
          <b>What we never do.</b> Sell or share your data with third parties, or contact your drivers or customers.
        </li>
        <li>
          <b>You stay in control.</b> Unlink {provider} anytime from Manage Fleet and we stop reading from it right
          away.
        </li>
      </ul>
    </div>
  )
}

// Required consent before connecting (V3). "View terms" expands the terms inline.
export function ConsentCheck({
  provider,
  checked,
  onChange,
}: {
  provider: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="it-consent">
      <label className="it-consent-row">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>
          I authorize efRouting to read data from {provider} under the{' '}
          <button type="button" className="it-link" onClick={() => setOpen((o) => !o)}>
            Integration Terms
          </button>
          .
        </span>
      </label>
      {open && <IntegrationTerms provider={provider} />}
    </div>
  )
}

// Prototype validation: a short "testing the connection" beat, then a result.
// Typing "invalid" or "timeout" in any field previews those error states.
export function CredentialsForm({
  type,
  provider,
  onConnected,
  onAskHelp,
  requireConsent = false,
}: {
  type: SourceType
  provider: Provider
  onConnected: (label: string) => void
  onAskHelp: (providerName: string) => void
  // V3: the org must accept the integration terms before connecting.
  requireConsent?: boolean
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [label, setLabel] = useState('')
  const [validation, setValidation] = useState<Validation>('idle')
  const [consent, setConsent] = useState(false)
  const busy = validation === 'validating'
  const complete =
    provider.fields.every((f) => (values[f.key] ?? '').trim()) && !!label.trim() && (!requireConsent || consent)

  const validate = () => {
    setValidation('validating')
    const typed = Object.values(values).join(' ').toLowerCase()
    setTimeout(() => {
      if (typed.includes('invalid')) return setValidation('invalid')
      if (typed.includes('timeout')) return setValidation('timeout')
      setValidation('idle')
      onConnected(label.trim())
    }, 1400)
  }

  return (
    <>
      <div className="cfm-cred-head">
        <span className="cfm-tms-logo sm">{provider.mono}</span>
        <span>Connect {provider.name}</span>
      </div>
      {provider.fields.map((f) => (
        <div className="field" key={f.key}>
          <label>{f.label}</label>
          <div className="field-input">
            <input
              type={f.secret ? 'password' : 'text'}
              placeholder={f.placeholder}
              value={values[f.key] ?? ''}
              disabled={busy}
              onChange={(e) => {
                setValues((v) => ({ ...v, [f.key]: e.target.value }))
                setValidation('idle')
              }}
            />
          </div>
          {f.hintTemplate ? (
            <span className="cfm-hint">
              Your API URL: <b>{f.hintTemplate.replace('{v}', (values[f.key] || '[company]').trim() || '[company]')}</b>
            </span>
          ) : (
            <span className="cfm-oblig">Required</span>
          )}
        </div>
      ))}
      <div className="field">
        <label>Label integration</label>
        <div className="field-input">
          <input
            type="text"
            placeholder="Enter the label"
            value={label}
            disabled={busy}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <span className="cfm-oblig">Required</span>
      </div>

      {requireConsent && <ConsentCheck provider={provider.name} checked={consent} onChange={setConsent} />}

      {validation === 'invalid' && (
        <div className="cfm-alert err">
          <AlertCircle size={16} />
          <div>
            <div className="cfm-alert-title">We couldn&apos;t connect to {provider.name}</div>
            <div className="cfm-alert-body">
              {provider.name} rejected these credentials. Check that they&apos;re correct and have read access, then
              try again.
            </div>
            <button className="cfm-alert-link" onClick={() => onAskHelp(provider.name)}>
              Still not working? Ask our team to set it up
            </button>
          </div>
        </div>
      )}
      {validation === 'timeout' && (
        <div className="cfm-alert warn">
          <Clock size={16} />
          <div>
            <div className="cfm-alert-title">{provider.name} didn&apos;t respond</div>
            <div className="cfm-alert-body">This isn&apos;t a problem with your credentials. Try again in a moment.</div>
          </div>
        </div>
      )}

      <button className="cfm-primary" disabled={!complete || busy} onClick={validate}>
        {busy ? (
          <span className="cfm-validating">
            <Loader2 size={15} className="cfm-spin" /> Testing connection…
          </span>
        ) : validation === 'timeout' ? (
          'Try again'
        ) : (
          `Connect ${type === 'eld' ? 'ELD' : 'TMS'}`
        )}
      </button>
    </>
  )
}

// "My provider isn't listed": captures the provider name and hands it back so
// the caller can open a request.
export function UnsupportedForm({
  type,
  note,
  prefill = '',
  onSubmit,
}: {
  type: SourceType
  note: string
  prefill?: string
  onSubmit: (providerName: string) => void
}) {
  const [name, setName] = useState(prefill)
  const send = () => name.trim() && onSubmit(name.trim())
  return (
    <>
      <div className="cfm-cred-head">
        <span className="cfm-tms-logo sm">
          <HelpCircle size={15} />
        </span>
        <span>Tell us which {type === 'eld' ? 'ELD' : 'TMS'} you use</span>
      </div>
      <p className="cfm-sub">{note}</p>
      <div className="field">
        <label>{type === 'eld' ? 'ELD provider' : 'TMS provider'}</label>
        <div className="field-input">
          <input
            autoFocus
            type="text"
            placeholder="e.g. Motive, McLeod…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
          />
        </div>
        <span className="cfm-oblig">Required</span>
      </div>
      <button className="cfm-primary" disabled={!name.trim()} onClick={send}>
        Send request
      </button>
    </>
  )
}
