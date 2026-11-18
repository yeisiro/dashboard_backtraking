import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Eye, EyeOff, Check, Circle, Loader2, ArrowLeft, PartyPopper, ArrowRight, Ticket, Search, BadgeCheck, AlertTriangle, Sparkles, Lock } from 'lucide-react'

// V3 onboarding — step 1: account sign-up. Based on the production sign-up
// (efdata.efrouting.com/signup, recorded 2026-11-11): Welcome → work email →
// password → profile → code → company, then the org lands on the dashboard
// with sample data.
//
// V3 refinements over production (2026-11-11 user-test findings 12–16):
//  12 · Back button + "Step X of N" on every step (values are kept).
//  13 · Each step is a form, so Enter submits once the step is valid.
//  14 · Password rules read clearly: unmet = empty circle + readable text,
//       met = green check.
//  15 · The show/hide eye is out of the Tab order (Password → Confirm).
//  16 · Google/Apple pre-fill the name from the provider; only the phone is
//       left to complete.
//
//
// Full production flow (recorded 2026-11-12): … profile → "Check your inbox"
// (6-digit code) → "Let's set up your company" (name + MC/DOT) → "Welcome to
// {company}" → LOG OUT → log in again → "Start your free trial" → "Welcome to
// efRouting!" (mentions billing details never asked for) → lands on My Company.
// V3 keeps the code and company steps and collapses the rest into one screen:
//  · No forced log-out after creating the company — the session continues.
//  · One welcome that also starts the free trial (coupon inline), instead of
//    two celebration screens and a trial gate behind a second log-in.
//  · Lands on the dashboard with sample data + the setup guide, not on an
//    empty My Company with "Connect your fleet" below the fold.
//  · Company name kept as typed (production lower-cases it), correct
//    placeholder, MC and DOT both visible instead of numbered toggles.
//  · Google / Apple skip the code step — the provider already verified it.
//  · MC/DOT is looked up in FMCSA as it's typed: the legal name fills the
//    company name and the other number. Never blocking — a number that isn't
//    found or isn't authorized only warns (production doesn't validate it).
//  · The trial needs no card (confirmed 2026-11-12); its length isn't shown.
//
// Plan step (2026-11-18): after the company is created and before the welcome,
// the org picks how to start — free trial (recommended, no card) or a plan
// from efrouting.com/pricing (Essential / Pro go through a short checkout,
// Business is "Contact sales" and starts the trial meanwhile). The coupon moved
// here from the welcome screen so it applies to whichever option is picked.
// The welcome then confirms the choice and goes straight to the dashboard.
//
// Minimum to create the account (2026-11-18): email, password + terms, code,
// full name and company name. Everything else is marked "Optional" next to its
// label and never blocks Continue — phone and MC/DOT can be added later in My
// Company, the coupon is a link on the welcome screen.
//
// PROTOTYPE: sign-up restrictions are off (2026-11-12) so testing reaches the
// onboarding fast — every step's Continue / Enter works even with empty or
// invalid fields, and blanks fall back to sample account data. The rules and
// messages still render so the screens look as designed. Flip SKIP_VALIDATION
// to false to test the validations again.

export interface SignupAccount {
  name: string
  email: string
  phone: string
  company: string
  mc: string
  dot: string
  coupon: string
  method: 'email' | 'google' | 'apple'
  // How the org started: free trial or a paid plan. `salesContact` = asked
  // for Business pricing (they start on the trial meanwhile).
  plan: PlanId
  salesContact: boolean
}

export type PlanId = 'trial' | 'essential' | 'pro'

// From efrouting.com/pricing (checked 2026-11-18).
export const PLANS: { id: 'essential' | 'pro' | 'business'; name: string; price: number | null; seats: string; perks: string[] }[] = [
  {
    id: 'essential',
    name: 'Essential',
    price: 49,
    seats: '1 dispatcher + 1 driver seat',
    perks: ['Lane rates and route plans', 'Optimized fuel plans', 'Load board and ELD integrations'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 99,
    seats: '2 dispatcher + 5 driver seats',
    perks: ['Everything in Essential', 'Advanced operational analysis and reports', 'Free personalized onboarding'],
  },
  {
    id: 'business',
    name: 'Business',
    price: null,
    seats: 'Seats for your whole team',
    perks: ['Everything in Pro', 'TMS integration and historical analysis', 'Assigned account manager'],
  },
]
export const planLabel = (p: PlanId) => (p === 'trial' ? 'Free trial' : PLANS.find((x) => x.id === p)!.name)

type Step = 'welcome' | 'email' | 'password' | 'profile' | 'verify' | 'company' | 'creating' | 'plan' | 'checkout' | 'ready'
type Method = SignupAccount['method']

const SLOGANS = ['Smarter routes, greater profits.', 'We simplify the complex.', 'The power of always deciding right.']
const RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: 'At least one number', test: (p) => /\d/.test(p) },
  { label: 'At least one lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'At least one special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
  { label: 'At least eight characters long', test: (p) => p.length >= 8 },
]
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SKIP_VALIDATION = true
const SAMPLE_ACCOUNT = {
  name: 'Ana Torres',
  email: 'ana@acmefreight.com',
  company: 'Acme Freight',
}
const CODE_LEN = 6

