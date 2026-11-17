import { useMemo, useState } from 'react'
import { X, MapPin, Flag, Check, RefreshCw, Undo2, ChevronRight, RotateCcw, FileWarning, Truck, Radar, Map as MapIcon, PencilLine } from 'lucide-react'
import {
  projectCity, splitLane, hashStr, seededRandom, buildRoutePoints, pointAtFraction,
  NATION_PATH, STATE_MESH_PATH,
} from '../lib/mapGeo'
import { makeStopPoint, missingRealStops, type StopPoint, type TripRow, type LoadCoreData } from '../data'
import TrailDatePicker from './TrailDatePicker'

const miles = (n: number) => `${Math.round(n).toLocaleString()} mi`

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
  boundsFor,
  onAssign,
  onClear,
  onCorrect,
  trucks,
  places,
  onClose,
}: {
  backlog: TripRow[]
  recent: TripRow[]
  // The trail window a load's real stops can live in: bounded by the previous
  // load's real drop off and the next load's real pickup (no overlap).
  boundsFor: (load: TripRow) => { start: Date; end: Date }
  onAssign: (loadRef: string, pickup: StopPoint | undefined, dropoff: StopPoint | undefined, m?: AssignMiles) => void
  onClear: (loadRef: string) => void
  // Save corrected TMS data and run the detection again. Returns true when the
  // real stops were found with the corrected data (the load leaves the backlog).
  onCorrect: (loadRef: string, data: LoadCoreData) => boolean
  trucks: string[]
  places: string[]
  onClose: () => void
}) {
  const [selId, setSelId] = useState<string | null>(backlog[0]?.loadRef ?? null)
  // A resolved load leaves the backlog: fall through to the next one.
  const load = backlog.find((l) => l.loadRef === selId) ?? backlog[0] ?? null

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
                  className={`ml-row ${load?.loadRef === l.loadRef ? 'sel' : ''}`}
                  onClick={() => setSelId(l.loadRef)}
                >
                  <div className="ml-row-main">
                    <span className="ml-row-ref">{l.loadRef}</span>
                    <span className="ml-row-lane">{l.lane}</span>
                    <span className="ml-row-meta">
                      {l.truck} · {l.startDate}
                      {l.tmsOriginal && <span className="ml-edited">Data edited</span>}
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
                      <span className="ml-row-meta">
                        {l.lane}
                        {l.tmsOriginal && <span className="ml-edited">Detected after fix</span>}
                      </span>
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
            <LoadPane
              key={load.loadRef}
              load={load}
              bounds={boundsFor(load)}
              onAssign={onAssign}
              onCorrect={onCorrect}
              trucks={trucks}
              places={places}
              onClose={onClose}
            />
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

// ── A load with NO real stop detected: the TMS data it was searched with is
// probably wrong (truck, an address or a date). Review that data first, then
// fall back to assigning the stops on the map. Partial detections go straight
// to the map — the data was good enough to find one stop.
function LoadPane({
  load,
  bounds,
  onAssign,
  onCorrect,
  trucks,
  places,
  onClose,
}: {
  load: TripRow
  bounds: { start: Date; end: Date }
  onAssign: (loadRef: string, pickup: StopPoint | undefined, dropoff: StopPoint | undefined, m?: AssignMiles) => void
  onCorrect: (loadRef: string, data: LoadCoreData) => boolean
  trucks: string[]
  places: string[]
  onClose: () => void
}) {
  const noneDetected = missingRealStops(load) === 'both'
  const [mode, setMode] = useState<'fix' | 'map'>(noneDetected ? 'fix' : 'map')
  if (!noneDetected) return <AssignPane load={load} bounds={bounds} onAssign={onAssign} onClose={onClose} />
  return (
    <div className="ml-pane-wrap">
      <div className="ml-mode">
        <button className={mode === 'fix' ? 'active' : ''} onClick={() => setMode('fix')}>
          <PencilLine size={14} /> Review load data
        </button>
        <button className={mode === 'map' ? 'active' : ''} onClick={() => setMode('map')}>
          <MapIcon size={14} /> Assign on the map
        </button>
      </div>
      {mode === 'fix' ? (
        <FixDataPane
          load={load}
          trucks={trucks}
          places={places}
          onCorrect={onCorrect}
          onGoToMap={() => setMode('map')}
          onClose={onClose}
        />
      ) : (
        <AssignPane load={load} bounds={bounds} onAssign={onAssign} onClose={onClose} />
      )}
    </div>
  )
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const toIso = (s: string) => {
  const [mon, d] = s.split(' ')
  return `2026-${String(MONTHS.indexOf(mon) + 1).padStart(2, '0')}-${String(Number(d) || 1).padStart(2, '0')}`
}
const fromIso = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number)
  return `${MONTHS[(m || 1) - 1]} ${d || 1}`
}
const coreOf = (l: TripRow): LoadCoreData => {
  const [origin, destination] = splitLane(l.lane)
  return {
    truck: l.truck,
    origin,
    destination,
    startDate: l.startDate,
    endDate: l.endDate,
    pickupAppt: l.pickupAppt ?? '08:00',
    deliveryAppt: l.deliveryAppt ?? '16:00',
  }
}

