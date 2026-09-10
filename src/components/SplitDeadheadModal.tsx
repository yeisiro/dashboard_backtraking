import { useState } from 'react'
import { X, Scissors, ShieldCheck, Check, Flag, Truck, RefreshCw } from 'lucide-react'
import {
  projectCity, splitLane, hashStr, seededRandom, buildRoutePoints, pointAtFraction,
  NATION_PATH, STATE_MESH_PATH,
} from '../lib/mapGeo'
import { DH_APPROVAL_REASONS, type DhApprovalReason, type TripRow } from '../data'

const money = (n: number) => '$' + Math.round(n).toLocaleString()
const miles = (n: number) => `${Math.round(n).toLocaleString()} mi`

const DH_STOP_PLACES = [
  'I-10 Exit 812 · Baytown, TX',
  'US-90 Truck Plaza · Lafayette, LA',
  'I-45 Rest Area · Huntsville, TX',
  'TA Travel Center · Mobile, AL',
  'Pilot #442 · Gulfport, MS',
  "Love's #318 · Slidell, LA",
]

// A focused modal that does one thing: adjust a load's high deadhead by cutting
// part of the empty approach into an operative trip. It shows only the approach
// on the map, with the truck's detected stops as the points to cut at.
export default function SplitDeadheadModal({
  trip,
  dhThreshold,
  onClose,
  onSplit,
  onApprove,
  onReopen,
}: {
  trip: TripRow
  dhThreshold: number
  onClose: () => void
  onSplit: (opMiles: number, opCost: number, opLeak: number, label: string) => void
  onApprove: (reason: DhApprovalReason, note: string) => void
  onReopen?: () => void
}) {
  const dhMiles = Math.round(trip.totalMiles - trip.loadedMiles)
  const [pickup] = splitLane(trip.lane)
  const pickupPos = projectCity(pickup)

  // Seeded empty approach: a start point offset from the pickup, curving in.
  const seed = hashStr(`${trip.truck}|${trip.startDate}|${trip.lane}|dh`)
  const rand = seededRandom(seed)
  const ang = rand() * Math.PI * 2
  const dist = 62 + rand() * 46
  const repoStart: [number, number] = [pickupPos[0] + Math.cos(ang) * dist, pickupPos[1] + Math.sin(ang) * dist]
  const approach = buildRoutePoints(repoStart[0], repoStart[1], pickupPos[0], pickupPos[1], seed)
  const AP_N = 40
  const dense = Array.from({ length: AP_N + 1 }, (_, i) => pointAtFraction(approach, i / AP_N).pos)

  // Four detected stops with address + time along the approach — the division
  // points the operator can cut at.
  const startHour = 5 + Math.floor(rand() * 3)
  const stops = [0.2, 0.4, 0.6, 0.8]
    .map((f, i) => {
      const h = startHour + i * 2 + Math.floor(rand() * 2)
      const mm = Math.floor(rand() * 60)
      const hour12 = ((h + 11) % 12) + 1
      const time = `${hour12}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
      const dwell = 10 + Math.floor(rand() * 40)
      return {
        id: `s${i}`,
        label: `Stop ${i + 1}`,
        frac: f,
        pos: pointAtFraction(approach, f).pos,
        address: DH_STOP_PLACES[(hashStr(`${trip.loadRef}-${i}`) + i) % DH_STOP_PLACES.length],
        time: `Arrived ${time} · ${dwell} min stop`,
        milesFromStart: Math.round(dhMiles * f),
      }
    })

  const [selId, setSelId] = useState<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [reason, setReason] = useState<DhApprovalReason | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'split' | 'approve' | null>(null)

  const sel = stops.find((s) => s.id === selId) ?? null
  const opMiles = sel ? sel.milesFromStart : 0
  const keptDh = dhMiles - opMiles
  const newTotal = trip.totalMiles - opMiles
  const newDhPct = newTotal > 0 ? Math.round(((newTotal - trip.loadedMiles) / newTotal) * 1000) / 10 : 0
  const opCost = Math.round((trip.totalMiles ? trip.cost / trip.totalMiles : 0) * opMiles)
  const opLeak = dhMiles > 0 ? Math.round(trip.totalExcessCost * (opMiles / dhMiles)) : 0

  // Crop the viewBox tightly to the approach.
  const xs = dense.map((p) => p[0])
  const ys = dense.map((p) => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const padX = Math.max((maxX - minX) * 0.35, 40)
  const padY = Math.max((maxY - minY) * 0.35, 40)
  const vbX = minX - padX, vbY = minY - padY
  const vbW = maxX - minX + padX * 2
  const vbH = maxY - minY + padY * 2
  const r = vbW * 0.02
  const cutIdx = sel ? Math.round(AP_N * sel.frac) : AP_N
  const opStr = dense.slice(0, cutIdx + 1).map((p) => p.join(',')).join(' ')
  const keptStr = dense.slice(cutIdx).map((p) => p.join(',')).join(' ')

  const doSplit = () => {
    if (!sel) return
    setBusy('split')
    setTimeout(() => onSplit(opMiles, opCost, opLeak, sel.address.split(' · ')[0]), 900)
  }
  const doApprove = () => {
    if (!reason) return
    setBusy('approve')
    setTimeout(() => onApprove(reason, note), 900)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal sd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="cfm-title">
            <Scissors size={17} color="var(--teal)" /> Adjust deadhead · {trip.loadRef}
          </span>
          <button className="cfm-x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="sd-body">
          {trip.dhApproved ? (
            <div className="sd-approved">
              <span><ShieldCheck size={14} /> Deadhead approved — {trip.dhApprovalReason}</span>
              {onReopen && <button className="sd-reopen" onClick={onReopen}>Reopen review</button>}
            </div>
          ) : null}
          <p className="sd-sub">
            {miles(dhMiles)} empty approach exceeds the {dhThreshold} mi threshold. Click a stop to see
            where and when the truck stopped, then cut the deadhead there — everything before the cut
            becomes an operative trip.
          </p>

          <div className="sd-map">
            <svg viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`} className="sd-map-canvas" preserveAspectRatio="xMidYMid slice">
              <path d={NATION_PATH} fill="var(--surface)" />
              <path d={STATE_MESH_PATH} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={vbW * 0.0016} />
              {/* Two-color split: the kept deadhead is RED (dashed), and once a cut
                  is picked the portion before it — which becomes the operative
                  trip — is GREEN (solid), so the separation reads at a glance. */}
              <polyline points={sel ? keptStr : dense.map((p) => p.join(',')).join(' ')} fill="none"
                stroke="var(--red)" strokeWidth={vbW * 0.008} strokeDasharray={`${vbW * 0.013} ${vbW * 0.016}`}
                strokeLinecap="round" strokeLinejoin="round" />
              {sel && (
                <polyline points={opStr} fill="none" stroke="var(--green)" strokeWidth={vbW * 0.009}
                  strokeLinecap="round" strokeLinejoin="round" />
              )}
              {/* Pickup (load origin). */}
              <g>
                <circle cx={pickupPos[0]} cy={pickupPos[1]} r={r * 1.1} fill="var(--blue)" stroke="var(--bg)" strokeWidth={vbW * 0.004} />
                <g transform={`translate(${pickupPos[0] - r * 0.55},${pickupPos[1] - r * 0.55})`}>
                  <Flag size={r * 1.1} color="var(--bg)" strokeWidth={2.6} />
                </g>
              </g>
              {/* Empty-start marker. */}
              <g>
                <circle cx={repoStart[0]} cy={repoStart[1]} r={r * 0.9} fill="var(--surface-3)" stroke="var(--text-muted)" strokeWidth={vbW * 0.004} />
                <g transform={`translate(${repoStart[0] - r * 0.45},${repoStart[1] - r * 0.45})`}>
                  <Truck size={r * 0.9} color="var(--text-dim)" strokeWidth={2.4} />
                </g>
              </g>
              {/* Detected stops — all always visible as numbered points so it's
                  clear there are options; the picked one turns teal with scissors. */}
              {stops.map((s, i) => {
                const on = selId === s.id
                const show = on || hoverId === s.id
                const cardLines = [s.label, s.address, `${s.time} · ${s.milesFromStart} mi in`]
                const fs = vbW * 0.017
                const cw = Math.max(...cardLines.map((l) => l.length)) * 0.55 * fs + vbW * 0.03
                const ch = fs * 3.4 + vbW * 0.03
                const R = r * (on ? 1.4 : 1.1)
                // Available points are blue; the selected cut point is green.
                const accent = on ? 'var(--green)' : 'var(--blue)'
                return (
                  <g key={s.id} style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoverId(s.id)} onMouseLeave={() => setHoverId(null)}
                    onClick={(e) => { e.stopPropagation(); setSelId(s.id) }}>
                    {/* Soft halo so the point pops off the dark map. */}
                    <circle cx={s.pos[0]} cy={s.pos[1]} r={R * 1.55} fill={accent} opacity={on ? 0.3 : 0.16} />
                    <circle cx={s.pos[0]} cy={s.pos[1]} r={R}
                      fill={on ? 'var(--green)' : 'var(--surface-3)'} stroke={accent} strokeWidth={vbW * 0.006} />
                    {on ? (
                      <g transform={`translate(${s.pos[0] - R * 0.62},${s.pos[1] - R * 0.62})`}>
                        <Scissors size={R * 1.24} color="var(--bg)" strokeWidth={2.6} />
                      </g>
                    ) : (
                      <text x={s.pos[0]} y={s.pos[1]} dominantBaseline="central" textAnchor="middle"
                        fill="var(--blue)" fontSize={R * 1.15} fontWeight={800}>{i + 1}</text>
                    )}
                    {show && (
                      <g transform={`translate(${s.pos[0] - cw / 2},${s.pos[1] - R - vbW * 0.016 - ch})`}>
                        <rect width={cw} height={ch} rx={vbW * 0.012} fill="var(--bg)" stroke={accent} strokeWidth={vbW * 0.0022} />
                        <text x={vbW * 0.015} y={vbW * 0.026} fill={accent} fontSize={fs} fontWeight={700}>{cardLines[0]}</text>
                        <text x={vbW * 0.015} y={vbW * 0.026 + fs * 1.2} fill="var(--text)" fontSize={fs}>{cardLines[1]}</text>
                        <text x={vbW * 0.015} y={vbW * 0.026 + fs * 2.4} fill="var(--text-muted)" fontSize={fs}>{cardLines[2]}</text>
                      </g>
                    )}
                  </g>
                )
              })}
            </svg>

            {busy && (
              <div className="sd-loading">
                <RefreshCw size={22} className="refresh-spin" />
                <span>{busy === 'split' ? 'Splitting the deadhead…' : 'Approving…'}</span>
                <span className="sd-loading-sub">Recomputing the load and syncing trips</span>
              </div>
            )}
          </div>

          <div className="sd-foot">
            <div className="sd-foot-summary">
              {sel ? (
                <span>
                  Cut at <b>{sel.label}</b> → <b className="op">{miles(opMiles)}</b> operative trip · {' '}
                  <b className="kept">{miles(keptDh)}</b> stays with the load ({newDhPct}% DH) · saves {money(opCost)} off the load
                </span>
              ) : (
                <span className="fd-dim">Pick a stop on the map to cut the deadhead, or approve it as-is.</span>
              )}
            </div>
            <div className="sd-foot-actions">
              <button className="sd-approve" onClick={() => setApproving(true)} disabled={!!busy}>
                <ShieldCheck size={14} /> Approve as-is
              </button>
              <button className="sd-cut" disabled={!sel || !!busy} onClick={doSplit}>
                <Check size={15} strokeWidth={3} /> Save changes
              </button>
            </div>
          </div>
        </div>

        {approving && (
          <div className="ld-cat-overlay" onClick={() => setApproving(false)}>
            <div className="ld-cat-modal" onClick={(e) => e.stopPropagation()}>
              <div className="ld-cat-head">
                <span className="ld-cat-title"><ShieldCheck size={16} color="var(--green)" /> Approve deadhead</span>
                <button className="cfm-x" onClick={() => setApproving(false)} aria-label="Cancel"><X size={17} /></button>
              </div>
              <p className="ld-cat-sub">
                Confirm the {miles(dhMiles)} deadhead on {trip.loadRef} is intended. Pick a reason (required);
                add a note if useful.
              </p>
              <div className="ld-cat-list">
                {DH_APPROVAL_REASONS.map((cat) => (
                  <button key={cat} className={`ld-cat-opt ${reason === cat ? 'on' : ''}`} onClick={() => setReason(cat)}>
                    <span className="ld-cat-opt-icon"><Check size={15} strokeWidth={3} /></span>
                    {cat}
                  </button>
                ))}
              </div>
              <textarea className="ld-hist-note" placeholder="Add a note (optional)…" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="ld-split-actions">
                <button className="ld-split-go" disabled={!reason} onClick={doApprove}>
                  <ShieldCheck size={13} /> Approve deadhead
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
