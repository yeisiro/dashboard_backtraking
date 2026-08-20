import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { X, ChevronRight, ChevronUp, ChevronDown, Info } from 'lucide-react'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { FeatureCollection } from 'geojson'
import usTopo from 'us-atlas/states-10m.json'
import { tripRows, type TripRow } from '../data'

const usd = (n: number) => '$' + Math.round(n).toLocaleString()

// idle_gph from the Money Leakage Breakdown's documented Idle Time Cost
// formula (see data.ts's leakBars comment) — Samsara doesn't report idle
// gallons directly, so this configurable rate estimates them.
const IDLE_GPH = 0.8

// A small centered modal for detail that's too much to cram into the
// 320px-wide side panel — reuses the app's standard modal chrome.
function SubDetailModal({
  title,
  onClose,
  children,
  className = '',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal tam-modal ${className}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="cfm-title">{title}</span>
          <button className="cfm-x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

// Small class-color map, local to this file — matches the fleet legend
// (A/B/C/D) used elsewhere, kept private since FullData.tsx's own copy isn't
// exported.
const CLASS_COLOR: Record<TripRow['cls'], string> = {
  A: 'var(--green)',
  B: 'var(--blue)',
  C: 'var(--orange)',
  D: 'var(--red)',
}

function TruckList({ rows, onSelect }: { rows: TripRow[]; onSelect?: (truck: string) => void }) {
  const byTruck = new Map<string, { cls: TripRow['cls']; count: number }>()
  rows.forEach((r) => {
    const cur = byTruck.get(r.truck)
    if (cur) cur.count += 1
    else byTruck.set(r.truck, { cls: r.cls, count: 1 })
  })
  const list = [...byTruck.entries()].sort((a, b) => b[1].count - a[1].count)

  return (
    <div className="tam-sublist">
      {list.map(([truck, info]) => (
        <div
          className={`tam-sublist-row ${onSelect ? 'tam-sublist-row-clickable' : ''}`}
          key={truck}
          onClick={onSelect ? () => onSelect(truck) : undefined}
          role={onSelect ? 'button' : undefined}
          tabIndex={onSelect ? 0 : undefined}
        >
          <span className="tam-sublist-main">
            <span className="fd-class" style={{ background: CLASS_COLOR[info.cls] }}>
              {info.cls}
            </span>
            {truck}
          </span>
          <span className="tam-sublist-sub">
            {info.count} trip{info.count === 1 ? '' : 's'}
            {onSelect && <ChevronRight size={13} className="tam-sublist-arrow" />}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------- Truck Activity Map ----------

// Standard Census state FIPS codes → USPS postal abbreviation + full name.
// us-atlas's topojson only carries the numeric FIPS id per state feature,
// so this lookup is what turns "id: 48" into "TX" / "Texas".
const FIPS_STATE: Record<number, [string, string]> = {
  1: ['AL', 'Alabama'], 2: ['AK', 'Alaska'], 4: ['AZ', 'Arizona'], 5: ['AR', 'Arkansas'],
  6: ['CA', 'California'], 8: ['CO', 'Colorado'], 9: ['CT', 'Connecticut'], 10: ['DE', 'Delaware'],
  11: ['DC', 'District of Columbia'], 12: ['FL', 'Florida'], 13: ['GA', 'Georgia'], 15: ['HI', 'Hawaii'],
  16: ['ID', 'Idaho'], 17: ['IL', 'Illinois'], 18: ['IN', 'Indiana'], 19: ['IA', 'Iowa'],
  20: ['KS', 'Kansas'], 21: ['KY', 'Kentucky'], 22: ['LA', 'Louisiana'], 23: ['ME', 'Maine'],
  24: ['MD', 'Maryland'], 25: ['MA', 'Massachusetts'], 26: ['MI', 'Michigan'], 27: ['MN', 'Minnesota'],
  28: ['MS', 'Mississippi'], 29: ['MO', 'Missouri'], 30: ['MT', 'Montana'], 31: ['NE', 'Nebraska'],
  32: ['NV', 'Nevada'], 33: ['NH', 'New Hampshire'], 34: ['NJ', 'New Jersey'], 35: ['NM', 'New Mexico'],
  36: ['NY', 'New York'], 37: ['NC', 'North Carolina'], 38: ['ND', 'North Dakota'], 39: ['OH', 'Ohio'],
  40: ['OK', 'Oklahoma'], 41: ['OR', 'Oregon'], 42: ['PA', 'Pennsylvania'], 44: ['RI', 'Rhode Island'],
  45: ['SC', 'South Carolina'], 46: ['SD', 'South Dakota'], 47: ['TN', 'Tennessee'], 48: ['TX', 'Texas'],
  49: ['UT', 'Utah'], 50: ['VT', 'Vermont'], 51: ['VA', 'Virginia'], 53: ['WA', 'Washington'],
  54: ['WV', 'West Virginia'], 55: ['WI', 'Wisconsin'], 56: ['WY', 'Wyoming'],
}

const CODE_TO_NAME: Record<string, string> = Object.fromEntries(Object.values(FIPS_STATE))

// A lane string is "Origin City, ST → Dest City, ST". `all` powers the map's
// activity count (either end touching a state counts); `origin`/`dest` split
// a state's trips into outbound (leaving) vs inbound (entering) — a
// same-state trip (both ends in one state) counts as both.
export function parseLane(lane: string): { origin: string | null; dest: string | null; all: string[] } {
  const codes = [...lane.matchAll(/,\s*([A-Z]{2})\b/g)].map((m) => m[1])
  return { origin: codes[0] ?? null, dest: codes[codes.length - 1] ?? codes[0] ?? null, all: [...new Set(codes)] }
}

// Which state code(s) a trip counts toward, given the map's current view:
// Outbound only credits the origin, Inbound only the destination, and All
// credits every state the lane touches (deduped, so a same-state trip still
// counts once there) — same union computeStateStats calls hereRows.
export type MapDirection = 'all' | 'outbound' | 'inbound'
function codesForDirection(lane: string, direction: MapDirection): string[] {
  const parsed = parseLane(lane)
  if (direction === 'outbound') return parsed.origin ? [parsed.origin] : []
  if (direction === 'inbound') return parsed.dest ? [parsed.dest] : []
  return parsed.all
}

const MAP_DIRECTIONS: { key: MapDirection; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'outbound', label: 'Outbound' },
  { key: 'inbound', label: 'Inbound' },
]

// "All" is NOT an average of Outbound and Inbound — it's every trip that
// touches a state counted once (its full income/cost/profit), regardless of
// which end that state is. A same-state trip (both ends the same state)
// still counts only once, same as computeStateStats' hereRows.
const MAP_DIRECTION_EXPLAIN: Record<MapDirection, string> = {
  all: "Counting every trip that touches a state — leaving or arriving — once each.",
  outbound: 'Counting only trips by where they leave from.',
  inbound: 'Counting only trips by where they arrive.',
}

function computeStateCounts(rows: TripRow[], direction: MapDirection): Record<string, number> {
  const counts: Record<string, number> = {}
  rows.forEach((r) => {
    codesForDirection(r.lane, direction).forEach((code) => {
      counts[code] = (counts[code] ?? 0) + 1
    })
  })
  return counts
}

// Same touch-counts-once-per-state rule as computeStateCounts, but summing
// income/cost/profit/leakage instead of just counting. income/profit/leakage
// drive the map's red↔yellow↔green health color (see netMarginPct); cost is
// only for the hover tooltip.
function computeStateHealth(
  rows: TripRow[],
  direction: MapDirection,
): Record<string, { income: number; cost: number; profit: number; leakage: number }> {
  const health: Record<string, { income: number; cost: number; profit: number; leakage: number }> = {}
  rows.forEach((r) => {
    codesForDirection(r.lane, direction).forEach((code) => {
      const cur = health[code] ?? { income: 0, cost: 0, profit: 0, leakage: 0 }
      cur.income += r.income
      cur.cost += r.cost
      cur.profit += r.profit
      cur.leakage += r.totalExcessCost
      health[code] = cur
    })
  })
  return health
}

// The single number the map colors by: profit net of leakage, as a % of
// income — "am I actually coming out ahead here, once what I'm losing to
// leakage is accounted for". >0 means profit outweighs leakage (green
// territory), <0 means leakage is eating more than the profit made (red).
const netMarginPct = (h: { income: number; profit: number; leakage: number }) =>
  h.income > 0 ? ((h.profit - h.leakage) / h.income) * 100 : 0

const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${Math.round(n)}%`

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
type RGB = [number, number, number]
const HEALTH_RED: RGB = [242, 88, 93] // --red
const HEALTH_YELLOW: RGB = [245, 200, 75] // --yellow
const HEALTH_GREEN: RGB = [46, 230, 166] // --green

// Diverging red→yellow→green scale. t in [-1, 1]: -1 is worst (all red), 0 is
// break-even (yellow), 1 is best (all green).
function healthColor(t: number): RGB {
  const clamped = clamp(t, -1, 1)
  const [from, to, localT] =
    clamped <= 0 ? [HEALTH_RED, HEALTH_YELLOW, clamped + 1] : [HEALTH_YELLOW, HEALTH_GREEN, clamped]
  return [
    lerp(from[0], to[0], localT),
    lerp(from[1], to[1], localT),
    lerp(from[2], to[2], localT),
  ]
}

// Fixed anchors for net margin, not the dataset's own min/max — otherwise
// whichever state happens to be "best" this week always renders pure green
// even if its margin is mediocre. -30% nets fully red, break-even is yellow,
// +50% nets fully green; everything else falls proportionally in between.
const MARGIN_RED_AT = -30
const MARGIN_GREEN_AT = 50
const marginToT = (marginPct: number) =>
  marginPct >= 0 ? clamp(marginPct / MARGIN_GREEN_AT, 0, 1) : clamp(marginPct / Math.abs(MARGIN_RED_AT), -1, 0)

const rowKey = (r: TripRow) => `${r.truck}-${r.startDate}-${r.lane}`

interface StateStats {
  code: string
  name: string
  tripsHere: number
  truckCount: number
  income: number
  cost: number
  profit: number
  leakage: number
  hereRows: TripRow[]
  outboundRows: TripRow[]
  inboundRows: TripRow[]
  // Out = trips leaving this state, In = trips arriving here — the split
  // shown directly on the state detail card instead of a combined total.
  incomeOut: number
  incomeIn: number
  costOut: number
  costIn: number
  profitOut: number
  profitIn: number
  leakageOut: number
  leakageIn: number
}

const sumBy = (list: TripRow[], get: (r: TripRow) => number) => list.reduce((sum, r) => sum + get(r), 0)

function computeStateStats(rows: TripRow[], code: string, name: string): StateStats {
  const outboundRows = rows.filter((r) => parseLane(r.lane).origin === code)
  const inboundRows = rows.filter((r) => parseLane(r.lane).dest === code)

  const seen = new Set<string>()
  const hereRows: TripRow[] = []
  ;[...outboundRows, ...inboundRows].forEach((r) => {
    const k = rowKey(r)
    if (!seen.has(k)) {
      seen.add(k)
      hereRows.push(r)
    }
  })

  const income = hereRows.reduce((sum, r) => sum + r.income, 0)
  const cost = hereRows.reduce((sum, r) => sum + r.cost, 0)
  const incomeOut = sumBy(outboundRows, (r) => r.income)
  const incomeIn = sumBy(inboundRows, (r) => r.income)
  const costOut = sumBy(outboundRows, (r) => r.cost)
  const costIn = sumBy(inboundRows, (r) => r.cost)
  return {
    code,
    name,
    tripsHere: hereRows.length,
    truckCount: new Set(hereRows.map((r) => r.truck)).size,
    income,
    cost,
    profit: income - cost,
    leakage: hereRows.reduce((sum, r) => sum + r.totalExcessCost, 0),
    hereRows,
    outboundRows,
    inboundRows,
    incomeOut,
    incomeIn,
    costOut,
    costIn,
    profitOut: incomeOut - costOut,
    profitIn: incomeIn - costIn,
    leakageOut: sumBy(outboundRows, (r) => r.totalExcessCost),
    leakageIn: sumBy(inboundRows, (r) => r.totalExcessCost),
  }
}

function StatBox({
  label,
  value,
  onClick,
}: {
  label: string
  value: string
  onClick?: () => void
}) {
  return (
    <div
      className={`card kpi ${onClick ? 'tam-stat-clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="kpi-head">
        <span className="eyebrow">{label}</span>
        {onClick && <ChevronRight size={13} className="tam-stat-chevron" />}
      </div>
      <div className="kpi-value-row">
        <span className="value">{value}</span>
      </div>
    </div>
  )
}

// Human label for a single direction (never called with 'all').
const DIRECTION_LABEL: Record<'outbound' | 'inbound', string> = { outbound: 'Outbound', inbound: 'Inbound' }

// Income/Profit/Cost/Leakage on the state metrics card split into an Out
// (trips leaving the state) and In (trips arriving) figure side by side when
// the map is showing All — so you can see at a glance whether a state is a
// net exporter or importer of a given metric. When a single direction is
// selected, the opposite figure is always 0 (this state stat only ever holds
// outbound or inbound rows), so it's dropped in favor of one value labeled
// with the direction being viewed.
function DualStatBox({
  label,
  outValue,
  inValue,
  toneOut,
  toneIn,
  direction,
}: {
  label: string
  outValue: string
  inValue: string
  toneOut?: 'pos' | 'neg'
  toneIn?: 'pos' | 'neg'
  direction: MapDirection
}) {
  const toneStyle = (tone?: 'pos' | 'neg') =>
    tone === 'pos' ? { color: 'var(--green)' } : tone === 'neg' ? { color: 'var(--red)' } : undefined

  if (direction !== 'all') {
    const value = direction === 'outbound' ? outValue : inValue
    const tone = direction === 'outbound' ? toneOut : toneIn
    return (
      <div className="card kpi">
        <div className="kpi-head">
          <span className="eyebrow">{label}</span>
        </div>
        <div className="kpi-value-row">
          <span className="value" style={toneStyle(tone)}>
            {value}
          </span>
          <span className="tam-dual-label">{DIRECTION_LABEL[direction]}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="card kpi tam-dual-stat">
      <div className="kpi-head">
        <span className="eyebrow">{label}</span>
      </div>
      <div className="tam-dual-row">
        <div className="tam-dual-metric">
          <span className="tam-dual-value" style={toneStyle(toneOut)}>
            {outValue}
          </span>
          <span className="tam-dual-label">Out</span>
        </div>
        <div className="tam-dual-metric">
          <span className="tam-dual-value" style={toneStyle(toneIn)}>
            {inValue}
          </span>
          <span className="tam-dual-label">In</span>
        </div>
      </div>
    </div>
  )
}

function TripsHereBox({
  stats,
  direction,
  onOpenPlaceTrips,
}: {
  stats: StateStats
  direction: MapDirection
  onOpenPlaceTrips?: (code: string, name: string, direction: MapDirection) => void
}) {
  const count = direction === 'outbound' ? stats.outboundRows.length : direction === 'inbound' ? stats.inboundRows.length : stats.tripsHere
  return (
    <div
      className={`card kpi tam-stat-clickable ${direction === 'all' ? 'tam-dual-stat' : ''}`}
      onClick={() => onOpenPlaceTrips?.(stats.code, stats.name, direction)}
      role="button"
      tabIndex={0}
    >
      <div className="kpi-head">
        <span className="eyebrow">Trips Here</span>
        <span className="info-tip" tabIndex={-1}>
          <ChevronRight size={13} className="tam-stat-chevron" />
          <span className="info-tip-bubble" role="tooltip">
            Opens a new tab with {count} trip{count === 1 ? '' : 's'}{' '}
            {direction === 'outbound'
              ? `leaving ${stats.name}`
              : direction === 'inbound'
                ? `arriving to ${stats.name}`
                : `touching ${stats.name}`}
            , filtered in the Trips tab.
          </span>
        </span>
      </div>
      {direction === 'all' ? (
        <div className="tam-dual-row">
          <div className="tam-dual-metric">
            <span className="tam-dual-value">{stats.outboundRows.length}</span>
            <span className="tam-dual-label">Leaving</span>
          </div>
          <div className="tam-dual-metric">
            <span className="tam-dual-value">{stats.inboundRows.length}</span>
            <span className="tam-dual-label">Arriving</span>
          </div>
        </div>
      ) : (
        <div className="kpi-value-row">
          <span className="value">{count}</span>
          <span className="tam-dual-label">{DIRECTION_LABEL[direction]}</span>
        </div>
      )}
    </div>
  )
}

// Full-width bar (not a side panel) so the map never narrows when a state
// is selected — sits between the direction toggle/legend and the map grid,
// pushing content down instead of squeezing the SVG.
function StateMetricsBar({
  stats,
  direction,
  onClose,
  onSelectTrucks,
  onOpenPlaceTrips,
}: {
  stats: StateStats
  direction: MapDirection
  onClose: () => void
  onSelectTrucks?: (trucks: string[]) => void
  onOpenPlaceTrips?: (code: string, name: string, direction: MapDirection) => void
}) {
  const [subModal, setSubModal] = useState<'trucks' | null>(null)
  const selectOne = (truck: string) => onSelectTrucks?.([truck])

  return (
    <div className="tam-metrics-bar">
      <div className="tam-detail-head">
        <span className="tam-detail-title">
          {stats.name} <span className="tam-detail-code">({stats.code})</span>
        </span>
        <button className="cfm-x" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      {stats.tripsHere === 0 ? (
        <p className="tam-detail-empty">No trips touched this state in the current selection.</p>
      ) : (
        <>
          <div className="tam-metrics-row">
            <StatBox
              label="Trucks Operated"
              value={String(stats.truckCount)}
              onClick={() => setSubModal('trucks')}
            />
            <TripsHereBox stats={stats} direction={direction} onOpenPlaceTrips={onOpenPlaceTrips} />
            <DualStatBox
              label="Income"
              outValue={usd(stats.incomeOut)}
              inValue={usd(stats.incomeIn)}
              toneOut="pos"
              toneIn="pos"
              direction={direction}
            />
            <DualStatBox
              label="Profit"
              outValue={usd(stats.profitOut)}
              inValue={usd(stats.profitIn)}
              toneOut={stats.profitOut >= 0 ? 'pos' : 'neg'}
              toneIn={stats.profitIn >= 0 ? 'pos' : 'neg'}
              direction={direction}
            />
            <DualStatBox label="Cost" outValue={usd(stats.costOut)} inValue={usd(stats.costIn)} direction={direction} />
            <DualStatBox
              label="Leakage"
              outValue={usd(stats.leakageOut)}
              inValue={usd(stats.leakageIn)}
              toneOut="neg"
              toneIn="neg"
              direction={direction}
            />
          </div>

          {subModal === 'trucks' && (
            <SubDetailModal title={`Trucks that operated in ${stats.name}`} onClose={() => setSubModal(null)}>
              <TruckList rows={stats.hereRows} onSelect={onSelectTrucks ? selectOne : undefined} />
            </SubDetailModal>
          )}
        </>
      )}
    </div>
  )
}

const W = 960
const H = 480

function TruckActivityMap({
  rows,
  onSelectTrucks,
  onOpenPlaceTrips,
}: {
  rows: TripRow[]
  onSelectTrucks?: (trucks: string[]) => void
  onOpenPlaceTrips?: (code: string, name: string, direction: MapDirection) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [mapDirection, setMapDirection] = useState<MapDirection>('all')
  const [hover, setHover] = useState<{ code: string; name: string; x: number; y: number; flipX: boolean; flipY: boolean } | null>(
    null,
  )
  // Memoized on `rows` and `mapDirection` — otherwise these recompute to new
  // object references on every render (including the ones hover-tracking
  // triggers), which would retrigger the draw effect below and tear down/
  // rebuild the SVG mid-click, right under the cursor.
  const stateCounts = useMemo(() => computeStateCounts(rows, mapDirection), [rows, mapDirection])
  const stateHealth = useMemo(() => computeStateHealth(rows, mapDirection), [rows, mapDirection])
  const stateMargins = useMemo(
    () => Object.fromEntries(Object.entries(stateHealth).map(([code, h]) => [code, netMarginPct(h)])),
    [stateHealth],
  )
  // The state with the lowest net margin among states with any activity —
  // selected by default so the metrics bar opens on the state that most
  // needs attention, instead of an empty map.
  const worstCode = useMemo(() => {
    const active = Object.keys(stateCounts).filter((code) => stateCounts[code] > 0)
    if (active.length === 0) return null
    return active.reduce((worst, code) => (stateMargins[code] < stateMargins[worst] ? code : worst))
  }, [stateCounts, stateMargins])

  // Only fall back to the worst state when there's no valid manual
  // selection (none yet, or the previously selected state has no trips
  // under the current direction) — a deliberate user click should stick.
  useEffect(() => {
    setSelected((prev) => (prev && (stateCounts[prev] ?? 0) > 0 ? prev : worstCode))
  }, [worstCode])

  const selectedStats = selected ? computeStateStats(rows, selected, CODE_TO_NAME[selected] ?? selected) : null

  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return

    const projection = geoAlbersUsa().scale(1150).translate([W / 2, H / 2])
    const path = geoPath().projection(projection)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topo = usTopo as any
    const states = feature(topo, topo.objects.states) as unknown as FeatureCollection

    const svg = svgEl
    while (svg.firstChild) svg.removeChild(svg.firstChild)
    const ns = 'http://www.w3.org/2000/svg'

    states.features.forEach((f) => {
      const entry = FIPS_STATE[Number(f.id)]
      if (!entry) return
      const [code, name] = entry
      const count = stateCounts[code] ?? 0
      const margin = stateMargins[code] ?? 0
      const d = path(f as never)
      if (!d) return

      const g = document.createElementNS(ns, 'g')
      const isSelected = selected === code

      const shape = document.createElementNS(ns, 'path')
      shape.setAttribute('d', d)
      const t = marginToT(margin)
      const [r, gCol, b] = healthColor(t)
      // Saturation follows distance from break-even — near-0 states fade
      // toward neutral instead of shouting a strong color for a marginal call.
      const fillOpacity = count > 0 ? 0.2 + 0.65 * Math.abs(t) : 0.04
      shape.setAttribute(
        'fill',
        count > 0 ? `rgba(${Math.round(r)}, ${Math.round(gCol)}, ${Math.round(b)}, ${fillOpacity})` : 'rgba(255,255,255,0.04)',
      )
      shape.setAttribute('stroke', isSelected ? '#fff' : 'rgba(255,255,255,0.15)')
      shape.setAttribute('stroke-width', isSelected ? '1.6' : '0.6')
      if (count > 0) {
        shape.style.cursor = 'pointer'
        shape.addEventListener('click', () => setSelected((prev) => (prev === code ? null : code)))
      }
      // Custom-rendered tooltip instead of a native <title> — the browser's
      // built-in tooltip has a ~1s hover delay before it appears.
      const updateHover = (e: MouseEvent) => {
        const wrapRect = wrapRef.current?.getBoundingClientRect()
        if (!wrapRect) return
        const x = e.clientX - wrapRect.left
        const y = e.clientY - wrapRect.top
        setHover({
          code,
          name,
          x,
          y,
          flipX: x > wrapRect.width * 0.65,
          flipY: y > wrapRect.height * 0.7,
        })
      }
      shape.addEventListener('mouseenter', updateHover)
      shape.addEventListener('mousemove', updateHover)
      shape.addEventListener('mouseleave', () => setHover((prev) => (prev?.code === code ? null : prev)))
      g.appendChild(shape)

      if (count > 0) {
        const c = path.centroid(f as never)
        if (c && !Number.isNaN(c[0])) {
          const label = document.createElementNS(ns, 'text')
          label.setAttribute('x', String(c[0]))
          label.setAttribute('y', String(c[1] - 2))
          label.setAttribute('text-anchor', 'middle')
          label.setAttribute('font-size', '9')
          label.setAttribute('font-weight', '700')
          label.setAttribute('font-family', 'Inter, sans-serif')
          label.setAttribute('fill', 'rgba(255,255,255,0.85)')
          label.style.pointerEvents = 'none'
          label.textContent = code
          g.appendChild(label)

          const countLabel = document.createElementNS(ns, 'text')
          countLabel.setAttribute('x', String(c[0]))
          countLabel.setAttribute('y', String(c[1] + 9))
          countLabel.setAttribute('text-anchor', 'middle')
          countLabel.setAttribute('font-size', '8')
          countLabel.setAttribute('font-family', 'Inter, sans-serif')
          countLabel.setAttribute('fill', 'rgba(255,255,255,0.55)')
          countLabel.style.pointerEvents = 'none'
          countLabel.textContent = fmtPct(margin)
          g.appendChild(countLabel)
        }
      }

      svg.appendChild(g)
    })
  }, [stateCounts, stateHealth, stateMargins, selected])

  return (
    <section className="card tam-card">
      <div className="card-head">
        <span className="eyebrow">Performance Map</span>
        <div className="tam-toggle">
          {MAP_DIRECTIONS.map((d) => (
            <button
              key={d.key}
              className={`tam-toggle-btn ${mapDirection === d.key ? 'active' : ''}`}
              onClick={() => setMapDirection(d.key)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <p className="tam-hint">
        Click a state for its trip breakdown. <strong>{MAP_DIRECTION_EXPLAIN[mapDirection]}</strong>
      </p>
      <div className="tam-legend">
        <span className="tam-legend-label">Losing</span>
        <span className="tam-legend-gradient" />
        <span className="tam-legend-label">Profitable</span>
      </div>

      {selectedStats && (
        <StateMetricsBar
          stats={selectedStats}
          direction={mapDirection}
          onClose={() => setSelected(null)}
          onSelectTrucks={onSelectTrucks}
          onOpenPlaceTrips={onOpenPlaceTrips}
        />
      )}

      <div className="tam-body">
        <div className="tam-wrap" ref={wrapRef}>
          <svg ref={svgRef} className="tam-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Profitability by state, net of leakage" />

          {hover && (() => {
            const count = stateCounts[hover.code] ?? 0
            const h = stateHealth[hover.code]
            const margin = stateMargins[hover.code] ?? 0
            return (
              <div
                className="tam-tooltip"
                style={{
                  left: hover.flipX ? hover.x - 14 : hover.x + 14,
                  top: hover.flipY ? hover.y - 14 : hover.y + 14,
                  transform: `translate(${hover.flipX ? '-100%' : '0'}, ${hover.flipY ? '-100%' : '0'})`,
                }}
              >
                <div className="tam-tooltip-title">{hover.name}</div>
                {count > 0 && h ? (
                  <>
                    <div className="tam-tooltip-row">
                      <span>{count} trip{count === 1 ? '' : 's'}</span>
                    </div>
                    <div className="tam-tooltip-row">
                      <span>Income</span>
                      <span className="tam-tooltip-pos">{usd(h.income)}</span>
                    </div>
                    <div className="tam-tooltip-row">
                      <span>Cost</span>
                      <span className="tam-tooltip-neg">{usd(h.cost)}</span>
                    </div>
                    <div className="tam-tooltip-row">
                      <span>Profit</span>
                      <span className={h.profit >= 0 ? 'tam-tooltip-pos' : 'tam-tooltip-neg'}>{usd(h.profit)}</span>
                    </div>
                    <div className="tam-tooltip-row">
                      <span>Net Margin</span>
                      <span className={margin >= 0 ? 'tam-tooltip-pos' : 'tam-tooltip-neg'}>{fmtPct(margin)}</span>
                    </div>
                    <p className="tam-tooltip-note">Profit net of leakage, as a share of income — this is what the map's color shows.</p>
                  </>
                ) : (
                  <div className="tam-tooltip-row">No trips</div>
                )}
              </div>
            )
          })()}
        </div>
      </div>
    </section>
  )
}

// Share of a trip's all-in cost attributed to fuel — same 0.38 assumption
// TripDetailModal's fuelCostTotal uses, kept in sync with it here.
const FUEL_COST_SHARE = 0.38

interface LeakageBreakdown {
  missedFuelSavings: number
  emptyMiles: number
  routeDeviations: number
  idleTime: number
}

interface TruckFuelStats {
  truck: string
  cls: TripRow['cls']
  gallons: number
  mpg: number
  cpg: number
  cpm: number
  saved: number
  leakage: number
  leakageBreakdown: LeakageBreakdown
}

// Per-truck fuel breakdown: gallons burned (miles / mpg, the same derivation
// TripDetailModal uses for a single trip), MPG, and cost/gallon (fuel share
// of cost ÷ gallons) — aggregated across a truck's trips rather than
// averaging each trip's own mpg/cpg, so a truck with more miles this period
// weighs proportionally more.
//
// The leakage breakdown attributes each truck's totalExcessCost to a cause:
// missedFuelSavings and excessMilesCost are real per-trip fields; idle time
// is priced at IDLE_GPH × the truck's own cost/gallon; whatever's left after
// those three is bucketed as "route deviations" so the categories always sum
// back to the truck's actual leakage total instead of drifting from it.
// Groups by truck, or by driver when `byDriver` is set — the `truck` field just
// carries whatever label keys the group, so the same list renders both.
function computeTruckFuelStats(rows: TripRow[], byDriver = false): TruckFuelStats[] {
  const byTruck = new Map<
    string,
    {
      cls: TripRow['cls']
      miles: number
      gallons: number
      fuelCost: number
      saved: number
      leakage: number
      missedFuelSavings: number
      emptyMiles: number
      idleHours: number
    }
  >()
  rows.forEach((r) => {
    const key = byDriver ? r.driver : r.truck
    const gallons = r.totalMiles / r.mpg
    const cur = byTruck.get(key) ?? {
      cls: r.cls,
      miles: 0,
      gallons: 0,
      fuelCost: 0,
      saved: 0,
      leakage: 0,
      missedFuelSavings: 0,
      emptyMiles: 0,
      idleHours: 0,
    }
    cur.miles += r.totalMiles
    cur.gallons += gallons
    cur.fuelCost += r.cost * FUEL_COST_SHARE
    cur.saved += r.actualSaving
    cur.leakage += r.totalExcessCost
    cur.missedFuelSavings += Math.abs(r.missedFuelSavings)
    cur.emptyMiles += r.excessMilesCost
    cur.idleHours += r.idleHours
    byTruck.set(key, cur)
  })
  return [...byTruck.entries()]
    .map(([truck, s]) => {
      const cpg = s.gallons > 0 ? s.fuelCost / s.gallons : 0
      const idleTime = s.idleHours * IDLE_GPH * cpg
      const routeDeviations = Math.max(0, s.leakage - s.missedFuelSavings - s.emptyMiles - idleTime)
      return {
        truck,
        cls: s.cls,
        gallons: s.gallons,
        mpg: s.gallons > 0 ? s.miles / s.gallons : 0,
        cpg,
        cpm: s.miles > 0 ? s.fuelCost / s.miles : 0,
        saved: s.saved,
        leakage: s.leakage,
        leakageBreakdown: {
          missedFuelSavings: s.missedFuelSavings,
          emptyMiles: s.emptyMiles,
          routeDeviations,
          idleTime,
        },
      }
    })
    .sort((a, b) => b.gallons - a.gallons)
}

type TruckSortKey = 'truck' | 'cpg' | 'cpm' | 'gallons' | 'mpg' | 'saved' | 'leakage'
const TRUCK_SORT_COLUMNS: { key: TruckSortKey; label: string }[] = [
  { key: 'truck', label: 'Truck' },
  { key: 'cpg', label: 'Avg $/gal' },
  { key: 'cpm', label: '$/mile' },
  { key: 'gallons', label: 'Gallons' },
  { key: 'mpg', label: 'MPG' },
  { key: 'saved', label: 'Saved' },
  { key: 'leakage', label: 'Leakage' },
]

const LEAKAGE_CATEGORIES: { key: keyof LeakageBreakdown; label: string; color: string }[] = [
  { key: 'missedFuelSavings', label: 'Missed fuel savings', color: '#c2453f' },
  { key: 'emptyMiles', label: 'Empty miles', color: '#cf5a44' },
  { key: 'routeDeviations', label: 'Route deviations', color: '#d56b41' },
  { key: 'idleTime', label: 'Idle time', color: '#d99f42' },
]

function TruckFuelList({ stats, firstColLabel = 'Truck' }: { stats: TruckFuelStats[]; firstColLabel?: string }) {
  const columns = TRUCK_SORT_COLUMNS.map((c) => (c.key === 'truck' ? { ...c, label: firstColLabel } : c))
  // Gallons desc is the default (busiest truck first) — same order
  // computeTruckFuelStats already returns — everything else defaults to
  // desc (highest first) except the truck name, which reads naturally asc.
  const [sortKey, setSortKey] = useState<TruckSortKey>('gallons')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  // The leakage breakdown tooltip is positioned with `fixed` coords captured
  // on hover/focus instead of the usual .info-tip-bubble (absolute + hidden
  // overflow on the ancestor) — .tam-sublist scrolls with overflow-y: auto,
  // which would clip an absolutely-positioned bubble at the list's edge.
  const [leakTip, setLeakTip] = useState<{ x: number; y: number; breakdown: LeakageBreakdown } | null>(null)

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...stats].sort((a, b) =>
      sortKey === 'truck' ? a.truck.localeCompare(b.truck) * dir : (a[sortKey] - b[sortKey]) * dir,
    )
  }, [stats, sortKey, sortDir])

  const toggleSort = (key: TruckSortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'truck' ? 'asc' : 'desc')
    }
  }

  if (stats.length === 0) return <p className="tam-detail-empty">No trips here.</p>
  return (
    <div className="tam-sublist">
      <div className="fs-truck-row fs-truck-row-head">
        {columns.map((col) => (
          <span
            key={col.key}
            className={`fs-truck-sort ${sortKey === col.key ? 'active' : ''}`}
            onClick={() => toggleSort(col.key)}
            role="button"
            tabIndex={0}
          >
            {col.label}
            {sortKey === col.key ? (
              sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
            ) : (
              <ChevronDown size={13} className="fs-truck-sort-idle" />
            )}
          </span>
        ))}
      </div>
      {sorted.map((s) => (
        <div className="fs-truck-row" key={s.truck}>
          <span className="tam-sublist-main">
            <span className="fd-class" style={{ background: CLASS_COLOR[s.cls] }}>
              {s.cls}
            </span>
            {s.truck}
          </span>
          <span>${s.cpg.toFixed(2)}</span>
          <span>${s.cpm.toFixed(2)}</span>
          <span>{Math.round(s.gallons).toLocaleString()}</span>
          <span>{s.mpg.toFixed(2)}</span>
          <span className="fs-truck-saved">${Math.round(s.saved).toLocaleString()}</span>
          <span className="fs-truck-leakage">
            ${Math.round(s.leakage).toLocaleString()}
            <span
              className="info-tip"
              tabIndex={0}
              onMouseEnter={(e) => {
                const row = e.currentTarget.closest('.fs-truck-row') ?? e.currentTarget
                const r = row.getBoundingClientRect()
                setLeakTip({ x: r.right, y: r.bottom, breakdown: s.leakageBreakdown })
              }}
              onMouseLeave={() => setLeakTip(null)}
              onFocus={(e) => {
                const row = e.currentTarget.closest('.fs-truck-row') ?? e.currentTarget
                const r = row.getBoundingClientRect()
                setLeakTip({ x: r.right, y: r.bottom, breakdown: s.leakageBreakdown })
              }}
              onBlur={() => setLeakTip(null)}
            >
              <Info size={13} color="var(--text-muted)" />
            </span>
          </span>
        </div>
      ))}
      {leakTip && (
        <div
          className="fs-leak-tip-bubble"
          role="tooltip"
          style={{ top: leakTip.y + 6, right: window.innerWidth - leakTip.x }}
        >
          <span className="fs-leak-tip-title">Leakage breakdown</span>
          {LEAKAGE_CATEGORIES.map((cat) => (
            <span className="fs-leak-tip-row" key={cat.key}>
              <span className="fs-leak-tip-dot" style={{ background: cat.color }} />
              <span className="fs-leak-tip-label">{cat.label}</span>
              <span className="fs-leak-tip-amount">
                ${Math.round(leakTip.breakdown[cat.key]).toLocaleString()}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}


export default function FuelSavings({
  classFilter = [],
  dimension = 'trucks',
  onSelectTrucks,
}: {
  classFilter?: string[]
  dimension?: 'trucks' | 'drivers'
  onSelectTrucks?: (trucks: string[]) => void
}) {
  const byDriver = dimension === 'drivers'
  const rows = classFilter.length > 0 ? tripRows.filter((r) => classFilter.includes(r.cls)) : tripRows
  const moneySaved = rows.reduce((s, r) => s + r.actualSaving, 0)
  const moneyLeakage = rows.reduce((s, r) => s + r.totalExcessCost, 0)

  // Opens the Trips card's target in a new *background* tab — clicking it
  // shouldn't yank the user out of Fuel & Savings. window.open(url, '_blank')
  // always steals focus, so instead this simulates a ctrl/cmd+click on an
  // <a target="_blank">, which Chromium/Firefox treat like a real
  // ctrl/cmd+click and open in the background. The target tab re-derives its
  // Trips filter from these query params on load (see FullData.tsx).
  const openPlaceTrips = (code: string, name: string, direction: MapDirection) => {
    const params = new URLSearchParams()
    params.set('tab', 'full')
    params.set('subtab', 'Trips')
    params.set('placeCode', code)
    params.set('placeName', name)
    params.set('placeDir', direction)
    if (classFilter.length > 0) params.set('class', classFilter.join(','))

    const link = document.createElement('a')
    link.href = `${window.location.pathname}?${params.toString()}`
    link.target = '_blank'
    link.rel = 'noopener'
    document.body.appendChild(link)
    const isMac = navigator.platform.toUpperCase().includes('MAC')
    link.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, view: window, ctrlKey: !isMac, metaKey: isMac }),
    )
    document.body.removeChild(link)
  }

  const [showAllTrucks, setShowAllTrucks] = useState(false)
  const truckStats = useMemo(() => computeTruckFuelStats(rows, byDriver), [rows, byDriver])
  const totalGallons = truckStats.reduce((s, t) => s + t.gallons, 0)
  const totalMiles = rows.reduce((s, r) => s + r.totalMiles, 0)
  const totalFuelCost = rows.reduce((s, r) => s + r.cost * FUEL_COST_SHARE, 0)
  const fleetMpg = totalGallons > 0 ? totalMiles / totalGallons : 0
  const fleetCpg = totalGallons > 0 ? totalFuelCost / totalGallons : 0
  const fleetCpm = totalMiles > 0 ? totalFuelCost / totalMiles : 0

  return (
    <div className="pv">
      <div
        className="card kpi tam-stat-clickable fs-summary-card"
        onClick={() => setShowAllTrucks(true)}
        role="button"
        tabIndex={0}
      >
        <div className="kpi-head">
          <span className="eyebrow">Fuel &amp; Savings Summary</span>
          <span className="fs-summary-link">
            {byDriver ? 'View by driver' : 'View by truck'}
            <ChevronRight size={13} className="tam-stat-chevron" />
          </span>
        </div>
        <div className="fs-summary-row">
          <div className="fs-fuel-metric">
            <span className="fs-fuel-label">Money saved</span>
            <span className="fs-fuel-value" style={{ color: 'var(--green)' }}>
              {usd(moneySaved)}
            </span>
          </div>
          <div className="fs-fuel-metric">
            <span className="fs-fuel-label">Money leakage</span>
            <span className="fs-fuel-value" style={{ color: 'var(--red)' }}>
              {'-' + usd(moneyLeakage)}
            </span>
          </div>
          <div className="fs-fuel-metric">
            <span className="fs-fuel-label">Cost / gal</span>
            <span className="fs-fuel-value">${fleetCpg.toFixed(2)}</span>
          </div>
          <div className="fs-fuel-metric">
            <span className="fs-fuel-label">Cost / mile</span>
            <span className="fs-fuel-value">${fleetCpm.toFixed(2)}</span>
          </div>
          <div className="fs-fuel-metric">
            <span className="fs-fuel-label">Total gallons</span>
            <span className="fs-fuel-value">{Math.round(totalGallons).toLocaleString()}</span>
          </div>
          <div className="fs-fuel-metric">
            <span className="fs-fuel-label">Avg MPG</span>
            <span className="fs-fuel-value">{fleetMpg.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <TruckActivityMap rows={rows} onSelectTrucks={onSelectTrucks} onOpenPlaceTrips={openPlaceTrips} />

      {showAllTrucks && (
        <SubDetailModal
          title={byDriver ? 'Fuel & savings — by driver' : 'Fuel & savings — by truck'}
          onClose={() => setShowAllTrucks(false)}
          className="fs-truck-modal"
        >
          <TruckFuelList stats={truckStats} firstColLabel={byDriver ? 'Driver' : 'Truck'} />
        </SubDetailModal>
      )}
    </div>
  )
}
