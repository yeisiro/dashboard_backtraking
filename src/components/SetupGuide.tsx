import { Check, ChevronDown, ChevronRight, Clock, X, Sparkles, Receipt, ArrowRight } from 'lucide-react'
import {
  ONBOARDING_LOSS,
  type OnboardingGap,
  type OnboardingRequest,
  type OnboardingState,
} from '../data'
import type { SyncState } from './ConnectFleetModal'
import type { WizardTarget } from './ConnectFleetV2'

// V3 setup guide for new accounts. Opens expanded right after sign-up and is
// the interactive path into Connect Fleet: the main button resumes the wizard
// at the first pending step and every item opens the wizard straight at that
// step. It can be minimized to a "Setup x/5" pill (the standing reminder) but
// not closed until the minimum is done. After the sync it switches to what's
// still pending and what the org is missing because of it.

type ItemState = 'todo' | 'done' | 'pending' | 'blocked'
interface Item {
  key: string
  label: string
  state: ItemState
  note?: string
  target: WizardTarget
  minutes: number
  // What the step is for and what to have at hand (shown on the "next step" card).
  why: string
  need?: string
}

export function onboardingGaps(ob: OnboardingState, requests: OnboardingRequest[]): OnboardingGap[] {
  const open = (t: OnboardingRequest['type']) => requests.some((r) => r.type === t && r.status !== 'resolved')
  const gaps: OnboardingGap[] = []
  if (ob.eld?.status === 'unsupported') gaps.push('eld-pending')
  if (ob.tms?.status === 'unsupported') gaps.push('tms-pending')
  if (ob.fuelCard?.kind === 'custom') gaps.push('fuelcard-pending')
  // Transactions count as a gap until they're actually set up (request resolved).
  const txResolved = requests.some((r) => r.type === 'transactions' && r.status === 'resolved')
  if (!txResolved && (ob.syncStarted || open('transactions'))) gaps.push('transactions')
  return gaps
}

export function setupItems(ob: OnboardingState): Item[] {
  const eldBlocked = ob.eld?.status === 'unsupported'
  return [
    {
      key: 'eld',
      label: 'Connect your ELD',
      state: !ob.eld ? 'todo' : ob.eld.status === 'connected' ? 'done' : 'pending',
      note: ob.eld?.status === 'unsupported' ? `${ob.eld.name} · request sent` : ob.eld?.name,
      target: 'eld',
      minutes: 2,
      why: 'Brings in your trucks, drivers, miles, hours and fuel use.',
      need: 'API key from your ELD admin (Samsara or Geotab)',
    },
    {
      key: 'tms',
      label: 'Connect your TMS',
      state: !ob.tms ? 'todo' : ob.tms.status === 'connected' ? 'done' : 'pending',
      note: ob.tms?.status === 'unsupported' ? `${ob.tms.name} · request sent` : ob.tms?.name,
      target: 'tms',
      minutes: 2,
      why: 'Brings in your loads and revenue for profitability and RPM.',
      need: 'API token and company subdomain from Datatruck',
    },
    {
      key: 'fleet',
      label: 'Choose your fleet & data range',
      state: ob.fleetDone && ob.range ? 'done' : 'todo',
      note: ob.fleetDone && ob.range ? `${ob.cabins.length} cabins` : undefined,
      target: ob.fleetDone ? 'range' : 'fleet',
      minutes: 3,
      why: 'Pick the trucks, drivers and trailers to analyze and how much history to pull.',
    },
    {
      key: 'fuel',
      label: 'Pick your fuel card',
      state: !ob.fuelCard ? 'todo' : ob.fuelCard.kind === 'catalog' ? 'done' : 'pending',
      note: !ob.fuelCard
        ? undefined
        : ob.fuelCard.kind === 'catalog'
          ? ob.fuelCard.name
          : `${ob.fuelCard.provider} requested · efRouting meanwhile`,
      target: 'fuel',
      minutes: 1,
      why: 'Fuel savings and leakage are calculated with your card’s stations and discounts.',
    },
    {
      key: 'sync',
      label: 'Start your sync',
      state: ob.syncStarted ? 'done' : eldBlocked ? 'blocked' : 'todo',
      note: eldBlocked && !ob.syncStarted ? 'Waiting for your ELD to be connected' : undefined,
      target: 'review',
      minutes: 1,
      why: 'Review what you connected and start bringing in your operation.',
    },
  ]
}