// PROTOTYPE stand-in for the FMCSA carrier lookup (QCMobile / SAFER). Any 5+
// digit number "finds" a carrier from this pool; a number made of one repeated
// digit (000000) is "not found"; a number ending in 9 is "not authorized".
interface Carrier {
  legalName: string
  city: string
  mc: string
  dot: string
  authorized: boolean
}
const FMCSA_POOL = [
  ['RAPID HAUL LLC', 'Miami, FL'],
  ['BLUE RIDGE TRANSPORT INC', 'Charlotte, NC'],
  ['SUNBELT CARRIERS LLC', 'Houston, TX'],
  ['GREAT PLAINS FREIGHT LLC', 'Omaha, NE'],
  ['COASTLINE LOGISTICS INC', 'Savannah, GA'],
]
function fmcsaLookup(kind: 'mc' | 'dot', num: string): Carrier | null {
  if (/^(\d)\1*$/.test(num)) return null
  const sum = num.split('').reduce((a, c) => a + Number(c), 0)
  const [legalName, city] = FMCSA_POOL[sum % FMCSA_POOL.length]
  const other = String((Number(num) * 7 + 1234567) % 9000000 + 1000000)
  return {
    legalName,
    city,
    mc: kind === 'mc' ? num : other.slice(0, 6),
    dot: kind === 'dot' ? num : other,
    authorized: !num.endsWith('9'),
  }
}
// "RAPID HAUL LLC" → "Rapid Haul LLC"
const SUFFIXES: Record<string, string> = { LLC: 'LLC', LLP: 'LLP', LP: 'LP', USA: 'USA', INC: 'Inc', CO: 'Co' }
function titleCase(legal: string) {
  return legal
    .split(/\s+/)
    .map((w) => SUFFIXES[w] ?? w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ')
}

// Prototype stand-in for what Google / Apple hand back on sign-up.
const SOCIAL_PROFILE: Record<'google' | 'apple', { name: string; email: string; label: string }> = {
  google: { name: 'Ana Torres', email: 'ana.torres@gmail.com', label: 'Google' },
  apple: { name: 'Ana Torres', email: 'ana.torres@icloud.com', label: 'Apple' },
}

// "+1 000 000 0000" — US format, as in production.
function formatPhone(digits: string) {
  const d = digits.slice(0, 10)
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)].filter(Boolean)
  return '+1 ' + parts.join(' ')
}

function Brand() {
  return (
    <div className="su-brand">
      <span className="ef">ef</span>
      <span className="rest">Routing</span>
    </div>
  )
}

