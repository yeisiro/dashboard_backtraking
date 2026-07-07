import { useState } from 'react'
import {
  BarChart3,
  X,
  CheckCircle2,
  ChevronDown,
  Crosshair,
  Maximize2,
  RefreshCw,
  Play,
  ArrowUpRight,
  Minus,
  Check,
  Package,
  TrendingUp,
  Fuel,
  Route,
} from 'lucide-react'
import type { TripRow } from '../data'

const money = (n: number) => '$' + Math.round(n).toLocaleString()

// Split "Atlanta, GA → Orlando, FL" into its two hubs.
function splitLane(lane: string): [string, string] {
  const parts = lane.split('→').map((s) => s.trim())
  return [parts[0] ?? lane, parts[1] ?? '']
}

type Tone = 'green' | 'orange' | 'yellow' | 'red' | 'teal'
const TONE_VAR: Record<Tone, string> = {
  green: '#33DB9E',
  orange: '#FFAC52',
  yellow: '#F5C84B',
  red: '#FF3945',
  teal: '#7CC8CF',
}

// ── Timeline nodes ──────────────────────────────────────────────────────────
type NodeKind = 'radio-teal' | 'minus' | 'x' | 'check' | 'radio-empty'
interface TlEvent {
  kind: NodeKind
  callout?: { label: string; tone: Tone }
  status: string
  badgeTone: Tone | 'gray'
}

function NodeIcon({ kind }: { kind: NodeKind }) {
  if (kind === 'minus')
    return (
      <span className="ld-node ld-node-sq" style={{ background: '#342E26' }}>
        <Minus size={17} color="#FFAC52" strokeWidth={3} />
      </span>
    )
  if (kind === 'x')
    return (
      <span className="ld-node ld-node-sq" style={{ background: '#341D24' }}>
        <X size={17} color="#FF3945" strokeWidth={3} />
      </span>
    )
  if (kind === 'check')
    return (
      <span className="ld-node ld-node-sq" style={{ background: '#1C3736' }}>
        <Check size={17} color="#33DB9E" strokeWidth={3} />
      </span>
    )
  if (kind === 'radio-empty')
    return (
      <span className="ld-node ld-node-radio" style={{ background: '#0E141A' }}>
        <span className="ld-radio-ring" style={{ borderColor: '#9A9A9A' }} />
      </span>
    )
  return (
    <span className="ld-node ld-node-radio" style={{ background: '#233340' }}>
      <span className="ld-radio-dot" />
    </span>
  )
}

const BADGE_STYLE: Record<Tone | 'gray', { bg: string; color: string; border?: string }> = {
  teal: { bg: '#233340', color: '#7CC8CF' },
  orange: { bg: '#342E26', color: '#FFAC52' },
  red: { bg: '#341D24', color: '#FF3945' },
  green: { bg: '#1C3736', color: '#33DB9E' },
  yellow: { bg: '#342E26', color: '#F5C84B' },
  gray: { bg: '#0E141A', color: '#9A9A9A', border: '#162028' },
}

