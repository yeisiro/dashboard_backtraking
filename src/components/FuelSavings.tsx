import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { X, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { FeatureCollection } from 'geojson'
import usTopo from 'us-atlas/states-10m.json'
import { tripRows, type TripRow } from '../data'

const usd = (n: number) => '$' + Math.round(n).toLocaleString()

// Same cost-per-gallon figure the Overview KPI ("CPG: actual vs optimal") and
// the Money Leakage Breakdown's idle-cost formula both anchor to.
const COST_PER_GALLON = 3.6
// idle_gph from the Money Leakage Breakdown's documented Idle Time Cost
// formula (see data.ts's leakBars comment) — Samsara doesn't report idle
// gallons directly, so this configurable rate estimates them.
const IDLE_GPH = 0.8

function StatBox({
  label,
  value,
  tone,
  caption,
  onClick,
}: {
  label: string
  value: string
  tone?: 'pos' | 'neg'
  caption?: string
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
        <span
          className="value"
          style={tone === 'pos' ? { color: 'var(--green)' } : tone === 'neg' ? { color: 'var(--red)' } : undefined}
        >
          {value}
        </span>
      </div>
      {caption && <div className="foot">{caption}</div>}
    </div>
  )
}

// A small centered modal for detail that's too much to cram into the
// 320px-wide side panel — reuses the app's standard modal chrome.
function SubDetailModal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal tam-modal" onClick={(e) => e.stopPropagation()}>
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

// ---------- Cost & Leakage — same taxonomy as the Money Leakage Breakdown
// (Overview) and Lane Cost Summary (Trip Detail), rebuilt per-trip so trips
// can be grouped by cause instead of just showing one fixed fleet-wide split.

type LeakCause = 'Missed Fuel Savings' | 'Empty Miles' | 'Idle Time Cost' | 'Poor Planning'
const LEAK_CAUSE_ORDER: LeakCause[] = ['Missed Fuel Savings', 'Empty Miles', 'Idle Time Cost', 'Poor Planning']
// Same colors as leakBars in data.ts (Money Leakage Breakdown).
const LEAK_CAUSE_COLOR: Record<LeakCause, string> = {
  'Missed Fuel Savings': '#c2453f',
  'Empty Miles': '#cf5a44',
  'Idle Time Cost': '#d99f42',
  'Poor Planning': '#d9843f',
}

// Splits a trip's excess cost across the same 4 real, disjoint signals the
// Money Leakage Breakdown's documented formulas use: fuel, deadhead/empty
// miles, idle time, and whatever's left (poor planning — the old "Planned"
// concept, named for the cause). "Route Deviations" isn't included: nothing
// on TripRow distinguishes it from deadhead at the per-trip level, so
// splitting the two would mean inventing a number.
function tripLeakBreakdown(r: TripRow) {
  const fuel = Math.abs(r.missedFuelSavings)
  const emptyMiles = r.excessMilesCost
  const idle = r.idleHours * IDLE_GPH * COST_PER_GALLON
  const planning = Math.max(0, r.totalExcessCost - fuel - emptyMiles - idle)
  return { fuel, emptyMiles, idle, planning }
}

function dominantCause(r: TripRow): LeakCause {
  const b = tripLeakBreakdown(r)
  const entries: [LeakCause, number][] = [
    ['Missed Fuel Savings', b.fuel],
    ['Empty Miles', b.emptyMiles],
    ['Idle Time Cost', b.idle],
    ['Poor Planning', b.planning],
  ]
  return entries.reduce((max, e) => (e[1] > max[1] ? e : max))[0]
}

// Groups trips by their dominant cause and shows, per cause, the trips that
// fall into it — the whole point being "which trips, and why" in one flat
// read, no extra clicks to expand a category.
function CauseGroupedTripList({ rows, onSelect }: { rows: TripRow[]; onSelect?: (truck: string) => void }) {
  if (rows.length === 0) return <p className="tam-detail-empty">No trips here.</p>


  const byCause = new Map<LeakCause, TripRow[]>()
  rows.forEach((r) => {
    const cause = dominantCause(r)
    const list = byCause.get(cause) ?? []
    list.push(r)
    byCause.set(cause, list)
  })

  return (
    <div className="tam-cause-groups">
      {LEAK_CAUSE_ORDER.filter((cause) => byCause.has(cause)).map((cause) => {
        const causeRows = [...byCause.get(cause)!].sort((a, b) => b.totalExcessCost - a.totalExcessCost)
        const causeLeakage = causeRows.reduce((s, r) => s + r.totalExcessCost, 0)
        return (
          <div className="tam-cause-group" key={cause}>
            <div className="tam-cause-group-head">
              <span className="tam-cause-group-dot" style={{ background: LEAK_CAUSE_COLOR[cause] }} />
              <span className="tam-cause-group-name">{cause}</span>
              <span className="tam-cause-group-total">{usd(causeLeakage)}</span>
            </div>
            <div className="tam-sublist">
              {causeRows.map((r) => (
                <div
                  className={`tam-sublist-row ${onSelect ? 'tam-sublist-row-clickable' : ''}`}
                  key={`${r.truck}-${r.startDate}-${r.lane}`}
                  onClick={onSelect ? () => onSelect(r.truck) : undefined}
                  role={onSelect ? 'button' : undefined}
                  tabIndex={onSelect ? 0 : undefined}
                >
                  <span className="tam-sublist-main">
                    {r.truck} <span className="tam-sublist-lane">{r.lane}</span>
                  </span>
                  <span className="tam-sublist-sub">
                    Cost {usd(r.cost)} · Leak {usd(r.totalExcessCost)}
                    {onSelect && <ChevronRight size={13} className="tam-sublist-arrow" />}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const DIRECTIONS = [
  { key: 'all', label: 'All' },
  { key: 'outbound', label: 'Outbound' },
  { key: 'inbound', label: 'Inbound' },
] as const
type Direction = (typeof DIRECTIONS)[number]['key']

// One flat, cause-grouped list — no duplicate rows, since "All" is the
// deduped union rather than outbound+inbound shown side by side (a
// same-state trip only ever appears once there). The toggle is what lets you
// isolate just what's leaving or just what's arriving, instead of always
// showing both.
function CostLeakagePanel({
  stats,
  onSelect,
}: {
  stats: StateStats
  onSelect?: (truck: string) => void
}) {
  const [direction, setDirection] = useState<Direction>('all')
  const rows =
    direction === 'outbound' ? stats.outboundRows : direction === 'inbound' ? stats.inboundRows : stats.hereRows

  return (
    <>
      <div className="tam-toggle">
        {DIRECTIONS.map((d) => (
          <button
            key={d.key}
            className={`tam-toggle-btn ${direction === d.key ? 'active' : ''}`}
            onClick={() => setDirection(d.key)}
          >
            {d.label}
          </button>
        ))}
      </div>
      <CauseGroupedTripList rows={rows} onSelect={onSelect} />
    </>
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

function computeStateCounts(rows: TripRow[]): Record<string, number> {
  const counts: Record<string, number> = {}
  rows.forEach((r) => {
    parseLane(r.lane).all.forEach((code) => {
      counts[code] = (counts[code] ?? 0) + 1
    })
  })
  return counts
}

// Same touch-counts-once-per-state rule as computeStateCounts, but summing
// income/profit/leakage instead of just counting — this is what drives the
// map's red↔yellow↔green health color, while computeStateCounts still drives
// the trip-count used in the tooltip.
function computeStateHealth(rows: TripRow[]): Record<string, { income: number; profit: number; leakage: number }> {
  const health: Record<string, { income: number; profit: number; leakage: number }> = {}
  rows.forEach((r) => {
    parseLane(r.lane).all.forEach((code) => {
      const cur = health[code] ?? { income: 0, profit: 0, leakage: 0 }
      cur.income += r.income
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

const fmtLeakage = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : `$${Math.round(n)}`)
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
}

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
  }
}

// The "Trips Here" drill-down: just the outbound/inbound split, each row
// jumping straight to Trips filtered to that place + direction — replaces
// the old standalone Outbound/Inbound stat cards.
function TripsDirectionPanel({
  stats,
  onSelectPlace,
}: {
  stats: StateStats
  onSelectPlace?: (code: string, name: string, direction: 'outbound' | 'inbound') => void
}) {
  return (
    <div className="tam-side-stats">
      <StatBox
        label={`Leaving ${stats.name}`}
        value={String(stats.outboundRows.length)}
        onClick={() => onSelectPlace?.(stats.code, stats.name, 'outbound')}
      />
      <StatBox
        label={`Arriving to ${stats.name}`}
        value={String(stats.inboundRows.length)}
        onClick={() => onSelectPlace?.(stats.code, stats.name, 'inbound')}
      />
    </div>
  )
}

function StateDetailPanel({
  stats,
  onClose,
  onSelectTrucks,
  onSelectPlace,
}: {
  stats: StateStats
  onClose: () => void
  onSelectTrucks?: (trucks: string[]) => void
  onSelectPlace?: (code: string, name: string, direction: 'outbound' | 'inbound') => void
}) {
  const [subModal, setSubModal] = useState<'trucks' | 'costleak' | 'tripsdir' | null>(null)
  const selectOne = (truck: string) => onSelectTrucks?.([truck])

  return (
    <div className="tam-detail">
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
          <div className="tam-side-stats">
            <StatBox
              label="Trips Here"
              value={String(stats.tripsHere)}
              onClick={() => setSubModal('tripsdir')}
            />
            <StatBox
              label="Trucks Involved"
              value={String(stats.truckCount)}
              onClick={() => setSubModal('trucks')}
            />
            <StatBox label="Income" value={usd(stats.income)} tone="pos" />
            <StatBox label="Profit" value={usd(stats.profit)} tone={stats.profit >= 0 ? 'pos' : 'neg'} />
            <StatBox label="Cost" value={usd(stats.cost)} onClick={() => setSubModal('costleak')} />
            <StatBox
              label="Leakage"
              value={usd(stats.leakage)}
              tone="neg"
              onClick={() => setSubModal('costleak')}
            />
          </div>

          {subModal === 'tripsdir' && (
            <SubDetailModal title={`Trips — ${stats.name}`} onClose={() => setSubModal(null)}>
              <TripsDirectionPanel stats={stats} onSelectPlace={onSelectPlace} />
            </SubDetailModal>
          )}
          {subModal === 'trucks' && (
            <SubDetailModal title={`Trucks that operated in ${stats.name}`} onClose={() => setSubModal(null)}>
              <TruckList rows={stats.hereRows} onSelect={onSelectTrucks ? selectOne : undefined} />
            </SubDetailModal>
          )}
          {subModal === 'costleak' && (
            <SubDetailModal title={`Cost & Leakage — ${stats.name}`} onClose={() => setSubModal(null)}>
              <CostLeakagePanel stats={stats} onSelect={onSelectTrucks ? selectOne : undefined} />
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
  onSelectPlace,
}: {
  rows: TripRow[]
  onSelectTrucks?: (trucks: string[]) => void
  onSelectPlace?: (code: string, name: string, direction: 'outbound' | 'inbound') => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [hover, setHover] = useState<{ code: string; name: string; x: number; y: number; flipX: boolean; flipY: boolean } | null>(
    null,
  )
  // Memoized on `rows` alone — otherwise these recompute to new object
  // references on every render (including the ones hover-tracking triggers),
  // which would retrigger the draw effect below and tear down/rebuild the
  // SVG mid-click, right under the cursor.
  const stateCounts = useMemo(() => computeStateCounts(rows), [rows])
  const stateHealth = useMemo(() => computeStateHealth(rows), [rows])
  const stateMargins = useMemo(
    () => Object.fromEntries(Object.entries(stateHealth).map(([code, h]) => [code, netMarginPct(h)])),
    [stateHealth],
  )
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
        <span className="tam-hint">Click a state for its trip breakdown</span>
      </div>
      <div className="tam-legend">
        <span className="tam-legend-label">Losing</span>
        <span className="tam-legend-gradient" />
        <span className="tam-legend-label">Profitable</span>
      </div>
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
                      <span>Profit</span>
                      <span className="tam-tooltip-pos">{usd(h.profit)}</span>
                    </div>
                    <div className="tam-tooltip-row">
                      <span>Leakage</span>
                      <span className="tam-tooltip-neg">{fmtLeakage(h.leakage)}</span>
                    </div>
                    <div className="tam-tooltip-row">
                      <span>Net</span>
                      <span className={margin >= 0 ? 'tam-tooltip-pos' : 'tam-tooltip-neg'}>{fmtPct(margin)}</span>
                    </div>
                  </>
                ) : (
                  <div className="tam-tooltip-row">No trips</div>
                )}
              </div>
            )
          })()}
        </div>

        {selectedStats && (
          <StateDetailPanel
            stats={selectedStats}
            onClose={() => setSelected(null)}
            onSelectTrucks={onSelectTrucks}
            onSelectPlace={onSelectPlace}
          />
        )}
      </div>
    </section>
  )
}

// Share of a trip's all-in cost attributed to fuel — same 0.38 assumption
// TripDetailModal's fuelCostTotal uses, kept in sync with it here.
const FUEL_COST_SHARE = 0.38

interface TruckFuelStats {
  truck: string
  cls: TripRow['cls']
  gallons: number
  mpg: number
  cpg: number
}

// Per-truck fuel breakdown: gallons burned (miles / mpg, the same derivation
// TripDetailModal uses for a single trip), MPG, and cost/gallon (fuel share
// of cost ÷ gallons) — aggregated across a truck's trips rather than
// averaging each trip's own mpg/cpg, so a truck with more miles this period
// weighs proportionally more.
function computeTruckFuelStats(rows: TripRow[]): TruckFuelStats[] {
  const byTruck = new Map<string, { cls: TripRow['cls']; miles: number; gallons: number; fuelCost: number }>()
  rows.forEach((r) => {
    const gallons = r.totalMiles / r.mpg
    const cur = byTruck.get(r.truck) ?? { cls: r.cls, miles: 0, gallons: 0, fuelCost: 0 }
    cur.miles += r.totalMiles
    cur.gallons += gallons
    cur.fuelCost += r.cost * FUEL_COST_SHARE
    byTruck.set(r.truck, cur)
  })
  return [...byTruck.entries()]
    .map(([truck, s]) => ({
      truck,
      cls: s.cls,
      gallons: s.gallons,
      mpg: s.gallons > 0 ? s.miles / s.gallons : 0,
      cpg: s.gallons > 0 ? s.fuelCost / s.gallons : 0,
    }))
    .sort((a, b) => b.gallons - a.gallons)
}

type TruckSortKey = 'truck' | 'cpg' | 'gallons' | 'mpg'
const TRUCK_SORT_COLUMNS: { key: TruckSortKey; label: string }[] = [
  { key: 'truck', label: 'Truck' },
  { key: 'cpg', label: 'Avg $/gal' },
  { key: 'gallons', label: 'Gallons' },
  { key: 'mpg', label: 'MPG' },
]

function TruckFuelList({ stats }: { stats: TruckFuelStats[] }) {
  // Gallons desc is the default (busiest truck first) — same order
  // computeTruckFuelStats already returns — everything else defaults to
  // desc (highest first) except the truck name, which reads naturally asc.
  const [sortKey, setSortKey] = useState<TruckSortKey>('gallons')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

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
        {TRUCK_SORT_COLUMNS.map((col) => (
          <span
            key={col.key}
            className={`fs-truck-sort ${sortKey === col.key ? 'active' : ''}`}
            onClick={() => toggleSort(col.key)}
            role="button"
            tabIndex={0}
          >
            {col.label}
            {sortKey === col.key &&
              (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
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
          <span>{Math.round(s.gallons).toLocaleString()}</span>
          <span>{s.mpg.toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
}


export default function FuelSavings({
  classFilter = [],
  onSelectTrucks,
  onSelectPlace,
}: {
  classFilter?: string[]
  onSelectTrucks?: (trucks: string[]) => void
  onSelectPlace?: (code: string, name: string, direction: 'outbound' | 'inbound') => void
}) {
  const rows = classFilter.length > 0 ? tripRows.filter((r) => classFilter.includes(r.cls)) : tripRows
  const moneySaved = rows.reduce((s, r) => s + r.actualSaving, 0)
  const moneyLeakage = rows.reduce((s, r) => s + r.totalExcessCost, 0)

  const [showAllTrucks, setShowAllTrucks] = useState(false)
  const truckStats = useMemo(() => computeTruckFuelStats(rows), [rows])
  const totalGallons = truckStats.reduce((s, t) => s + t.gallons, 0)
  const totalMiles = rows.reduce((s, r) => s + r.totalMiles, 0)
  const totalFuelCost = rows.reduce((s, r) => s + r.cost * FUEL_COST_SHARE, 0)
  const fleetMpg = totalGallons > 0 ? totalMiles / totalGallons : 0
  const fleetCpg = totalGallons > 0 ? totalFuelCost / totalGallons : 0

  return (
    <div className="pv">
      <div className="fs-headline-row">
        <StatBox
          label="Money Saved"
          value={usd(moneySaved)}
          tone="pos"
          caption={`Captured across ${rows.length.toLocaleString()} trips this period`}
        />
        <StatBox
          label="Money Leakage"
          value={'-' + usd(moneyLeakage)}
          tone="neg"
          caption="Missed fuel savings, empty miles, idle time & poor planning"
        />
        <div
          className="card kpi tam-stat-clickable fs-fuel-card"
          onClick={() => setShowAllTrucks(true)}
          role="button"
          tabIndex={0}
        >
          <div className="kpi-head">
            <span className="eyebrow">Fuel Efficiency</span>
            <ChevronRight size={13} className="tam-stat-chevron" />
          </div>
          <div className="fs-fuel-split">
            <div className="fs-fuel-metric">
              <span className="fs-fuel-label">Cost / Gal</span>
              <span className="fs-fuel-value">${fleetCpg.toFixed(2)}</span>
            </div>
            <div className="fs-fuel-metric">
              <span className="fs-fuel-label">Total Gallons</span>
              <span className="fs-fuel-value">{Math.round(totalGallons).toLocaleString()}</span>
            </div>
            <div className="fs-fuel-metric">
              <span className="fs-fuel-label">Avg MPG</span>
              <span className="fs-fuel-value">{fleetMpg.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
      <TruckActivityMap rows={rows} onSelectTrucks={onSelectTrucks} onSelectPlace={onSelectPlace} />

      {showAllTrucks && (
        <SubDetailModal title="Fuel Efficiency — by truck" onClose={() => setShowAllTrucks(false)}>
          <TruckFuelList stats={truckStats} />
        </SubDetailModal>
      )}
    </div>
  )
}
