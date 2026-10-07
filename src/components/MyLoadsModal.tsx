import { useMemo, useState } from 'react'
import { X, MapPin, Flag, Check, RefreshCw, Undo2, ChevronRight, RotateCcw } from 'lucide-react'
import {
  projectCity, splitLane, hashStr, seededRandom, buildRoutePoints, pointAtFraction,
  NATION_PATH, STATE_MESH_PATH,
} from '../lib/mapGeo'
import { makeStopPoint, missingRealStops, type StopPoint, type TripRow } from '../data'

const miles = (n: number) => `${Math.round(n).toLocaleString()} mi`

// Full GPS trail spans ~36h; the loaded leg sits in the middle third, with an
// empty approach before and an empty departure after (backtracking).
const TRAIL_MIN = 36 * 60
const BASE_CLOCK_MIN = 2 * 60 // trail starts at ~2:00 AM of the pickup day

// Density of the resampled trail — enough points to click anywhere on it.
const TR_N = 60

export interface AssignMiles {
  loaded: number
  thisDH: number // trail before the pickup — this load's deadhead
  nextDH: number // trail after the dropoff — the next load's deadhead
}

export default function MyLoadsModal({
  backlog,
  recent,
  onAssign,
  onClear,
  onClose,
}: {
  backlog: TripRow[]
  recent: TripRow[]
  onAssign: (loadRef: string, pickup: StopPoint | undefined, dropoff: StopPoint | undefined, m?: AssignMiles) => void
  onClear: (loadRef: string) => void
  onClose: () => void
}) {
  const [selId, setSelId] = useState<string | null>(backlog[0]?.loadRef ?? null)
  const load = backlog.find((l) => l.loadRef === selId) ?? null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal ml-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="cfm-title">
            <MapPin size={17} color="var(--blue)" /> My Loads · Assign real stops
          </span>
          <button className="cfm-x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="ml-body">
          {/* ── Left: backlog list + recently completed ── */}
          <aside className="ml-list">
            <div className="ml-list-head">
              {backlog.length} load{backlog.length === 1 ? '' : 's'} missing real stops
            </div>
            <p className="ml-list-sub">
              Terminal loads whose real pickup / drop off weren't auto-detected, so they can't be placed on the timeline.
            </p>
            {backlog.map((l) => {
              const miss = missingRealStops(l)
              return (
                <button
                  key={l.loadRef}
                  className={`ml-row ${selId === l.loadRef ? 'sel' : ''}`}
                  onClick={() => setSelId(l.loadRef)}
                >
                  <div className="ml-row-main">
                    <span className="ml-row-ref">{l.loadRef}</span>
                    <span className="ml-row-lane">{l.lane}</span>
                    <span className="ml-row-meta">
                      {l.truck} · {l.startDate}
                    </span>
                  </div>
                  <span className={`ml-miss ml-miss-${miss}`}>
                    {miss === 'both' ? 'Pickup + drop off' : miss === 'pickup' ? 'Pickup' : 'Drop off'}
                  </span>
                  <ChevronRight size={15} className="ml-row-arrow" />
                </button>
              )
            })}

            {recent.length > 0 && (
              <>
                <div className="ml-recent-head">Recently completed</div>
                {recent.map((l) => (
                  <div key={l.loadRef} className="ml-recent-row">
                    <div className="ml-row-main">
                      <span className="ml-row-ref">{l.loadRef}</span>
                      <span className="ml-row-meta">{l.lane}</span>
                    </div>
                    <button className="ml-undo" onClick={() => onClear(l.loadRef)}>
                      <Undo2 size={12} /> Revert
                    </button>
                  </div>
                ))}
              </>
            )}

            {backlog.length === 0 && recent.length === 0 && (
              <div className="ml-empty">No loads pending — every terminal load has its real stops.</div>
            )}
          </aside>

          {/* ── Right: map / assign ── */}
          {load ? (
            <AssignPane key={load.loadRef} load={load} onAssign={onAssign} onClose={onClose} />
          ) : (
            <div className="ml-pane ml-pane-empty">
              <MapPin size={28} />
              <span>Pick a load on the left to assign its real stops.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── The map/assign pane for one load ─────────────────────────────────────────
function AssignPane({
  load,
  onAssign,
  onClose,
}: {
  load: TripRow
  onAssign: (loadRef: string, pickup: StopPoint | undefined, dropoff: StopPoint | undefined, m?: AssignMiles) => void
  onClose: () => void
}) {
  const [origin, dest] = splitLane(load.lane)
  const seed = hashStr(`${load.truck}|${load.startDate}|${load.lane}|trail`)

  // Trail waypoints: seeded empty start → pickup city → drop city → seeded end.
  const geo = useMemo(() => {
    const r = seededRandom(seed)
    const puAnchor = projectCity(origin)
    const doAnchor = projectCity(dest)
    const a0 = r() * Math.PI * 2
    const a1 = r() * Math.PI * 2
    const start: [number, number] = [puAnchor[0] + Math.cos(a0) * 70, puAnchor[1] + Math.sin(a0) * 70]
    const end: [number, number] = [doAnchor[0] + Math.cos(a1) * 70, doAnchor[1] + Math.sin(a1) * 70]
    const segA = buildRoutePoints(start[0], start[1], puAnchor[0], puAnchor[1], seed)
    const segB = buildRoutePoints(puAnchor[0], puAnchor[1], doAnchor[0], doAnchor[1], seed + 7)
    const segC = buildRoutePoints(doAnchor[0], doAnchor[1], end[0], end[1], seed + 13)
    // Resample each third into equal frac shares so the loaded leg is 0.33..0.66.
    const sampleSeg = (seg: typeof segA, n: number) =>
      Array.from({ length: n }, (_, i) => pointAtFraction(seg, i / (n - 1)).pos)
    const third = Math.round(TR_N / 3)
    const dense = [
      ...sampleSeg(segA, third),
      ...sampleSeg(segB, third).slice(1),
      ...sampleSeg(segC, TR_N - 2 * third + 2).slice(1),
    ]
    return { dense }
  }, [seed, origin, dest])
  const dense = geo.dense
  const N = dense.length - 1

  // Mock total miles across the whole visible trail.
  const TRAIL_MILES = Math.round(Math.max(load.totalMiles, load.loadedMiles) * 1.4)

  // Visible window (frac) into the trail. The user sets its start/end dates
  // with the pickers below; the polyline + stops shown are that slice. The
  // trail's abstract time is mapped to real dates so the pickers can address it.
  const [vis, setVis] = useState<[number, number]>([0.18, 0.82])
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const [monLbl, dayLbl] = load.startDate.split(' ')
  const trailStart = new Date(2026, Math.max(0, MONTHS.indexOf(monLbl)), Number(dayLbl) || 1, 0, BASE_CLOCK_MIN)
  const trailEnd = new Date(trailStart.getTime() + TRAIL_MIN * 60000)
  const dateAt = (frac: number) => new Date(trailStart.getTime() + frac * TRAIL_MIN * 60000)
  const fracOfDate = (d: Date) =>
    Math.min(1, Math.max(0, (d.getTime() - trailStart.getTime()) / (TRAIL_MIN * 60000)))
  const pad2 = (n: number) => String(n).padStart(2, '0')
  const toInput = (d: Date) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  const MIN_GAP = 0.06 // keep a readable window: start/end can't collapse
  const setStart = (str: string) => {
    if (!str) return
    const f = Math.min(fracOfDate(new Date(str)), vis[1] - MIN_GAP)
    setVis([Math.max(0, f), vis[1]])
  }
  const setEnd = (str: string) => {
    if (!str) return
    const f = Math.max(fracOfDate(new Date(str)), vis[0] + MIN_GAP)
    setVis([vis[0], Math.min(1, f)])
  }

  // Detected candidate dwell stops along the trail (positions resolved via ptAt).
  const stops = useMemo(() => [0.22, 0.34, 0.5, 0.66, 0.78].map((f, i) => ({ id: `d${i}`, frac: f })), [])

  // Existing (already-detected) stops are pre-confirmed; the user assigns the
  // missing one(s) but may unlock a detected stop to edit it.
  const [pickup, setPickup] = useState<number | null>(load.realPickup?.frac ?? null)
  const [dropoff, setDropoff] = useState<number | null>(load.realDropoff?.frac ?? null)
  const [editing, setEditing] = useState<Set<'pickup' | 'dropoff'>>(new Set())
  const [busy, setBusy] = useState(false)

  const pickupLocked = !!load.realPickup && !editing.has('pickup')
  const dropoffLocked = !!load.realDropoff && !editing.has('dropoff')
  // Sequential: fill pickup first (unless locked), then dropoff.
  const nextToSet: 'pickup' | 'dropoff' | null =
    !pickupLocked && pickup === null ? 'pickup' : !dropoffLocked && dropoff === null ? 'dropoff' : null

  const timeAt = (frac: number) => {
    const total = Math.round(frac * TRAIL_MIN) + BASE_CLOCK_MIN
    const dayOff = Math.floor(total / 1440)
    const mins = total % 1440
    const h = Math.floor(mins / 60)
    const m = mins % 60
    const h12 = ((h + 11) % 12) + 1
    return `${load.startDate}${dayOff ? ` +${dayOff}d` : ''} · ${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
  }
  const stopAt = (frac: number, kind: 'pickup' | 'dropoff'): StopPoint => {
    const city = frac < 0.5 ? origin : dest
    const base = makeStopPoint(city, load.startDate, frac < 0.5 ? 8 : 16, frac, `${load.loadRef}-${kind}-${Math.round(frac * 100)}`)
    return { ...base, time: timeAt(frac) }
  }

  // Click anywhere on the visible polyline → snap to nearest dense point.
  const pickFrac = (clientFrac: number) => {
    const f = Math.min(vis[1], Math.max(vis[0], clientFrac))
    const idx = Math.round(f * N)
    return idx / N
  }
  const assignPoint = (frac: number) => {
    if (nextToSet === 'pickup') {
      setPickup(frac)
      setEditing((s) => { const n = new Set(s); n.delete('pickup'); return n })
    } else if (nextToSet === 'dropoff') {
      if (pickup !== null && frac <= pickup) return // dropoff must come after pickup
      setDropoff(frac)
      setEditing((s) => { const n = new Set(s); n.delete('dropoff'); return n })
    }
  }
  const resetSel = () => {
    setPickup(load.realPickup?.frac ?? null)
    setDropoff(load.realDropoff?.frac ?? null)
    setEditing(new Set())
  }

  // Viewport fit to the visible slice of the trail.
  const sliceFrom = Math.round(vis[0] * N)
  const sliceTo = Math.round(vis[1] * N)
  const slice = dense.slice(sliceFrom, sliceTo + 1)
  const xs = slice.map((p) => p[0]); const ys = slice.map((p) => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const padX = Math.max((maxX - minX) * 0.3, 40), padY = Math.max((maxY - minY) * 0.3, 40)
  const vbX = minX - padX, vbY = minY - padY, vbW = maxX - minX + padX * 2, vbH = maxY - minY + padY * 2
  const r = vbW * 0.02

  const ptAt = (frac: number) => dense[Math.round(frac * N)]
  const segStr = (fromF: number, toF: number) =>
    dense.slice(Math.round(fromF * N), Math.round(toF * N) + 1).map((p) => p.join(',')).join(' ')

  const bothSet = pickup !== null && dropoff !== null
  const loadedMiles = bothSet ? Math.round(TRAIL_MILES * (dropoff! - pickup!)) : 0
  const thisDH = pickup !== null ? Math.round(TRAIL_MILES * pickup) : 0
  const nextDH = dropoff !== null ? Math.round(TRAIL_MILES * (1 - dropoff!)) : 0

  const doSave = () => {
    setBusy(true)
    const pu = pickup !== null ? stopAt(pickup, 'pickup') : load.realPickup
    const dropo = dropoff !== null ? stopAt(dropoff, 'dropoff') : load.realDropoff
    const m = pu && dropo ? { loaded: loadedMiles, thisDH, nextDH } : undefined
    setTimeout(() => onAssign(load.loadRef, pu, dropo, m), 800)
  }
  // Can save if we set at least one previously-missing stop.
  const canSave = (pickup !== null && (!load.realPickup || editing.has('pickup'))) ||
    (dropoff !== null && (!load.realDropoff || editing.has('dropoff')))

  return (
    <div className="ml-pane">
      <div className="ml-pane-head">
        <span className="ml-pane-ref">{load.loadRef} · {load.lane}</span>
        <span className="ml-pane-prompt">
          {nextToSet === 'pickup' ? 'Tap the real pickup on the trail' :
            nextToSet === 'dropoff' ? 'Now tap the real drop off (after the pickup)' :
              'Both stops set — review and save'}
        </span>
      </div>

      <div className="ml-range">
        <label className="ml-range-field">
          <span className="ml-range-lbl2">From</span>
          <input
            type="datetime-local"
            value={toInput(dateAt(vis[0]))}
            min={toInput(trailStart)}
            max={toInput(trailEnd)}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <span className="ml-range-arrow">→</span>
        <label className="ml-range-field">
          <span className="ml-range-lbl2">To</span>
          <input
            type="datetime-local"
            value={toInput(dateAt(vis[1]))}
            min={toInput(trailStart)}
            max={toInput(trailEnd)}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>

      <div className="ml-map">
        <svg viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`} className="sd-map-canvas" preserveAspectRatio="xMidYMid slice"
          onClick={(e) => {
            // Map click → approximate frac from x across the visible slice.
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
            const relX = (e.clientX - rect.left) / rect.width
            assignPoint(pickFrac(vis[0] + relX * (vis[1] - vis[0])))
          }}>
          <path d={NATION_PATH} fill="var(--surface)" />
          <path d={STATE_MESH_PATH} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={vbW * 0.0016} />

          {/* Trail colored by segment: pre-pickup = this load DH (red),
              pickup→dropoff = loaded (green), post-dropoff = next load DH (amber). */}
          {pickup !== null ? (
            <polyline points={segStr(vis[0], pickup)} fill="none" stroke="var(--red)" strokeWidth={vbW * 0.007}
              strokeDasharray={`${vbW * 0.012} ${vbW * 0.015}`} strokeLinecap="round" />
          ) : null}
          {bothSet && (
            <polyline points={segStr(pickup!, dropoff!)} fill="none" stroke="var(--green)" strokeWidth={vbW * 0.009} strokeLinecap="round" />
          )}
          {dropoff !== null ? (
            <polyline points={segStr(dropoff!, vis[1])} fill="none" stroke="var(--orange)" strokeWidth={vbW * 0.007}
              strokeDasharray={`${vbW * 0.012} ${vbW * 0.015}`} strokeLinecap="round" />
          ) : null}
          {/* Base trail (unassigned part) as a faint guide. */}
          {pickup === null && (
            <polyline points={segStr(vis[0], dropoff ?? vis[1])} fill="none" stroke="var(--text-muted)" strokeWidth={vbW * 0.006}
              strokeDasharray={`${vbW * 0.01} ${vbW * 0.014}`} strokeLinecap="round" opacity={0.6} />
          )}

          {/* Candidate dwell stops within the visible window. */}
          {stops.filter((s) => s.frac >= vis[0] && s.frac <= vis[1]).map((s) => {
            const pos = ptAt(s.frac)
            return (
              <g key={s.id} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); assignPoint(s.frac) }}>
                <circle cx={pos[0]} cy={pos[1]} r={r * 1.5} fill="var(--blue)" opacity={0.16} />
                <circle cx={pos[0]} cy={pos[1]} r={r * 0.85} fill="var(--surface-3)" stroke="var(--blue)" strokeWidth={vbW * 0.005} />
              </g>
            )
          })}

          {/* Pickup marker. */}
          {pickup !== null && (
            <g>
              <circle cx={ptAt(pickup)[0]} cy={ptAt(pickup)[1]} r={r * 1.2} fill="var(--green)" stroke="var(--bg)" strokeWidth={vbW * 0.004} />
              <g transform={`translate(${ptAt(pickup)[0] - r * 0.6},${ptAt(pickup)[1] - r * 0.6})`}>
                <Flag size={r * 1.2} color="var(--bg)" strokeWidth={2.6} />
              </g>
            </g>
          )}
          {/* Dropoff marker. */}
          {dropoff !== null && (
            <g>
              <circle cx={ptAt(dropoff)[0]} cy={ptAt(dropoff)[1]} r={r * 1.2} fill="var(--red)" stroke="var(--bg)" strokeWidth={vbW * 0.004} />
              <g transform={`translate(${ptAt(dropoff)[0] - r * 0.6},${ptAt(dropoff)[1] - r * 0.6})`}>
                <MapPin size={r * 1.2} color="var(--bg)" strokeWidth={2.6} />
              </g>
            </g>
          )}
        </svg>

        {busy && (
          <div className="sd-loading">
            <RefreshCw size={22} className="refresh-spin" />
            <span>Assigning real stops…</span>
            <span className="sd-loading-sub">Recomputing loaded miles and the timeline</span>
          </div>
        )}
      </div>

      {/* Stop cards + locks. */}
      <div className="ml-stops">
        <StopCard
          kind="pickup" label="Real pickup" frac={pickup} locked={pickupLocked}
          stop={pickup !== null ? (editing.has('pickup') || !load.realPickup ? stopAt(pickup, 'pickup') : load.realPickup) : load.realPickup}
          onEdit={() => { setEditing((s) => new Set(s).add('pickup')); setPickup(null) }}
        />
        <StopCard
          kind="dropoff" label="Real drop off" frac={dropoff} locked={dropoffLocked}
          stop={dropoff !== null ? (editing.has('dropoff') || !load.realDropoff ? stopAt(dropoff, 'dropoff') : load.realDropoff) : load.realDropoff}
          onEdit={() => { setEditing((s) => new Set(s).add('dropoff')); setDropoff(null) }}
        />
      </div>

      <div className="ml-foot">
        <div className="ml-foot-summary">
          {bothSet ? (
            <span>
              <b className="op">{miles(loadedMiles)}</b> loaded · <b className="kept">{miles(thisDH)}</b> DH to pickup ·{' '}
              <b className="next">{miles(nextDH)}</b> DH of the next load
            </span>
          ) : (
            <span className="fd-dim">Set the real pickup and drop off to complete this load.</span>
          )}
        </div>
        <div className="ml-foot-actions">
          <button className="sd-reopen" onClick={resetSel}><RotateCcw size={13} /> Reset</button>
          <button className="sd-approve" onClick={onClose}>Cancel</button>
          <button className="sd-cut" disabled={!canSave || busy} onClick={doSave}>
            <Check size={15} strokeWidth={3} /> Save stops
          </button>
        </div>
      </div>
    </div>
  )
}

function StopCard({
  kind, label, frac, locked, stop, onEdit,
}: {
  kind: 'pickup' | 'dropoff'
  label: string
  frac: number | null
  locked: boolean
  stop?: StopPoint
  onEdit: () => void
}) {
  const accent = kind === 'pickup' ? 'var(--green)' : 'var(--red)'
  return (
    <div className={`ml-card ${frac !== null ? 'set' : ''}`}>
      <div className="ml-card-top">
        <span className="ml-card-dot" style={{ background: accent }} />
        <span className="ml-card-label">{label}</span>
        {locked && <span className="ml-card-detected">Detected</span>}
        {locked && <button className="ml-card-edit" onClick={onEdit}>Edit</button>}
      </div>
      {stop && frac !== null ? (
        <div className="ml-card-body">
          <div className="ml-card-street">{stop.street}</div>
          <div className="ml-card-city">{stop.city} {stop.zip} · {stop.country}</div>
          <div className="ml-card-time">{stop.time}</div>
        </div>
      ) : (
        <div className="ml-card-empty">Not set yet — tap the trail.</div>
      )}
    </div>
  )
}
