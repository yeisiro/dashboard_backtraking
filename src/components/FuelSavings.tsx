import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X, ChevronRight } from 'lucide-react'
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
  onClick,
}: {
  label: string
  value: string
  tone?: 'pos' | 'neg'
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
function parseLane(lane: string): { origin: string | null; dest: string | null; all: string[] } {
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

function StateDetailPanel({
  stats,
  onClose,
  onSelectTrucks,
}: {
  stats: StateStats
  onClose: () => void
  onSelectTrucks?: (trucks: string[]) => void
}) {
  const [subModal, setSubModal] = useState<'trucks' | 'costleak' | null>(null)
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
              onClick={() => onSelectTrucks?.(stats.hereRows.map((r) => r.truck))}
            />
            <StatBox
              label="Trucks Involved"
              value={String(stats.truckCount)}
              onClick={() => setSubModal('trucks')}
            />
            <StatBox
              label="Outbound"
              value={String(stats.outboundRows.length)}
              onClick={() => onSelectTrucks?.(stats.outboundRows.map((r) => r.truck))}
            />
            <StatBox
              label="Inbound"
              value={String(stats.inboundRows.length)}
              onClick={() => onSelectTrucks?.(stats.inboundRows.map((r) => r.truck))}
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
}: {
  rows: TripRow[]
  onSelectTrucks?: (trucks: string[]) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const stateCounts = computeStateCounts(rows)
  const maxCount = Math.max(1, ...Object.values(stateCounts))
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
      const d = path(f as never)
      if (!d) return

      const g = document.createElementNS(ns, 'g')
      const isSelected = selected === code

      const shape = document.createElementNS(ns, 'path')
      shape.setAttribute('d', d)
      const fillOpacity = count > 0 ? 0.12 + 0.75 * (count / maxCount) : 0.04
      shape.setAttribute('fill', count > 0 ? `rgba(46, 230, 166, ${fillOpacity})` : 'rgba(255,255,255,0.04)')
      shape.setAttribute('stroke', isSelected ? '#fff' : 'rgba(255,255,255,0.15)')
      shape.setAttribute('stroke-width', isSelected ? '1.6' : '0.6')
      if (count > 0) {
        shape.style.cursor = 'pointer'
        shape.addEventListener('click', () => setSelected((prev) => (prev === code ? null : code)))
      }
      const title = document.createElementNS(ns, 'title')
      title.textContent = `${name}: ${count} trip${count === 1 ? '' : 's'}${count > 0 ? ' — click for details' : ''}`
      shape.appendChild(title)
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
          countLabel.textContent = String(count)
          g.appendChild(countLabel)
        }
      }

      svg.appendChild(g)
    })
  }, [stateCounts, maxCount, selected])

  return (
    <section className="card tam-card">
      <div className="card-head">
        <span className="eyebrow">Truck Activity Map</span>
        <span className="tam-hint">Click a state for its trip breakdown</span>
      </div>
      <div className="tam-body">
        <div className="tam-wrap">
          <svg ref={svgRef} className="tam-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Truck activity by state" />
        </div>

        {selectedStats && (
          <StateDetailPanel stats={selectedStats} onClose={() => setSelected(null)} onSelectTrucks={onSelectTrucks} />
        )}
      </div>
    </section>
  )
}

export default function FuelSavings({
  classFilter = [],
  onSelectTrucks,
}: {
  classFilter?: string[]
  onSelectTrucks?: (trucks: string[]) => void
}) {
  const rows = classFilter.length > 0 ? tripRows.filter((r) => classFilter.includes(r.cls)) : tripRows

  return (
    <div className="pv">
      <TruckActivityMap rows={rows} onSelectTrucks={onSelectTrucks} />
    </div>
  )
}