export default function TripDetailModal({
  trip,
  onClose,
}: {
  trip: TripRow
  onClose: () => void
}) {
  const [origin, dest] = splitLane(trip.lane)
  const [hover, setHover] = useState<number | null>(null)

  const dhMiles = Math.round(trip.totalMiles - trip.loadedMiles)

  const cards: { q: string; value: React.ReactNode; icon: React.ReactNode }[] = [
    {
      q: 'How much was earned?',
      value: (
        <div className="ld-miles-row">
          <div className="ld-miles-stat">
            <span className="ld-miles-num">${trip.negotiatedRpm.toFixed(2)}</span>
            <span className="ld-miles-lbl">Negotiated RPM</span>
          </div>
          <span className="ld-miles-sep" />
          <div className="ld-miles-stat">
            <span className="ld-miles-num">${trip.executedRpm.toFixed(2)}</span>
            <span className="ld-miles-lbl">Executed RPM</span>
          </div>
        </div>
      ),
      icon: <TrendingUp size={16} />,
    },
    {
      q: 'How much fuel was consumed?',
      value: (
        <div className="ld-miles-row">
          <div className="ld-miles-stat">
            <span className="ld-miles-num">{money(Math.round(trip.cost * 0.38))}</span>
            <span className="ld-miles-lbl">Cost</span>
          </div>
          <span className="ld-miles-sep" />
          <div className="ld-miles-stat">
            <span className="ld-miles-num">{Math.round(trip.totalMiles / trip.mpg)} gal</span>
            <span className="ld-miles-lbl">Gallons</span>
          </div>
        </div>
      ),
      icon: <Fuel size={16} />,
    },
    {
      q: 'How many miles were driven?',
      value: (
        <div className="ld-miles-row">
          <div className="ld-miles-stat">
            <span className="ld-miles-num">{trip.loadedMiles.toLocaleString()}</span>
            <span className="ld-miles-lbl">Loaded</span>
          </div>
          <span className="ld-miles-sep" />
          <div className="ld-miles-stat">
            <span className="ld-miles-num">{dhMiles.toLocaleString()}</span>
            <span className="ld-miles-lbl">Deadhead</span>
          </div>
          <span className="ld-miles-sep" />
          <div className="ld-miles-stat">
            <span className="ld-miles-num">{trip.totalMiles.toLocaleString()}</span>
            <span className="ld-miles-lbl">Total</span>
          </div>
        </div>
      ),
      icon: <Route size={16} />,
    },
  ]

  const events: TlEvent[] = [
    { kind: 'radio-teal', status: 'Completed', badgeTone: 'teal' },
    { kind: 'minus', callout: { label: 'Desvío', tone: 'orange' }, status: 'Completed', badgeTone: 'orange' },
    { kind: 'x', callout: { label: 'Outcome malo', tone: 'red' }, status: 'Completed', badgeTone: 'red' },
    { kind: 'check', callout: { label: 'Outcome bueno', tone: 'green' }, status: 'Completed', badgeTone: 'green' },
    { kind: 'radio-empty', callout: { label: 'No ejecutado', tone: 'orange' }, status: 'Skipped', badgeTone: 'gray' },
    { kind: 'radio-teal', status: 'Completed', badgeTone: 'teal' },
    { kind: 'radio-teal', status: 'Completed', badgeTone: 'teal' },
  ]

  // Cost breakdown segments (share of total lane cost), sorted largest first.
  const COST_SEGMENTS = [
    { label: 'Efficient Miles', pct: 79.9, color: '#2ec86e' },
    { label: 'Loaded Deviation Excess', pct: 13, color: '#d94a35' },
    { label: 'Reposition deadhead', pct: 3.34, color: '#b23a2a' },
    { label: 'PC while loaded', pct: 3.29, color: '#ff6a4d' },
    { label: 'Operative center return', pct: 0.261, color: '#8a3020' },
    { label: 'PC while unloaded', pct: 0.0973, color: '#ff8a5c' },
    { label: 'Deadhead Deviation Excess', pct: 0.0893, color: '#5a2018' },
  ]
  const R = 60
  const C = 2 * Math.PI * R
  let acc = 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal ld-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ld-head">
          <span className="ld-head-title">
            <span className="ld-head-icon">
              <BarChart3 size={28} color="#9A9A9A" />
            </span>
            Operation details
          </span>
          <button className="ld-close" onClick={onClose} aria-label="Close">
            <X size={30} color="#9A9A9A" />
          </button>
        </div>

        <div className="ld-body">
          {/* Route strip */}
          <div className="ld-strip">
            <div className="ld-hub">
              <div className="ld-hub-name">{origin}</div>
            </div>
            <div className="ld-route-mid">
              <span className="ld-distance">{trip.loadedMiles.toLocaleString()} mi</span>
              <span className="ld-route-track">
                <span className="ld-route-dot" />
                <span className="ld-route-arrow">→</span>
              </span>
            </div>
            <div className="ld-hub">
              <div className="ld-hub-name">{dest}</div>
            </div>
            <div className="ld-loadid">
              <span className="ld-loadid-icon">
                <Package size={22} color="#7CC8CF" />
              </span>
              <div className="ld-loadid-txt">
                <div className="ld-loadid-val">L00000000</div>
                <div className="ld-loadid-sub">Load id</div>
              </div>
            </div>
            <span className="ld-status-pill">
              <CheckCircle2 size={20} /> Completed
            </span>
          </div>

          {/* Top: cost summary + metric grid + map */}
          <div className="ld-top">
            <section className="ld-card ld-cost">
              <div className="ld-card-head">
                <span className="ld-cost-title">Lane Cost Summary</span>
                <BarChart3 size={18} color="#686868" />
              </div>
              <div className="ld-cost-chart">
                <div className="ld-donut2">
                  <svg viewBox="0 0 160 160">
                    {COST_SEGMENTS.map((s, i) => {
                      const len = (s.pct / 100) * C
                      const offset = -acc
                      acc += len
                      const dimmed = hover !== null && hover !== i
                      return (
                        <circle
                          key={s.label}
                          cx="80"
                          cy="80"
                          r={R}
                          fill="none"
                          stroke={s.color}
                          strokeWidth="26"
                          strokeDasharray={`${len} ${C - len}`}
                          strokeDashoffset={offset}
                          transform="rotate(-90 80 80)"
                          opacity={dimmed ? 0.3 : 1}
                          className="ld-donut2-seg"
                          onMouseEnter={() => setHover(i)}
                          onMouseLeave={() => setHover(null)}
                        />
                      )
                    })}
                  </svg>
                  <div className="ld-donut2-center">
                    {hover !== null ? (
                      <>
                        <span className="ld-donut2-total" style={{ color: COST_SEGMENTS[hover].color }}>
                          {COST_SEGMENTS[hover].pct < 1
                            ? COST_SEGMENTS[hover].pct.toFixed(2)
                            : Math.round(COST_SEGMENTS[hover].pct)}
                          %
                        </span>
                        <span className="ld-donut2-label">{COST_SEGMENTS[hover].label}</span>
                      </>
                    ) : (
                      <>
                        <span className="ld-donut2-total">{money(trip.totalCost)}</span>
                        <span className="ld-donut2-label">Total</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="ld-legend">
                  {COST_SEGMENTS.map((s, i) => (
                    <div
                      className={`ld-legend-row ${hover === i ? 'active' : ''}`}
                      key={s.label}
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                    >
                      <span className="ld-legend-name">
                        <span className="ld-legend-dot" style={{ background: s.color }} />
                        {s.label}
                      </span>
                      <span className="ld-legend-pct">{s.pct < 1 ? s.pct.toFixed(2) : Math.round(s.pct)}%</span>
                      <span className="ld-legend-val">{money((trip.totalCost * s.pct) / 100)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <div className="ld-metrics">
              {cards.map((c) => (
                <div className="ld-card ld-metric" key={c.q}>
                  <div className="ld-metric-q">{c.q}</div>
                  <div className="ld-metric-val">{c.value}</div>
                  <div className="ld-metric-foot">
                    <span className="ld-metric-icon">{c.icon}</span>
                  </div>
                </div>
              ))}
            </div>

            <section className="ld-map">
              <div className="ld-map-controls">
                <button className="ld-map-btn ld-map-round">
                  <Crosshair size={16} />
                </button>
                <button className="ld-map-btn ld-map-view">
                  View <ChevronDown size={14} />
                  <span className="ld-map-badge">1</span>
                </button>
                <button className="ld-map-btn ld-map-full">
                  Open full map <Maximize2 size={14} />
                </button>
              </div>

              <svg viewBox="0 0 400 320" className="ld-map-canvas" preserveAspectRatio="xMidYMid slice">
                <path
                  d="M70 250 C 120 180, 150 200, 190 150 S 260 120, 300 90 C 330 70, 340 130, 300 160 S 240 200, 280 240"
                  className="ld-route-dash"
                />
                <circle cx="70" cy="250" r="7" className="ld-route-stop" />
                <circle cx="190" cy="150" r="7" className="ld-route-stop" />
                <circle cx="300" cy="90" r="10" className="ld-route-truck" />
              </svg>

              <div className="ld-map-eld">
                <div>
                  <div className="ld-eld-title">ELD status</div>
                  <div className="ld-eld-sub">Updated 2 min ago</div>
                </div>
                <span className="ld-eld-synced">Synced</span>
                <button className="ld-eld-update">
                  Update <RefreshCw size={13} />
                </button>
              </div>

              <div className="ld-map-scrub">
                <button className="ld-scrub-play">
                  <Play size={12} fill="currentColor" />
                </button>
                <div className="ld-scrub-track" />
              </div>
            </section>
          </div>

          {/* Timeline */}
          <div className="ld-timeline">
            <div className="ld-tl-line" />
            {events.map((e, i) => {
              const badge = BADGE_STYLE[e.badgeTone]
              return (
                <div className="ld-tl-col" key={i}>
                  <div className="ld-tl-callout-slot">
                    {e.callout && (
                      <div className="ld-tl-callout-wrap">
                        <div className="ld-tl-callout">
                          <div className="ld-callout-txt">
                            <span className="ld-callout-head" style={{ color: TONE_VAR[e.callout.tone] }}>
                              {e.callout.label}
                            </span>
                            <span className="ld-callout-sub">Muy breve explicación</span>
                          </div>
                          <span className="ld-callout-arrow">
                            <ArrowUpRight size={14} color="#9A9A9A" />
                          </span>
                        </div>
                        <span className="ld-callout-stem" />
                      </div>
                    )}
                  </div>
                  <div className="ld-tl-node-slot">
                    <NodeIcon kind={e.kind} />
                  </div>
                  <div className="ld-tl-info">
                    <div className="ld-tl-name">Nombre evento aquí simple</div>
                    <span
                      className="ld-tl-badge"
                      style={{
                        background: badge.bg,
                        color: badge.color,
                        border: badge.border ? `2px solid ${badge.border}` : 'none',
                      }}
                    >
                      {e.status}
                    </span>
                    <div className="ld-tl-desc">Aquí se puede explicar un poquito más del evento</div>
                    <div className="ld-tl-time">16:44 - 12/06/26</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