export default function SignupV3({ onComplete }: { onComplete: (acct: SignupAccount) => void }) {
  const [step, setStep] = useState<Step>('welcome')
  const [method, setMethod] = useState<Method>('email')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const [terms, setTerms] = useState(false)
  const [name, setName] = useState('')
  const [phoneDigits, setPhoneDigits] = useState('')
  const [slogan, setSlogan] = useState(0)
  const [code, setCode] = useState<string[]>(Array(CODE_LEN).fill(''))
  const [verifying, setVerifying] = useState(false)
  const [resendIn, setResendIn] = useState(60)
  const [resent, setResent] = useState(false)
  const [company, setCompany] = useState('')
  const [mc, setMc] = useState('')
  const [dot, setDot] = useState('')
  // FMCSA lookup on the number typed last.
  const [lastNum, setLastNum] = useState<'mc' | 'dot'>('mc')
  const [lookup, setLookup] = useState<'idle' | 'searching' | 'found' | 'notfound'>('idle')
  const [carrier, setCarrier] = useState<Carrier | null>(null)
  const [nameFromFmcsa, setNameFromFmcsa] = useState(false)
  // Which number FMCSA filled in (so a new lookup can replace it).
  const [autoNum, setAutoNum] = useState<'mc' | 'dot' | null>(null)
  const [couponOpen, setCouponOpen] = useState(false)
  const [coupon, setCoupon] = useState('')
  const [couponApplied, setCouponApplied] = useState(false)
  const [plan, setPlan] = useState<PlanId>('trial')
  // Plan picked for checkout (before paying it isn't the active plan yet).
  const [checkoutPlan, setCheckoutPlan] = useState<'essential' | 'pro'>('essential')
  const [salesContact, setSalesContact] = useState(false)
  const [paying, setPaying] = useState(false)
  const [card, setCard] = useState({ number: '', exp: '', cvc: '', zip: '' })
  const codeRefs = useRef<(HTMLInputElement | null)[]>([])

  // Rotating slogan on the left panel (production cycles three).
  useEffect(() => {
    const t = setInterval(() => setSlogan((s) => (s + 1) % SLOGANS.length), 4000)
    return () => clearInterval(t)
  }, [])

  // Resend countdown on the code step.
  useEffect(() => {
    if (step !== 'verify' || resendIn <= 0) return
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [step, resendIn])

  // FMCSA lookup, debounced, on whichever number was typed last. The legal
  // name fills the company name unless the user already typed their own.
  useEffect(() => {
    if (step !== 'company') return
    const num = lastNum === 'mc' ? mc : dot
    if (num.length < 5) {
      setLookup('idle')
      setCarrier(null)
      return
    }
    // Already showing this carrier (e.g. the other number was just filled in).
    if (carrier && (lastNum === 'mc' ? carrier.mc : carrier.dot) === num) return
    setLookup('searching')
    const t = setTimeout(() => {
      const found = fmcsaLookup(lastNum, num)
      setCarrier(found)
      setLookup(found ? 'found' : 'notfound')
      const other = lastNum === 'mc' ? 'dot' : 'mc'
      const otherVal = other === 'mc' ? mc : dot
      const setOther = other === 'mc' ? setMc : setDot
      if (!found) {
        // Drop what the previous lookup filled in — it belongs to another carrier.
        if (autoNum === other) {
          setOther('')
          setAutoNum(null)
        }
        if (nameFromFmcsa) {
          setCompany('')
          setNameFromFmcsa(false)
        }
        return
      }
      if (!otherVal || autoNum === other) {
        setOther(found[other])
        setAutoNum(other)
      }
      if (!company.trim() || nameFromFmcsa) {
        setCompany(titleCase(found.legalName))
        setNameFromFmcsa(true)
      }
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, lastNum, lastNum === 'mc' ? mc : dot])

  // Short beat while the company is created, then the plan choice.
  useEffect(() => {
    if (step !== 'creating') return
    const t = setTimeout(() => setStep('plan'), 1300)
    return () => clearTimeout(t)
  }, [step])

  const companyName = company.trim() || SAMPLE_ACCOUNT.company
  const finish = () =>
    onComplete({
      name: name.trim() || SAMPLE_ACCOUNT.name,
      email: email.trim() || SAMPLE_ACCOUNT.email,
      // Optional — a skipped phone stays empty (no sample fallback).
      phone: phoneDigits.length === 10 ? formatPhone(phoneDigits) : '',
      company: companyName,
      mc: mc.trim(),
      dot: dot.trim(),
      coupon: couponApplied ? coupon.trim() : '',
      method,
      plan,
      salesContact,
    })

  const startTrial = (sales = false) => {
    setPlan('trial')
    setSalesContact(sales)
    setStep('ready')
  }
  const subscribe = () => {
    if (paying) return
    setPaying(true)
    setTimeout(() => {
      setPaying(false)
      setPlan(checkoutPlan)
      setSalesContact(false)
      setStep('ready')
    }, 1100)
  }
  const checkoutInfo = PLANS.find((p) => p.id === checkoutPlan)!

  // Code entered → short "Verifying…" beat → company step (as production,
  // which verifies on the 6th digit without a button press).
  const verify = (digits: string[]) => {
    if (verifying) return
    if (!SKIP_VALIDATION && digits.join('').length < CODE_LEN) return
    setVerifying(true)
    setTimeout(() => {
      setVerifying(false)
      setStep('company')
    }, 900)
  }
  const setDigit = (i: number, raw: string) => {
    const chars = raw.replace(/\D/g, '')
    if (!chars && raw !== '') return
    const next = [...code]
    // Paste: spread the digits from this box on.
    if (chars.length > 1) {
      chars.slice(0, CODE_LEN - i).split('').forEach((c, k) => (next[i + k] = c))
      setCode(next)
      const last = Math.min(i + chars.length, CODE_LEN) - 1
      codeRefs.current[last]?.focus()
      if (next.every(Boolean)) verify(next)
      return
    }
    next[i] = chars
    setCode(next)
    if (chars && i < CODE_LEN - 1) codeRefs.current[i + 1]?.focus()
    if (next.every(Boolean)) verify(next)
  }

  const emailOk = SKIP_VALIDATION || EMAIL_RE.test(email.trim())
  const rulesOk = RULES.every((r) => r.test(pw))
  const mismatch = pw2.length > 0 && pw2 !== pw
  const passwordOk = SKIP_VALIDATION || (rulesOk && pw === pw2 && terms)
  const phoneError = phoneDigits.length > 0 && phoneDigits.length < 10
  // Phone is optional: blank is fine, a half-typed number isn't.
  const profileOk = SKIP_VALIDATION || (!!name.trim() && !phoneError)
  // MC / DOT are optional: only the company name is needed.
  const companyOk = SKIP_VALIDATION || !!company.trim()
  const firstName = name.trim().split(/\s+/)[0] ?? ''
  const isSocial = method !== 'email'

  // 12 · Steps the user goes through for the chosen method.
  // Google / Apple already verified the email, so they skip the code step.
  const flow: Step[] = isSocial
    ? ['profile', 'company', 'plan']
    : ['email', 'password', 'profile', 'verify', 'company', 'plan']
  // Checkout is part of the plan step.
  const stepNo = flow.indexOf(step === 'checkout' ? 'plan' : step) + 1

  const goBack = () => {
    if (step === 'password') return setStep('email')
    if (step === 'profile' && !isSocial) return setStep('password')
    if (step === 'verify') return setStep('profile')
    if (step === 'company') return setStep(isSocial ? 'profile' : 'verify')
    if (step === 'checkout') return setStep('plan')
    // Back to the start: forget what the social provider pre-filled.
    if (isSocial) {
      setName('')
      setEmail('')
    }
    setStep('welcome')
  }

  // 16 · Social sign-up: the provider gives us name + email.
  const social = (m: 'google' | 'apple') => {
    setMethod(m)
    setName(SOCIAL_PROFILE[m].name)
    setEmail(SOCIAL_PROFILE[m].email)
    setStep('profile')
  }

  // 13 · Enter submits a step only when it's valid.
  const submit = (ok: boolean, next: Step) => (e: FormEvent) => {
    e.preventDefault()
    if (ok) setStep(next)
  }

  const stepNav = (
    <div className="su-nav">
      {/* The company already exists on the plan step — nothing to go back to. */}
      {step === 'plan' ? (
        <span />
      ) : (
        <button type="button" className="su-back" onClick={goBack}>
          <ArrowLeft size={15} /> Back
        </button>
      )}
      {flow.length > 1 && (
        <span className="su-stepno">
          Step {stepNo} of {flow.length}
        </span>
      )}
    </div>
  )

  const couponUi = couponApplied ? (
    <span className="su-coupon-ok">
      <Check size={13} strokeWidth={3} /> Coupon {coupon.trim().toUpperCase()} applied
      <button
        type="button"
        className="su-inline-link"
        onClick={() => {
          setCouponApplied(false)
          setCouponOpen(true)
        }}
      >
        Change
      </button>
    </span>
  ) : couponOpen ? (
    <form
      className="su-coupon"
      onSubmit={(e) => {
        e.preventDefault()
        if (coupon.trim()) setCouponApplied(true)
      }}
    >
      <input
        autoFocus
        className="su-input"
        placeholder="Coupon code"
        value={coupon}
        onChange={(e) => setCoupon(e.target.value)}
      />
      <button type="submit" className="su-coupon-btn" disabled={!coupon.trim()}>
        Apply
      </button>
    </form>
  ) : (
    <button type="button" className="su-inline-link su-coupon-link" onClick={() => setCouponOpen(true)}>
      <Ticket size={13} /> Have a coupon code?
    </button>
  )

  return (
    <div className="su">
      {/* ---------- Left brand panel ---------- */}
      <aside className="su-side">
        <div className="su-side-bg" />
        {['profile', 'verify', 'company', 'creating', 'plan', 'checkout', 'ready'].includes(step) ? (
          <>
            <div className="su-side-top">
              <Brand />
            </div>
            <div className="su-side-copy">
              <span className="su-hello">Hello,</span>
              <span className="su-hello">{firstName || SAMPLE_ACCOUNT.name.split(' ')[0]}</span>
              {(step === 'company' || step === 'creating') && company.trim() && (
                <span className="su-side-note">
                  You&apos;re creating a company called <b>{company.trim()}</b>
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="su-side-copy">
            <Brand />
            <span className="su-slogan" key={slogan}>
              {SLOGANS[slogan]}
            </span>
            <span className="su-dots">
              {SLOGANS.map((_, i) => (
                <span key={i} className={i === slogan ? 'on' : ''} />
              ))}
            </span>
          </div>
        )}
      </aside>

      {/* ---------- Right content ---------- */}
      <main className="su-main">
        {step === 'welcome' && (
          <div className="su-col su-welcome">
            <h1 className="su-welcome-title">Welcome to efRouting!</h1>
            <button className="su-btn light" onClick={() => social('google')}>
              <span className="su-g">G</span> Sign up with google
            </button>
            <button className="su-btn light" onClick={() => social('apple')}>
              <span className="su-apple" /> Sign up with apple
            </button>
            <button
              className="su-btn primary"
              onClick={() => {
                setMethod('email')
                setStep('email')
              }}
            >
              Sign up with email
            </button>
            <div className="su-divider">
              <span>Already have an account?</span>
            </div>
            <button className="su-btn dark" title="Log in isn't part of this prototype">
              Log in
            </button>
          </div>
        )}

        {step === 'email' && (
          <form className="su-col" noValidate={SKIP_VALIDATION} onSubmit={submit(emailOk, 'password')}>
            {stepNav}
            <h2 className="su-title lg">Let&apos;s get started!</h2>
            <p className="su-sub">Enter your work email to create your account.</p>
            <label className="su-label" htmlFor="su-email">
              Email
            </label>
            <input
              id="su-email"
              autoFocus
              className="su-input"
              type="email"
              autoComplete="email"
              placeholder="Type your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="su-actions">
              <button type="submit" className="su-continue" disabled={!emailOk}>
                Continue
              </button>
            </div>
          </form>
        )}

        {step === 'password' && (
          <form className="su-col" noValidate={SKIP_VALIDATION} onSubmit={submit(passwordOk, 'profile')}>
            {stepNav}
            <h2 className="su-title">Create your password</h2>
            <label className="su-label" htmlFor="su-pw">
              Password
            </label>
            <div className="su-input-wrap">
              <input
                id="su-pw"
                autoFocus
                className="su-input"
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Type your password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
              />
              {/* 15 · out of the Tab order so Password → Confirm is one Tab */}
              <button
                type="button"
                tabIndex={-1}
                className="su-eye"
                onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
            <label className="su-label" htmlFor="su-pw2">
              Confirm password
            </label>
            <div className={`su-input-wrap ${mismatch ? 'err' : ''}`}>
              <input
                id="su-pw2"
                className="su-input"
                type={showPw2 ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Confirm your password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
              />
              <button
                type="button"
                tabIndex={-1}
                className="su-eye"
                onClick={() => setShowPw2((s) => !s)}
                aria-label={showPw2 ? 'Hide password' : 'Show password'}
              >
                {showPw2 ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
            {mismatch && <span className="su-error">Passwords must match. Enter them correctly again.</span>}
            {/* 14 · unmet = empty circle + readable text, met = green check */}
            <ul className="su-rules" aria-label="Password requirements">
              {RULES.map((r) => {
                const ok = r.test(pw)
                return (
                  <li key={r.label} className={ok ? 'ok' : 'todo'}>
                    {ok ? <Check size={13} strokeWidth={3} /> : <Circle size={11} strokeWidth={2.5} />}
                    <span>{r.label}</span>
                    <span className="su-sr">{ok ? '(met)' : '(missing)'}</span>
                  </li>
                )
              })}
            </ul>
            <label className="su-terms">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
              <span>
                I agree to efRouting <u>Terms of Service</u> and <u>Privacy Policy</u>
              </span>
            </label>
            <div className="su-actions">
              <button type="submit" className="su-continue" disabled={!passwordOk}>
                Continue
              </button>
            </div>
          </form>
        )}

        {step === 'profile' && (
          <form className="su-col" noValidate={SKIP_VALIDATION} onSubmit={submit(profileOk, isSocial ? 'company' : 'verify')}>
            {stepNav}
            <h2 className="su-title">Let&apos;s personalize your profile</h2>
            {isSocial && (
              <div className="su-social-note">
                <Check size={13} strokeWidth={3} />
                Signed up with {SOCIAL_PROFILE[method as 'google' | 'apple'].label} · <b>{email}</b>
              </div>
            )}
            <label className="su-label" htmlFor="su-name">
              Full name
            </label>
            <input
              id="su-name"
              autoFocus={!isSocial}
              className="su-input"
              autoComplete="name"
              placeholder="Type your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {isSocial && <span className="su-hint">From your {SOCIAL_PROFILE[method as 'google' | 'apple'].label} account — edit it if needed.</span>}
            <label className="su-label" htmlFor="su-phone">
              Phone number <span className="su-opt">Optional</span>
            </label>
            <input
              id="su-phone"
              autoFocus={isSocial}
              className={`su-input ${phoneError ? 'err' : ''}`}
              inputMode="numeric"
              autoComplete="tel"
              placeholder="+1"
              value={phoneDigits ? formatPhone(phoneDigits) : ''}
              onChange={(e) => setPhoneDigits(e.target.value.replace(/^\+1\s?/, '').replace(/\D/g, '').slice(0, 10))}
            />
            {phoneError ? (
              <span className="su-error">Phone number must be 10 digits — or leave it blank.</span>
            ) : (
              <span className="su-hint">Only so our team can help you during setup. You can add it later.</span>
            )}
            <div className="su-actions">
              <button type="submit" className="su-continue" disabled={!profileOk}>
                Continue
              </button>
            </div>
          </form>
        )}

        {step === 'verify' && (
          <form
            className="su-col"
            noValidate={SKIP_VALIDATION}
            onSubmit={(e) => {
              e.preventDefault()
              verify(code)
            }}
          >
            {stepNav}
            <h2 className="su-title lg">Check your inbox</h2>
            <p className="su-sub">
              We&apos;ve sent a 6-digit code to <b className="su-strong">{email.trim() || SAMPLE_ACCOUNT.email}</b>.
              Enter it below to verify.{' '}
              <button type="button" className="su-inline-link" onClick={() => setStep('email')}>
                Wrong email?
              </button>
            </p>
            <div className="su-code" role="group" aria-label="Verification code">
              {code.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    codeRefs.current[i] = el
                  }}
                  autoFocus={i === 0}
                  className="su-code-box"
                  inputMode="numeric"
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  aria-label={`Digit ${i + 1}`}
                  value={d}
                  disabled={verifying}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !d && i > 0) codeRefs.current[i - 1]?.focus()
                  }}
                />
              ))}
            </div>
            <div className="su-code-status">
              {verifying ? (
                <>
                  <Loader2 size={13} className="cfm-spin" /> Verifying…
                </>
              ) : (
                <span className="su-hint">Tip: you can paste the whole code. It&apos;s also in the email subject.</span>
              )}
            </div>
            <div className="su-resend">
              {resendIn > 0 ? (
                <span>
                  {resent ? 'New code sent. ' : ''}You can request a code again in {resendIn} seconds.
                </span>
              ) : (
                <button
                  type="button"
                  className="su-inline-link"
                  onClick={() => {
                    setResent(true)
                    setResendIn(60)
                  }}
                >
                  Resend code
                </button>
              )}
            </div>
            <div className="su-actions">
              <button type="submit" className="su-continue" disabled={verifying}>
                Verify
              </button>
            </div>
          </form>
        )}

        {step === 'company' && (
          <form className="su-col" noValidate={SKIP_VALIDATION} onSubmit={submit(companyOk, 'creating')}>
            {stepNav}
            <h2 className="su-title">Let&apos;s set up your company</h2>
            <label className="su-label" htmlFor="su-company">
              Company name
            </label>
            <input
              id="su-company"
              autoFocus
              className="su-input"
              autoComplete="organization"
              placeholder="Type your company name"
              value={company}
              onChange={(e) => {
                setCompany(e.target.value)
                setNameFromFmcsa(false)
              }}
            />
            {nameFromFmcsa && company.trim() && <span className="su-hint">From FMCSA — edit it if you use a different name.</span>}
            <span className="su-label">
              MC or DOT number <span className="su-opt">Optional</span>
            </span>
            <span className="su-hint top">
              Add one and we&apos;ll verify your company in FMCSA. Don&apos;t have it handy? Skip it — you can add
              it later in My Company.
            </span>
            <div className="su-row2">
              <div>
                <label className="su-mini" htmlFor="su-mc">
                  MC number
                </label>
                <input
                  id="su-mc"
                  className="su-input"
                  inputMode="numeric"
                  placeholder="e.g. 123456"
                  value={mc}
                  onChange={(e) => {
                    setMc(e.target.value.replace(/\D/g, '').slice(0, 8))
                    setLastNum('mc')
                    if (autoNum === 'mc') setAutoNum(null)
                  }}
                />
              </div>
              <div>
                <label className="su-mini" htmlFor="su-dot">
                  DOT number
                </label>
                <input
                  id="su-dot"
                  className="su-input"
                  inputMode="numeric"
                  placeholder="e.g. 1234567"
                  value={dot}
                  onChange={(e) => {
                    setDot(e.target.value.replace(/\D/g, '').slice(0, 8))
                    setLastNum('dot')
                    if (autoNum === 'dot') setAutoNum(null)
                  }}
                />
              </div>
            </div>

            {lookup === 'searching' && (
              <div className="su-fmcsa searching">
                <Loader2 size={14} className="cfm-spin" /> Looking up {lastNum === 'mc' ? 'MC' : 'DOT'}{' '}
                {lastNum === 'mc' ? mc : dot} in FMCSA…
              </div>
            )}
            {lookup === 'found' && carrier && (
              <div className={`su-fmcsa ${carrier.authorized ? 'found' : 'warn'}`}>
                {carrier.authorized ? <BadgeCheck size={16} /> : <AlertTriangle size={15} />}
                <div>
                  <b>{carrier.legalName}</b>
                  <span>
                    {carrier.city} · MC {carrier.mc} · DOT {carrier.dot} ·{' '}
                    {carrier.authorized ? 'Authorized' : 'Not authorized'}
                  </span>
                  {!carrier.authorized && (
                    <span className="su-fmcsa-note">
                      FMCSA shows this authority as inactive. You can continue — check it&apos;s the right number.
                    </span>
                  )}
                  {company.trim() && company.trim() !== titleCase(carrier.legalName) && (
                    <button
                      type="button"
                      className="su-inline-link"
                      onClick={() => {
                        setCompany(titleCase(carrier.legalName))
                        setNameFromFmcsa(true)
                      }}
                    >
                      Use this name
                    </button>
                  )}
                </div>
              </div>
            )}
            {lookup === 'notfound' && (
              <div className="su-fmcsa warn">
                <Search size={15} />
                <div>
                  <b>We couldn&apos;t find this number in FMCSA</b>
                  <span>Check it, or leave it blank and continue — you can add it later in My Company.</span>
                </div>
              </div>
            )}

            <div className="su-actions">
              <button type="submit" className="su-continue" disabled={!companyOk}>
                Create company
              </button>
            </div>
            {/* The dashboard comes after the plan step — don't promise it here. */}
            <span className="su-hint su-next">Next: start your free trial or choose a plan.</span>
          </form>
        )}

        {step === 'creating' && (
          <div className="su-col su-creating">
            <Loader2 size={26} className="cfm-spin" />
            <span>Creating {companyName}…</span>
          </div>
        )}

        {step === 'plan' && (
          <div className="su-col su-col-wide">
            {stepNav}
            <h2 className="su-title">Choose how to start</h2>
            <p className="su-sub">
              {companyName} is ready. Try everything free — no card needed — or pick a plan now. You can change it
              anytime from My Company.
            </p>

            <div className="su-trial">
              <span className="su-trial-ico">
                <Sparkles size={18} />
              </span>
              <div className="su-trial-main">
                <span className="su-trial-tag">Recommended</span>
                <b>Start your free trial</b>
                <span>Full access to efRouting with your own fleet. No card needed.</span>
              </div>
              <button type="button" autoFocus className="su-continue" onClick={() => startTrial()}>
                Start free trial
              </button>
            </div>

            <div className="su-plans-divider">
              <span>Or subscribe now</span>
            </div>
            <div className="su-plans">
              {PLANS.map((p) => (
                <div className={`su-plan ${p.id === 'pro' ? 'featured' : ''}`} key={p.id}>
                  <span className="su-plan-name">{p.name}</span>
                  <span className="su-plan-price">
                    {p.price !== null ? (
                      <>
                        ${p.price}
                        <small>/month</small>
                      </>
                    ) : (
                      <small className="su-plan-contact">Contact for pricing</small>
                    )}
                  </span>
                  <span className="su-plan-seats">{p.seats}</span>
                  <ul>
                    {p.perks.map((k) => (
                      <li key={k}>
                        <Check size={12} strokeWidth={3} />
                        {k}
                      </li>
                    ))}
                  </ul>
                  {p.id === 'business' ? (
                    <button type="button" className="su-plan-btn" onClick={() => startTrial(true)}>
                      Contact sales
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="su-plan-btn"
                      onClick={() => {
                        setCheckoutPlan(p.id as 'essential' | 'pro')
                        setStep('checkout')
                      }}
                    >
                      Choose {p.name}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <span className="su-hint su-plans-note">
              Contact sales starts your free trial right away — our team reaches out about Business pricing.
            </span>
            <div className="su-plans-coupon">{couponUi}</div>
          </div>
        )}

        {step === 'checkout' && (
          <form
            className="su-col"
            noValidate={SKIP_VALIDATION}
            onSubmit={(e) => {
              e.preventDefault()
              subscribe()
            }}
          >
            {stepNav}
            <h2 className="su-title">Subscribe to {checkoutInfo.name}</h2>
            <div className="su-summary">
              <div>
                <b>{checkoutInfo.name} plan</b>
                <span>{checkoutInfo.seats} · billed monthly</span>
              </div>
              <span className="su-summary-price">${checkoutInfo.price}/mo</span>
            </div>
            {couponApplied && (
              <div className="su-summary-line">
                <span>Coupon {coupon.trim().toUpperCase()}</span>
                <span>Applied at checkout</span>
              </div>
            )}
            <span className="su-label">Payment details</span>
            <input
              className="su-input"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="Card number"
              value={card.number}
              onChange={(e) => setCard({ ...card, number: e.target.value })}
            />
            <div className="su-row2 su-card-row">
              <input
                className="su-input"
                autoComplete="cc-exp"
                placeholder="MM / YY"
                value={card.exp}
                onChange={(e) => setCard({ ...card, exp: e.target.value })}
              />
              <input
                className="su-input"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="CVC"
                value={card.cvc}
                onChange={(e) => setCard({ ...card, cvc: e.target.value })}
              />
            </div>
            <input
              className="su-input su-card-row"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="Billing ZIP code"
              value={card.zip}
              onChange={(e) => setCard({ ...card, zip: e.target.value })}
            />
            <span className="su-hint su-secure">
              <Lock size={12} /> Secure payment. Cancel or change your plan anytime from My Company.
            </span>
            <div className="su-actions su-actions-split">
              <button type="button" className="su-inline-link" onClick={() => startTrial()}>
                Start free trial instead
              </button>
              <button type="submit" className="su-continue" disabled={paying}>
                {paying ? (
                  <>
                    <Loader2 size={13} className="cfm-spin" /> Processing…
                  </>
                ) : (
                  `Subscribe · $${checkoutInfo.price}/month`
                )}
              </button>
            </div>
          </form>
        )}

        {step === 'ready' && (
          <div className="su-col su-ready">
            <span className="su-ready-ico">
              <PartyPopper size={30} />
            </span>
            <h2 className="su-ready-title">Welcome to {companyName} on efRouting!</h2>
            <p className="su-ready-sub">
              {plan === 'trial'
                ? 'Your free trial is active — no card needed.'
                : `Your ${planLabel(plan)} plan is active.`}{' '}
              You&apos;ll start with sample data so you can look around, and we&apos;ll guide you to connect your fleet
              to see your own operation.
            </p>
            <ul className="su-ready-list">
              <li>
                <Check size={13} strokeWidth={3} /> Account created and email verified
              </li>
              <li>
                <Check size={13} strokeWidth={3} /> {companyName}
                {mc.trim() ? ` · MC ${mc.trim()}` : ''}
                {dot.trim() ? ` · DOT ${dot.trim()}` : ''}
              </li>
              <li>
                <Check size={13} strokeWidth={3} />
                {plan === 'trial' ? ' Free trial started' : ` ${planLabel(plan)} plan · $${PLANS.find((p) => p.id === plan)!.price}/month`}
                {couponApplied ? ` · coupon ${coupon.trim().toUpperCase()} applied` : ''}
              </li>
              {salesContact && (
                <li>
                  <Check size={13} strokeWidth={3} /> Our sales team will contact you about Business
                </li>
              )}
            </ul>
            <button className="su-continue su-ready-cta" autoFocus onClick={finish}>
              Go to my dashboard <ArrowRight size={15} />
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