export default function SetupGuide({
  ob,
  requests,
  sync,
  open,
  onToggle,
  onOpenWizard,
  onShareTransactions,
  onDismiss,
  onTrackRequests,
  resume = false,
}: {
  ob: OnboardingState
  requests: OnboardingRequest[]
  sync: SyncState | null
  open: boolean
  onToggle: (open: boolean) => void
  onOpenWizard: (t: WizardTarget) => void
  onShareTransactions: () => void
  onDismiss: () => void
  // V3: jump to My Company → Setup requests (hidden when already there).
  onTrackRequests?: () => void
  // The wizard was just closed half-way: the guide reopens on the next step.
  resume?: boolean
}) {
  const items = setupItems(ob)
  const covered = items.filter((i) => i.state === 'done' || i.state === 'pending').length
  const total = items.length
  const pct = Math.round((covered / total) * 100)
  const eldBlocked = ob.eld?.status === 'unsupported'
  const gaps = onboardingGaps(ob, requests)
  const txRequested = ob.transactionsContact || requests.some((r) => r.type === 'transactions')
  const openRequests = requests.filter((r) => r.status !== 'resolved').length
  const syncing = !!sync && !sync.done
  const minimumDone = ob.syncStarted
  const allSet = minimumDone && gaps.length === 0

  // The next thing to do: first uncovered item (the review once all are covered).
  const next = items.find((i) => i.state === 'todo')
  const minutesLeft = items.filter((i) => i.state === 'todo').reduce((a, i) => a + i.minutes, 0)

  if (!open) {
    // Minimized: the pill names the next step instead of a bare counter, and
    // nudges every few seconds until the sync starts.
    return (
      <button
        className={`sg-pill ${!minimumDone ? 'todo' : ''}`}
        onClick={() => onToggle(true)}
        aria-label="Open setup guide"
      >
        <svg viewBox="0 0 36 36" className="sg-ring">
          <circle cx="18" cy="18" r="15" />
          <circle cx="18" cy="18" r="15" style={{ strokeDasharray: `${(pct / 100) * 94.2} 94.2` }} />
        </svg>
        {!minimumDone ? (
          <span className="sg-pill-text">
            <b>{next ? `Next: ${next.label}` : eldBlocked ? 'Waiting for your ELD' : 'Start your sync'}</b>
            <span>
              Setup {covered}/{total}
              {minutesLeft > 0 ? ` · ~${minutesLeft} min left` : ''}
            </span>
          </span>
        ) : (
          <span>{allSet ? "You're all set" : `${gaps.length} pending`}</span>
        )}
      </button>
    )
  }

  return (
    <aside className={`sg ${!minimumDone ? 'todo' : ''} ${resume ? 'resume' : ''}`} role="dialog" aria-label="Setup guide">
      <div className="sg-head">
        <span className="sg-head-ico">
          <Sparkles size={15} />
        </span>
        <span className="sg-head-title">
          {allSet ? "You're all set" : minimumDone ? 'Your fleet is connected' : 'Get started with efRouting'}
        </span>
        <span className="sg-head-count">
          {covered}/{total}
        </span>
        <button className="sg-icon" onClick={() => onToggle(false)} aria-label="Minimize setup guide">
          <ChevronDown size={16} />
        </button>
        {minimumDone && (
          <button className="sg-icon" onClick={onDismiss} aria-label="Close setup guide">
            <X size={15} />
          </button>
        )}
      </div>
      <div className="sg-progress">
        <div style={{ width: `${pct}%` }} />
      </div>

      <div className="sg-body">
        {/* Where the data on screen comes from */}
        <p className="sg-lead">
          {!ob.syncStarted
            ? eldBlocked
              ? "You're viewing sample data until your ELD is connected. We'll let you know when it's ready."
              : `You're viewing sample data. About ${Math.max(minutesLeft, 1)} minutes left to see your own operation.`
            : syncing
              ? `Syncing your operation · ${Math.round(sync!.progress)}% — your data fills in as it arrives.`
              : allSet
                ? 'Everything is connected. Your dashboard runs on your own data.'
                : 'Your dashboard now runs on your own data. A few things are still pending:'}
        </p>

        {/* The next step, front and center: what it is, why, how long and what to have at hand. */}
        {!ob.syncStarted && (next || !eldBlocked) && (
          <div className="sg-next">
            <span className="sg-next-kicker">
              {resume ? 'Pick up where you left off' : covered === 0 ? 'Start here' : 'Next step'}
            </span>
            <span className="sg-next-title">{next ? next.label : 'Start your sync'}</span>
            <span className="sg-next-why">{next ? next.why : items[4].why}</span>
            <span className="sg-next-meta">
              <Clock size={12} /> ~{next ? next.minutes : 1} min
              {next?.need && (
                <>
                  <span className="sg-dot" /> You&apos;ll need: {next.need}
                </>
              )}
            </span>
            <button className="sg-cta" onClick={() => onOpenWizard(next ? next.target : 'review')}>
              {next ? (covered === 0 ? 'Connect your fleet' : 'Continue setup') : 'Review and start sync'}{' '}
              <ArrowRight size={15} />
            </button>
            {covered === 0 && <span className="sg-next-foot">Your progress is saved — stop anytime and come back.</span>}
          </div>
        )}

        {/* Minimum checklist (hidden once synced — it's all done by then) */}
        {!minimumDone && (
          <ul className="sg-list">
            {items.map((i) => {
              const clickable = i.state !== 'blocked'
              return (
                <li key={i.key}>
                  <button
                    className={`sg-item ${i.state} ${i.key === next?.key ? 'is-next' : ''}`}
                    disabled={!clickable}
                    onClick={() => clickable && onOpenWizard(i.target)}
                  >
                    <span className="sg-check">
                      {i.state === 'done' ? (
                        <Check size={12} strokeWidth={3} />
                      ) : i.state === 'pending' || i.state === 'blocked' ? (
                        <Clock size={11} />
                      ) : null}
                    </span>
                    <span className="sg-item-main">
                      <span className="sg-item-label">{i.label}</span>
                      {i.note && <span className="sg-item-note">{i.note}</span>}
                    </span>
                    {i.state === 'todo' && <span className="sg-item-time">~{i.minutes} min</span>}
                    {clickable && <ChevronRight size={15} className="sg-item-arrow" />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {/* What's pending and what the org loses because of it */}
        {gaps.filter((g) => g !== 'transactions').length > 0 && (
          <div className="sg-section">
            <span className="sg-section-title">Pending · what you&apos;re missing</span>
            {gaps
              .filter((g) => g !== 'transactions')
              .map((g) => (
                <div className="sg-gap" key={g}>
                  <Clock size={13} />
                  <div>
                    <b>{ONBOARDING_LOSS[g].title}</b>
                    <span>{ONBOARDING_LOSS[g].loss}</span>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Optional: fuel transactions */}
        {minimumDone && !allSet && (
          <div className="sg-section">
            <span className="sg-section-title">Optional · most accurate fuel numbers</span>
            <div className="sg-gap tx">
              <Receipt size={14} />
              <div>
                <b>Share your fuel transactions</b>
                <span>
                  {!txRequested
                    ? `If you skip it: ${ONBOARDING_LOSS.transactions.loss}`
                    : requests.some((r) => r.type === 'transactions' && r.status === 'in-progress')
                      ? "In progress — we're setting it up with you."
                      : "Request sent — we'll reach out to coordinate it with you."}
                </span>
                {!txRequested && (
                  <button className="sg-link" onClick={onShareTransactions}>
                    Contact me to set this up
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {openRequests > 0 && onTrackRequests && (
          <button className="sg-track" onClick={onTrackRequests}>
            Track {openRequests} open request{openRequests === 1 ? '' : 's'} in My Company <ArrowRight size={13} />
          </button>
        )}

        {allSet && (
          <button className="sg-cta ghost" onClick={onDismiss}>
            Hide guide
          </button>
        )}
      </div>
    </aside>
  )
}
