import { ArrowRight, KeyRound, Cable, Truck, Play, Eye, Clock, Loader2 } from 'lucide-react'
import type { OnboardingState } from '../data'
import type { SyncState } from './ConnectFleetModal'
import type { WizardTarget } from './ConnectFleetV2'
import { setupItems } from './SetupGuide'

// V3 · what makes the setup hard to miss (2026-11-13):
//  · SetupWelcome — a one-time start moment right after sign-up, over the
//    dimmed sample dashboard: what's behind it, how long it takes, what to
//    have at hand, and the one button that starts the wizard.
//  · SampleBanner — a full-width strip above the dashboard that says the data
//    is sample data, with the progress and the next step. It can't be closed
//    until the sync starts, then it turns into the sync progress and goes.

const STEPS = [
  { icon: <Cable size={16} />, label: 'Connect your ELD and TMS', min: 4 },
  { icon: <Truck size={16} />, label: 'Choose your fleet and fuel card', min: 4 },
  { icon: <Play size={16} />, label: 'Start your sync', min: 1 },
]

export function SetupWelcome({
  firstName,
  onStart,
  onExplore,
}: {
  firstName: string
  onStart: () => void
  onExplore: () => void
}) {
  return (
    <div className="sw-overlay">
      <div className="sw" role="dialog" aria-label="Welcome">
        <span className="sw-kicker">
          <Eye size={13} /> You&apos;re looking at sample data
        </span>
        <h2 className="sw-title">Welcome, {firstName}. Let&apos;s bring in your own operation.</h2>
        <p className="sw-sub">
          The dashboard behind this shows a sample fleet. Connect yours and it starts filling with your own trucks,
          loads and fuel in about <b>10 minutes</b>.
        </p>

        <ol className="sw-steps">
          {STEPS.map((s, i) => (
            <li key={s.label}>
              <span className="sw-step-n">{i + 1}</span>
              <span className="sw-step-ico">{s.icon}</span>
              <span className="sw-step-label">{s.label}</span>
              <span className="sw-step-min">~{s.min} min</span>
            </li>
          ))}
        </ol>

        <div className="sw-need">
          <KeyRound size={16} />
          <div>
            <b>Have these at hand</b>
            <span>API key of your ELD (Samsara or Geotab) and API token of your TMS (Datatruck).</span>
            <span className="sw-need-dim">
              Don&apos;t have them yet? Start anyway — your progress is saved and you can finish later.
            </span>
          </div>
        </div>

        <div className="sw-actions">
          <button className="sw-secondary" onClick={onExplore}>
            Explore sample data first
          </button>
          <button className="sw-primary" onClick={onStart} autoFocus>
            Connect my fleet <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

export function SampleBanner({
  ob,
  sync,
  onContinue,
  onTrack,
}: {
  ob: OnboardingState
  sync: SyncState | null
  onContinue: (t?: WizardTarget) => void
  onTrack: () => void
}) {
  // While syncing: the sample data is being replaced.
  if (ob.syncStarted) {
    if (!sync || sync.done) return null
    const pct = Math.round(sync.progress)
    return (
      <div className="sb syncing">
        <Loader2 size={17} className="cfm-spin" />
        <div className="sb-main">
          <b>Syncing your operation · {pct}%</b>
          <span>Sample data is being replaced with yours as it arrives, oldest to newest.</span>
        </div>
        <div className="sb-bar">
          <div style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  const items = setupItems(ob)
  const covered = items.filter((i) => i.state === 'done' || i.state === 'pending').length
  const next = items.find((i) => i.state === 'todo')
  const eldBlocked = ob.eld?.status === 'unsupported'
  const minutesLeft = items.filter((i) => i.state === 'todo').reduce((a, i) => a + i.minutes, 0)

  return (
    <div className={`sb ${eldBlocked && !next ? 'wait' : ''}`}>
      <span className="sb-ico">
        <Eye size={17} />
      </span>
      <div className="sb-main">
        <b>You&apos;re viewing sample data</b>
        <span>
          {eldBlocked && !next
            ? "We're setting up your ELD. Your own data replaces this as soon as it's connected."
            : `Connect your fleet to see your own operation — about ${Math.max(minutesLeft, 1)} min left.`}
        </span>
      </div>
      <div className="sb-progress" aria-label={`Setup ${covered} of ${items.length}`}>
        <div className="sb-segs">
          {items.map((i) => (
            <span key={i.key} className={i.state === 'todo' ? '' : i.state === 'done' ? 'done' : 'wait'} />
          ))}
        </div>
        <span className="sb-progress-text">
          {next ? (
            <>
              <Clock size={12} /> Next: {next.label}
            </>
          ) : eldBlocked ? (
            'Waiting for your ELD'
          ) : (
            'Ready to start your sync'
          )}
        </span>
      </div>
      {eldBlocked && !next ? (
        <button className="sb-cta ghost" onClick={onTrack}>
          Track your request
        </button>
      ) : (
        <button className="sb-cta" onClick={() => onContinue(next ? next.target : 'review')}>
          {covered === 0 ? 'Connect your fleet' : next ? 'Continue setup' : 'Start your sync'} <ArrowRight size={15} />
        </button>
      )}
    </div>
  )
}