function FixDataPane({
  load,
  trucks,
  places,
  onCorrect,
  onGoToMap,
  onClose,
}: {
  load: TripRow
  trucks: string[]
  places: string[]
  onCorrect: (loadRef: string, data: LoadCoreData) => boolean
  onGoToMap: () => void
  onClose: () => void
}) {
  const current = coreOf(load)
  // What the TMS sent originally (before any earlier correction).
  const tms = load.tmsOriginal ?? current
  const [d, setD] = useState<LoadCoreData>(current)
  const [state, setState] = useState<'idle' | 'busy' | 'notfound'>('idle')
  const set = (patch: Partial<LoadCoreData>) => {
    setD((x) => ({ ...x, ...patch }))
    if (state === 'notfound') setState('idle')
  }
  const changed = (Object.keys(d) as (keyof LoadCoreData)[]).some((k) => d[k] !== current[k])
  const datesOk = toIso(d.endDate) >= toIso(d.startDate)

  // Prototype stand-in for the ELD check that backs the hint: another truck of
  // the fleet was at the origin and the destination on these dates.
  const suggested = useMemo(() => {
    const others = trucks.filter((t) => t !== load.truck)
    return others.length ? others[hashStr(load.loadRef) % others.length] : null
  }, [trucks, load.truck, load.loadRef])

  const save = () => {
    setState('busy')
    setTimeout(() => {
      const found = onCorrect(load.loadRef, d)
      if (!found) setState('notfound')
    }, 1300)
  }

  const fieldNote = (k: keyof LoadCoreData, label?: string) =>
    d[k] !== tms[k] ? (
      <span className="ml-fix-tms">
        TMS: {label ?? tms[k]}
        <button type="button" onClick={() => set({ [k]: tms[k] } as Partial<LoadCoreData>)}>
          <Undo2 size={11} /> Use TMS value
        </button>
      </span>
    ) : null

  return (
    <div className="ml-pane ml-fix">
      <div className="ml-pane-head">
        <span className="ml-pane-ref">
          {load.loadRef} · {load.lane}
        </span>
      </div>

      <div className="ml-fix-why">
        <FileWarning size={17} />
        <div>
          <b>No real stop was detected for this load</b>
          <span>
            We searched for {current.truck} at {current.origin} on {current.startDate} and at {current.destination} on{' '}
            {current.endDate}, and didn&apos;t find it. That usually means the TMS sent a typo in the truck, an
            address or a date. Fix it here and we&apos;ll run the detection again.
          </span>
        </div>
      </div>

      {suggested && d.truck === current.truck && (
        <div className="ml-fix-hint">
          <Radar size={15} />
          <span>
            <b>{suggested}</b> was at {current.origin} on {current.startDate} and at {current.destination} on{' '}
            {current.endDate}. Was it the truck that ran this load?
          </span>
          <button onClick={() => set({ truck: suggested })}>
            <Truck size={13} /> Use {suggested}
          </button>
        </div>
      )}

      <div className="ml-fix-grid">
        <label className="ml-fix-field">
          <span className="ml-fix-lbl">Truck</span>
          <select value={d.truck} onChange={(e) => set({ truck: e.target.value })}>
            {trucks.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          {fieldNote('truck')}
        </label>
        <div />

        <label className="ml-fix-field">
          <span className="ml-fix-lbl">
            <span className="ml-fix-dot pu" /> Origin (pickup)
          </span>
          <input list="ml-places" value={d.origin} onChange={(e) => set({ origin: e.target.value })} />
          {fieldNote('origin')}
        </label>
        <label className="ml-fix-field">
          <span className="ml-fix-lbl">Pickup date and appointment</span>
          <span className="ml-fix-dt">
            <input type="date" value={toIso(d.startDate)} onChange={(e) => e.target.value && set({ startDate: fromIso(e.target.value) })} />
            <input type="time" value={d.pickupAppt} onChange={(e) => set({ pickupAppt: e.target.value })} />
          </span>
          {fieldNote('startDate')}
          {fieldNote('pickupAppt')}
        </label>

        <label className="ml-fix-field">
          <span className="ml-fix-lbl">
            <span className="ml-fix-dot do" /> Destination (drop off)
          </span>
          <input list="ml-places" value={d.destination} onChange={(e) => set({ destination: e.target.value })} />
          {fieldNote('destination')}
        </label>
        <label className="ml-fix-field">
          <span className="ml-fix-lbl">Delivery date and appointment</span>
          <span className="ml-fix-dt">
            <input type="date" value={toIso(d.endDate)} onChange={(e) => e.target.value && set({ endDate: fromIso(e.target.value) })} />
            <input type="time" value={d.deliveryAppt} onChange={(e) => set({ deliveryAppt: e.target.value })} />
          </span>
          {fieldNote('endDate')}
          {fieldNote('deliveryAppt')}
          {!datesOk && <span className="ml-fix-err">Delivery can&apos;t be before the pickup.</span>}
        </label>
        <datalist id="ml-places">
          {places.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>

      {state === 'notfound' && (
        <div className="ml-fix-result">
          <FileWarning size={16} />
          <div>
            <b>Still no real stops with the corrected data</b>
            <span>Your corrections were saved. Assign the pickup and drop off on the truck&apos;s trail instead.</span>
          </div>
          <button onClick={onGoToMap}>
            <MapIcon size={13} /> Assign on the map
          </button>
        </div>
      )}

      <div className="ml-fix-note">
        Corrections are saved in efRouting and kept when your TMS syncs again. Your TMS isn&apos;t changed.
      </div>

      <div className="ml-foot">
        <div className="ml-foot-summary">
          <span className="fd-dim">
            {changed ? 'Save to run the detection again with this data.' : 'Change the data that came wrong from the TMS.'}
          </span>
        </div>
        <div className="ml-foot-actions">
          <button className="sd-reopen" onClick={() => { setD(current); setState('idle') }} disabled={!changed}>
            <RotateCcw size={13} /> Reset
          </button>
          <button className="sd-approve" onClick={onClose}>Cancel</button>
          <button className="sd-cut" disabled={!changed || !datesOk || state === 'busy'} onClick={save}>
            <Radar size={15} /> Save & detect again
          </button>
        </div>
      </div>

      {state === 'busy' && (
        <div className="sd-loading">
          <RefreshCw size={22} className="refresh-spin" />
          <span>Detecting real stops…</span>
          <span className="sd-loading-sub">Searching {d.truck}&apos;s trail around the corrected stops and dates</span>
        </div>
      )}
    </div>
  )
}

// ── The map/assign pane for one load ─────────────────────────────────────────
function AssignPane({
  load,
  bounds,
  onAssign,
  onClose,
}: {
  load: TripRow
  bounds: { start: Date; end: Date }
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

  // Visible window (frac) into the trail. The user sets its start/end with the
  // date+time pickers below. The whole trail is bounded by the previous load's
  // real drop off and the next load's real pickup (bounds.start / bounds.end),
  // so any real stop assigned here can never overlap an adjacent load's.
  const [vis, setVis] = useState<[number, number]>([0.18, 0.82])
  const SPAN = Math.max(1, bounds.end.getTime() - bounds.start.getTime())
  const dateAt = (frac: number) => new Date(bounds.start.getTime() + frac * SPAN)
  const fracOfDate = (d: Date) => Math.min(1, Math.max(0, (d.getTime() - bounds.start.getTime()) / SPAN))
  const pad2 = (n: number) => String(n).padStart(2, '0')
  const MIN_GAP = 0.06 // keep a readable window: start/end can't collapse
  const setStart = (d: Date) => setVis(([, b]) => [Math.max(0, Math.min(fracOfDate(d), b - MIN_GAP)), b])
  const setEnd = (d: Date) => setVis(([a]) => [a, Math.min(1, Math.max(fracOfDate(d), a + MIN_GAP))])

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
    const d = dateAt(frac)
    const h12 = ((d.getHours() + 11) % 12) + 1
    return `${d.toLocaleString('en-US', { month: 'short', day: 'numeric' })} · ${h12}:${pad2(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`
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
        <TrailDatePicker label="From" value={dateAt(vis[0])} min={bounds.start} max={dateAt(vis[1] - MIN_GAP)} onChange={setStart} />
        <span className="ml-range-arrow">→</span>
        <TrailDatePicker label="To" value={dateAt(vis[1])} min={dateAt(vis[0] + MIN_GAP)} max={bounds.end} onChange={setEnd} />
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
