import { Fragment, useEffect, useRef, useState } from 'react'
import {
  ChevronUp, ChevronDown, Eye, Search, X, GripVertical, Filter, Check,
  TrendingUp, TrendingDown, Minus, ArrowUpRight, Clock, Navigation, Merge,
  History, Split, Undo2, Layers,
} from 'lucide-react'
import { tripRows, repositionRows, costSegments, deltaTone, deltaTrend, type TripRow, type RepositionRow, type Goal } from '../data'
import { usePeriod } from '../PeriodContext'
import TripDetailModal from './TripDetailModal'
import DelayDetailModal, { StatusDonut, getDelaySegments } from './DelayDetailModal'
import FuelSavings, { parseLane } from './FuelSavings'
import OperativeGapDrawer from './OperativeGapDrawer'
import Toast from './Toast'

const SUBTABS = ['Trips', 'Fleet Analytics', 'Productivity', 'Fuel and Savings', 'Rewards'] as const
export type SubTab = (typeof SUBTABS)[number]

// V1 ("summary") drops the Rewards subtab; V2 ("dashboard") keeps the full set.
const subtabsForView = (view: 'summary' | 'dashboard'): readonly SubTab[] =>
  view === 'summary' ? SUBTABS.filter((t) => t !== 'Rewards') : SUBTABS

const CLASS_COLOR: Record<TripRow['cls'], string> = {
  A: 'var(--green)',
  B: 'var(--blue)',
  C: 'var(--orange)',
  D: 'var(--red)',
}

// V1 only tracks the post-delivery paperwork lifecycle — every trip here
// already happened, so these are the only statuses in play for now.
const STATUS_STYLE: Record<TripRow['status'], { label: string; color: string }> = {
  delivered: { label: 'Delivered', color: 'var(--blue)' },
  invoiced: { label: 'Invoiced', color: 'var(--orange)' },
  paid: { label: 'Paid', color: 'var(--green)' },
}

// ── Formatters ────────────────────────────────────────────────────────────
const usd = (n: number) => '$' + Math.round(n).toLocaleString()
const pct = (n: number) => n.toFixed(1) + '%'
const miles = (n: number) => n.toLocaleString() + ' mi'
// "9h 24m" — built from the trip's real effectiveHours, not an estimate.
const fmtHours = (h: number) => {
  const totalMin = Math.round(h * 60)
  return `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`
}
// Driving time only — effectiveHours excludes idleHours by definition.
const drivingHours = (r: TripRow) => r.effectiveHours
const deadheadMiles = (r: TripRow) => r.totalMiles - r.loadedMiles

// "May 14" → a month/day sort key. No year in the data, but every month has
// at most 31 days so month*31+day never collides across months.
const MONTH_INDEX: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
}
const dateSortValue = (s: string) => {
  const [mon, day] = s.split(' ')
  return (MONTH_INDEX[mon] ?? 0) * 31 + Number(day)
}

// ── Sorting ───────────────────────────────────────────────────────────────
// 'score' has no column of its own but stays sortable internally — arriving
// from a "Worst trips"/"Best trips" link ranks rows by it without showing it.
type SortKey =
  | 'score' | 'startDate' | 'time' | 'distance' | 'deadhead' | 'income' | 'cost' | 'profit'
  | 'adherence' | 'wastedRate' | 'leakage'

const SORT_ACCESSOR: Record<SortKey, (r: TripRow) => number> = {
  score: (r) => r.score,
  startDate: (r) => dateSortValue(r.startDate),
  time: (r) => drivingHours(r),
  distance: (r) => r.totalMiles,
  deadhead: (r) => deadheadMiles(r),
  income: (r) => r.income,
  cost: (r) => r.cost,
  profit: (r) => r.profit,
  adherence: (r) => r.adherence,
  wastedRate: (r) => r.wastedRate,
  leakage: (r) => r.totalExcessCost,
}

// A row in the Trips table is either a load trip or an operative repositioning
// move (empty, no load). They live in one sorted list when the toggle is on.
type TableRow = TripRow | RepositionRow
const isReposition = (r: TableRow): r is RepositionRow => 'reposition' in r

// A run of operative legs folded into one load's deadhead. Keeps everything
// needed to detach them again and restore the load's pre-assign figures.
interface OpAssignment {
  id: string
  loadRef: string
  legs: RepositionRow[]
  miles: number
  cost: number
  leak: number
}

// One entry in the operative-trips change log. `kind` drives the icon/wording;
// `refId` points at the thing to undo (a merged leg id, or an assignment id);
// `active` is false once the change has been reversed.
interface OpLogEntry {
  id: string
  kind: 'merge' | 'assign' | 'unmerge' | 'detach'
  title: string
  detail: string
  loadRef?: string // the load the change concerns (for the per-load filter)
  refId?: string
  active: boolean
}

// Shape a repositioning move as a TripRow so the detail modal (which is built
// around TripRow) can render it in `repo` mode: no load, no income, 100%
// deadhead. optimalCost/excessMilesCost carry the leakage; profit is −cost.
function repoAsTrip(r: RepositionRow): TripRow {
  const totalCost = Math.round(r.cost * 1.08)
  return {
    score: 0,
    truck: r.truck,
    driver: r.driver,
    cls: r.cls,
    startDate: r.startDate,
    endDate: r.endDate,
    lane: r.lane,
    loadRef: '—',
    status: 'delivered',
    income: 0,
    negotiatedRpm: 0,
    executedRpm: 0,
    effectiveRpm: 0,
    wastedRpmPct: 0,
    cost: r.cost,
    totalCost,
    optimalCost: Math.max(0, totalCost - r.leakage),
    totalExcessCost: r.leakage,
    excessMilesCost: r.leakage,
    missedFuelSavings: 0,
    actualSaving: 0,
    profit: -r.cost,
    totalMiles: r.totalMiles,
    loadedMiles: 0,
    dhMilesPct: 100,
    deadheadPct: 100,
    effectiveHours: r.effectiveHours,
    idleHours: 0,
    idlePct: 0,
    mpg: 6.0,
    adherence: r.adherence,
    planAdherence: r.adherence,
    wastedRate: 0,
  }
}

// ── Columns ───────────────────────────────────────────────────────────────
// Every data column is user-reorderable (dragged via the grip handle) —
// 'truck'/'load'/'status' just don't have a sort accessor, and 'status' gets
// its own filter dropdown instead of a sort button. Details stays last as
// the fixed action column, outside this list.
type ColId =
  | 'truck' | 'load' | 'status' | 'startDate' | 'time' | 'distance' | 'deadhead' | 'income'
  | 'cost' | 'profit' | 'adherence' | 'wastedRate' | 'leakage'

const ALL_COLUMNS: { key: ColId; label: string; left?: boolean; sortable?: boolean }[] = [
  { key: 'truck', label: 'Truck', left: true },
  { key: 'load', label: 'Load', left: true },
  { key: 'startDate', label: 'Date', left: true, sortable: true },
  { key: 'status', label: 'Status', left: true },
  { key: 'time', label: 'Driving Time', sortable: true },
  { key: 'distance', label: 'Total Miles', sortable: true },
  { key: 'deadhead', label: 'Deadhead', sortable: true },
  { key: 'income', label: 'Income', sortable: true },
  { key: 'cost', label: 'Cost', sortable: true },
  { key: 'profit', label: 'Profit', sortable: true },
  { key: 'adherence', label: 'Adherence', sortable: true },
  { key: 'wastedRate', label: 'Wasted Rate', sortable: true },
  { key: 'leakage', label: 'Leakage', sortable: true },
]

const rowKey = (r: TripRow) => `${r.truck}-${r.startDate}-${r.loadRef}`

// "May 14 → May 15", collapsed to "May 14" when start and end match.
const dateRange = (r: { startDate: string; endDate: string }) =>
  r.startDate === r.endDate ? r.startDate : `${r.startDate} → ${r.endDate}`

// V1 always spells out both ends of the trip, even for same-day trips.
const fullDateRange = (r: { startDate: string; endDate: string }) => `${r.startDate} → ${r.endDate}`

function StatusBadge({ status }: { status: TripRow['status'] }) {
  const { label, color } = STATUS_STYLE[status]
  return (
    <span className="fd-status" style={{ color }}>
      {label}
    </span>
  )
}

export default function FullData({
  band = null,
  classFilter = [],
  truckFilter = [],
  onTruckFilterChange,
  driverFilter = [],
  dimension = 'trucks',
  view = 'dashboard',
  onSubTabChange,
}: {
  band?: 'best' | 'worst' | null
  classFilter?: string[]
  truckFilter?: string[]
  onTruckFilterChange?: (next: string[]) => void
  driverFilter?: string[]
  dimension?: 'trucks' | 'drivers'
  view?: 'summary' | 'dashboard'
  onSubTabChange?: (tab: SubTab) => void
}) {
  // Landing here from a "Trips Here" new-tab link (see FuelSavings.tsx's
  // openPlaceTrips) — the query string is the only way a fresh tab can carry
  // over the subtab + place filter, since there's no in-memory state to hand
  // off across tabs.
  const [tab, setTab] = useState<SubTab>(() => {
    const subtab = new URLSearchParams(window.location.search).get('subtab')
    return (SUBTABS as readonly string[]).includes(subtab ?? '') ? (subtab as SubTab) : 'Trips'
  })
  useEffect(() => onSubTabChange?.(tab), [tab, onSubTabChange])
  const [placeFilter, setPlaceFilter] = useState<{
    code: string
    name: string
    direction: 'outbound' | 'inbound' | 'all'
  } | null>(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('placeCode')
    const name = params.get('placeName')
    const direction = params.get('placeDir')
    if (code && name && (direction === 'outbound' || direction === 'inbound' || direction === 'all')) {
      return { code, name, direction }
    }
    return null
  })
  const subtabs = subtabsForView(view)

  return (
    <div className="fd">
      <div className="fd-tabs">
        {subtabs.map((t) => (
          <button key={t} className={`fd-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Trips' ? (
        <TripsTable
          band={band}
          classFilter={classFilter}
          view={view}
          truckFilter={truckFilter}
          driverFilter={driverFilter}
          dimension={dimension}
          placeFilter={placeFilter}
          onClearPlaceFilter={() => setPlaceFilter(null)}
        />
      ) : tab === 'Fleet Analytics' ? (
        <FleetAnalytics classFilter={classFilter} view={view} />
      ) : tab === 'Productivity' ? (
        <Productivity classFilter={classFilter} />
      ) : tab === 'Fuel and Savings' ? (
        <FuelSavings
          classFilter={classFilter}
          dimension={dimension}
          onSelectTrucks={(trucks) => {
            setPlaceFilter(null)
            onTruckFilterChange?.(trucks)
            setTab('Trips')
          }}
        />
      ) : (
        <div className="fd-empty">{tab} — coming soon</div>
      )}
    </div>
  )
}

const CLASS_ORDER: TripRow['cls'][] = ['A', 'B', 'C', 'D']

// One collapsible section per truck class. Each section's body is just the
// Trips table, pre-filtered to that class — same sort/search/reorder/detail
// behavior, only the framing (class header + margin bar) is new.
function FleetAnalytics({
  classFilter = [],
  view = 'dashboard',
}: {
  classFilter?: string[]
  view?: 'summary' | 'dashboard'
}) {
  const classes =
    classFilter.length > 0 ? CLASS_ORDER.filter((c) => classFilter.includes(c)) : CLASS_ORDER
  const [expanded, setExpanded] = useState<Set<TripRow['cls']>>(
    () => new Set(classes[0] ? [classes[0]] : [])
  )
  const toggleExpanded = (cls: TripRow['cls']) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(cls) ? next.delete(cls) : next.add(cls)
      return next
    })

  return (
    <div className="fd-fleet">
      {classes.map((cls) => {
        const rows = tripRows.filter((r) => r.cls === cls)
        if (rows.length === 0) return null
        const truckCount = new Set(rows.map((r) => r.truck)).size
        const totalTime = rows.reduce((sum, r) => sum + drivingHours(r), 0)
        const totalMiles = rows.reduce((sum, r) => sum + r.totalMiles, 0)
        const totalDeadhead = rows.reduce((sum, r) => sum + deadheadMiles(r), 0)
        const totalIncome = rows.reduce((sum, r) => sum + r.income, 0)
        const totalCost = rows.reduce((sum, r) => sum + r.cost, 0)
        const totalProfit = rows.reduce((sum, r) => sum + r.profit, 0)
        const avgAdherence = rows.reduce((sum, r) => sum + r.adherence, 0) / rows.length
        const avgWastedRate = rows.reduce((sum, r) => sum + r.wastedRate, 0) / rows.length
        const totalLeakage = rows.reduce((sum, r) => sum + r.totalExcessCost, 0)
        const margin = totalIncome ? (totalProfit / totalIncome) * 100 : 0
        const isOpen = expanded.has(cls)
        // Bar length reads as margin quality: scaled against a 15% "great margin"
        // reference, floored so even a weak class still shows a sliver.
        const barPct = Math.max(6, Math.min(100, (Math.max(margin, 0) / 15) * 100))

        return (
          <div key={cls} className={`fd-fleet-class ${isOpen ? 'open' : ''}`}>
            <button
              className="fd-fleet-head"
              aria-expanded={isOpen}
              onClick={() => toggleExpanded(cls)}
            >
              <span className="fd-fleet-badge" style={{ background: CLASS_COLOR[cls] }}>
                {cls}
              </span>
              <span className="fd-fleet-count">{truckCount} trucks</span>
              <span className="fd-fleet-count">{rows.length} trips</span>
              <ChevronDown size={15} className="fd-fleet-chevron" />
            </button>
            <div className="fd-fleet-bar">
              <span style={{ width: `${barPct}%`, background: CLASS_COLOR[cls] }} />
            </div>
            {/* Collapsed: this total row is the only thing visible below the header.
                Expanded: it's dropped in favor of the trip table's own footer row,
                which shows the same total below the itemized trips instead. */}
            {!isOpen && (
              <div className="fd-fleet-total">
                <span className="fd-fleet-total-item"><i>Driving Time</i><b>{fmtHours(totalTime)}</b></span>
                <span className="fd-fleet-total-item"><i>Total Miles</i><b>{miles(totalMiles)}</b></span>
                <span className="fd-fleet-total-item"><i>Deadhead</i><b>{miles(totalDeadhead)}</b></span>
                <span className="fd-fleet-total-item"><i>Income</i><b>{usd(totalIncome)}</b></span>
                <span className="fd-fleet-total-item"><i>Cost</i><b>{usd(totalCost)}</b></span>
                <span className="fd-fleet-total-item"><i>Profit</i><b className="fd-strong">{usd(totalProfit)}</b></span>
                <span className="fd-fleet-total-item"><i>Adherence</i><b>{pct(avgAdherence)}</b></span>
                <span className="fd-fleet-total-item"><i>Wasted Rate</i><b>{pct(avgWastedRate)}</b></span>
                <span className="fd-fleet-total-item"><i>Leakage</i><b className="fd-neg">{usd(totalLeakage)}</b></span>
              </div>
            )}
            {isOpen && (
              <div className="fd-fleet-body">
                <TripsTable band={null} classFilter={[cls]} view={view} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function PvDeltaArrow({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') return <TrendingUp size={12} />
  if (trend === 'down') return <TrendingDown size={12} />
  return <Minus size={12} />
}
function pvToneClass(tone: ReturnType<typeof deltaTone>) {
  if (tone === 'green') return 'pos'
  if (tone === 'red') return 'neg'
  if (tone === 'orange' || tone === 'yellow') return 'warn'
  return ''
}

// A stat tile matching the Overview KPI card look: eyebrow, value + delta vs
// the active date filter's comparison window, then a descriptive foot line.
function StatTile({
  label,
  value,
  delta,
  goal,
  foot,
}: {
  label: string
  value: string
  delta?: string
  goal?: Goal
  foot?: string
}) {
  const { compareLabel, compareRange } = usePeriod()
  return (
    <div className="card kpi">
      <div className="kpi-head">
        <span className="eyebrow">{label}</span>
      </div>
      <div className="kpi-value-row">
        <span className="value">{value}</span>
        {delta && (
          <span className="kpi-cmp">
            <span className={`delta ${pvToneClass(deltaTone(delta, goal))}`}>
              <PvDeltaArrow trend={deltaTrend(delta)} />
              {delta}
            </span>
            <span
              className="crow-vs cmp-tip"
              data-tip={compareRange ? `Compared to ${compareRange}` : 'Compared to the previous period'}
            >
              {compareLabel}
            </span>
          </span>
        )}
      </div>
      {foot && <div className="foot">{foot}</div>}
    </div>
  )
}

// $ tick formatter for the line chart's y-axis and tooltip.
const fmtMoneyTick = (v: number) => {
  const a = Math.abs(v)
  return a >= 1000 ? `$${Math.round(v / 1000)}k` : usd(v)
}

// Income / Cost / Profit over time, ending at the fleet's real current
// totals. Profit is derived as income − cost at every point (not an
// independent wave), so the three lines always reconcile.
interface EvolutionLine {
  key: string
  label: string
  color: string
  s: number[]
}

// Pure line-chart renderer — given the lines, no opinion on which lines they
// are. Used for both the standard Income/Cost/Profit view and the by-category
// breakdown, which now live in separate places (card vs. detail modal) but
// share this exact rendering.
function EvolutionLineChart({
  lines,
  startLabel,
  endLabel,
}: {
  lines: EvolutionLine[]
  startLabel: string
  endLabel: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 1000
  const H = 210
  const padL = 46
  const padR = 10
  const padT = 16
  const padB = 22
  const n = lines[0]?.s.length ?? 0
  const all = lines.flatMap((l) => l.s)
  const min = Math.min(0, ...all)
  const max = Math.max(...all)
  const range = max - min || 1
  const x = (i: number) => padL + (i / (n - 1)) * (W - padL - padR)
  const y = (v: number) => padT + (1 - (v - min) / range) * (H - padT - padB)
  const path = (s: number[]) =>
    s.map((v, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const ticks = [0, 0.5, 1].map((t) => ({ y: padT + t * (H - padT - padB), v: max - t * range }))

  return (
    <div className="pv-line">
      <div className="pv-line-legend">
        {lines.map((l) => (
          <span className="pv-legend-item" key={l.key}>
            <i style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
      <div className="pv-line-plot">
        <svg
          className="pv-line-svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={padL} y1={t.y} x2={W - padR} y2={t.y} stroke="var(--border)" strokeWidth="1" />
              <text className="pv-axis-label" x={padL - 8} y={t.y + 3} textAnchor="end">
                {fmtMoneyTick(t.v)}
              </text>
            </g>
          ))}
          {lines.map((l) => (
            <path key={l.key} d={path(l.s)} fill="none" stroke={l.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {hover !== null && (
            <line x1={x(hover)} y1={padT} x2={x(hover)} y2={H - padB} stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3 3" />
          )}
          {lines.map((l) => (
            <circle key={l.key} cx={x(n - 1)} cy={y(l.s[n - 1])} r="4" fill={l.color} stroke="var(--bg)" strokeWidth="1.5" />
          ))}
          <text className="pv-axis-label" x={padL} y={H - 4} textAnchor="start">{startLabel}</text>
          <text className="pv-axis-label" x={W - padR} y={H - 4} textAnchor="end">{endLabel}</text>
        </svg>
        <div className="pv-line-dots">
          {Array.from({ length: n }, (_, i) => (
            <div
              key={i}
              className="pv-line-dot"
              style={{ left: `${(x(i) / W) * 100}%` }}
              onMouseEnter={() => setHover(i)}
            />
          ))}
        </div>
        {hover !== null && (
          <div className="pv-line-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
            {lines.map((l) => (
              <div className="pv-tip-row" key={l.key}>
                <i style={{ background: l.color }} />
                {l.label}: <b>{fmtMoneyTick(l.s[hover])}</b>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function standardEvolutionLines(income: number[], cost: number[], profit: number[]): EvolutionLine[] {
  return [
    { key: 'income', label: 'Income', color: 'var(--green)', s: income },
    { key: 'cost', label: 'Cost', color: 'var(--red)', s: cost },
    { key: 'profit', label: 'Profit', color: 'var(--blue)', s: profit },
  ]
}

// The card always shows Income/Cost/Profit — the by-category breakdown moved
// into the detail modal, so it doesn't compete with this for the same chart.
function MonetaryEvolutionChart({
  income,
  cost,
  profit,
  startLabel,
  endLabel,
}: {
  income: number[]
  cost: number[]
  profit: number[]
  startLabel: string
  endLabel: string
}) {
  return (
    <EvolutionLineChart
      lines={standardEvolutionLines(income, cost, profit)}
      startLabel={startLabel}
      endLabel={endLabel}
    />
  )
}

function MonetaryEvolutionDetailModal({
  income,
  cost,
  profit,
  categoryLines,
  startLabel,
  endLabel,
  onClose,
}: {
  income: number[]
  cost: number[]
  profit: number[]
  categoryLines: EvolutionLine[]
  startLabel: string
  endLabel: string
  onClose: () => void
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal delay-detail" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="title">
            <TrendingUp size={18} />
            Monetary Evolution
          </span>
          <button className="cfm-x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div className="dd-block">
            <div className="dd-block-title">Income, Cost & Profit</div>
            <EvolutionLineChart
              lines={standardEvolutionLines(income, cost, profit)}
              startLabel={startLabel}
              endLabel={endLabel}
            />
          </div>
          <div className="dd-block">
            <div className="dd-block-title">By Cost Category</div>
            <EvolutionLineChart lines={categoryLines} startLabel={startLabel} endLabel={endLabel} />
          </div>
        </div>
      </div>
    </div>
  )
}

// Deterministic 14-point trend shape, ending exactly at the real current
// total — a shape, not a claim about actual daily history. Resampled to the
// selected date filter's length so the chart's point count always matches
// the range it claims to show.
const EVOLUTION_WAVE = [0.86, 0.89, 0.91, 0.9, 0.93, 0.95, 0.94, 0.97, 0.99, 0.98, 1.0, 1.02, 1.01, 1.0]

// Linear-interpolates EVOLUTION_WAVE to `n` points. Anchors i=0 to wave[0]
// and i=n-1 to wave[last] (=1.0), so "ends at the real current total" still
// holds no matter which date filter is selected.
function resampleWave(wave: number[], n: number): number[] {
  const last = wave.length - 1
  if (n <= 1) return [wave[last]]
  return Array.from({ length: n }, (_, i) => {
    const pos = (i / (n - 1)) * last
    const lo = Math.floor(pos)
    const hi = Math.min(last, lo + 1)
    const t = pos - lo
    return wave[lo] * (1 - t) + wave[hi] * t
  })
}

const shortDate = (d: Date) => d.toLocaleString('en-US', { month: 'short', day: 'numeric' })

interface PieSegment {
  label: string
  color: string
  value: number
}

// The idle+unused pool has no per-cause field in the data (unlike driving,
// which splits honestly via each trip's deadheadPct). These fixed shares —
// reusing the app's existing categorical colors — spread that pool across
// the operational categories fleets actually track, the same "known split of
// an aggregate" approach costSegments already uses elsewhere.
const TIME_IDLE_WEIGHTS: { label: string; color: string; share: number }[] = [
  { label: 'Loading/Unloading', color: 'var(--orange)', share: 0.35 },
  { label: 'Detention', color: '#f4a6a6', share: 0.3 },
  { label: '30 min break rule', color: 'var(--yellow)', share: 0.12 },
  { label: 'Refueling', color: '#7CC8CF', share: 0.08 },
  { label: 'Personal Conveyance (PC)', color: 'var(--blue)', share: 0.08 },
  { label: 'Other resting/waiting', color: '#8a94a6', share: 0.07 },
]

// Same donut rendering as StatusDonut, generalized to any labeled set of
// segments — reused for cost distribution, time distribution, and the hours
// breakdown, each with its own value formatter (currency vs. duration).
function PieChart({
  segments,
  formatValue,
  totalLabel = 'Total',
}: {
  segments: PieSegment[]
  formatValue: (v: number) => string
  totalLabel?: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const total = segments.reduce((s, x) => s + x.value, 0)
  const R = 60
  const C = 2 * Math.PI * R
  let acc = 0

  return (
    <div className="dd-donut-row">
      <div className="ld-donut2">
        <svg viewBox="0 0 160 160">
          {segments.map((s, i) => {
            const p = total ? (s.value / total) * 100 : 0
            const len = (p / 100) * C
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
              <span className="ld-donut2-total" style={{ color: segments[hover].color }}>
                {total ? Math.round((segments[hover].value / total) * 100) : 0}%
              </span>
              <span className="ld-donut2-label">{segments[hover].label}</span>
            </>
          ) : (
            <>
              <span className="ld-donut2-total">{formatValue(total)}</span>
              <span className="ld-donut2-label">{totalLabel}</span>
            </>
          )}
        </div>
      </div>
      <div className="ld-legend">
        {segments.map((s, i) => (
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
            <span className="ld-legend-pct">{total ? Math.round((s.value / total) * 100) : 0}%</span>
            <span className="ld-legend-val">{formatValue(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TimeDistributionDetailModal({
  summarySegments,
  segments,
  onClose,
}: {
  summarySegments: PieSegment[]
  segments: PieSegment[]
  onClose: () => void
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal delay-detail" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="title">
            <Clock size={18} />
            Time Distribution
          </span>
          <button className="cfm-x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div className="dd-block">
            <div className="dd-block-title">Hours Summary</div>
            <PieChart segments={summarySegments} formatValue={fmtHours} />
          </div>
          <div className="dd-block">
            <div className="dd-block-title">Hours Breakdown</div>
            <PieChart segments={segments} formatValue={fmtHours} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Productivity({ classFilter = [] }: { classFilter?: string[] }) {
  const rows = classFilter.length > 0 ? tripRows.filter((r) => classFilter.includes(r.cls)) : tripRows
  const [delayModalOpen, setDelayModalOpen] = useState(false)
  const [evolutionModalOpen, setEvolutionModalOpen] = useState(false)
  const [timeModalOpen, setTimeModalOpen] = useState(false)
  const { rangeDays, rangeEnd } = usePeriod()

  const totalLoads = rows.length
  const totalTrucks = new Set(rows.map((r) => r.truck)).size
  const totalIncome = rows.reduce((sum, r) => sum + r.income, 0)
  const totalCost = rows.reduce((sum, r) => sum + r.cost, 0)
  const totalProfit = rows.reduce((sum, r) => sum + r.profit, 0)
  const profitability = totalIncome ? (totalProfit / totalIncome) * 100 : 0

  // Cost distribution: the shared cost-segment percentages (same story as the
  // Operation Details donut), scaled to this fleet's total cost.
  const costPieSegments: PieSegment[] = costSegments.map((s) => ({
    label: s.label,
    color: s.color,
    value: totalCost * (s.pct / 100),
  }))

  // Time distribution: real driving + idle hours per trip, plus whatever's
  // left of that trip's calendar window as "not used."
  let sumEffective = 0
  let sumIdle = 0
  let sumNotUsed = 0
  rows.forEach((r) => {
    const days = Math.max(1, dateSortValue(r.endDate) - dateSortValue(r.startDate) + 1)
    sumEffective += r.effectiveHours
    sumIdle += r.idleHours
    sumNotUsed += Math.max(0, days * 24 - r.effectiveHours - r.idleHours)
  })
  const timeShares = [
    { label: 'Effective hours', color: 'var(--green)', hours: sumEffective },
    { label: 'Non-productive hours', color: 'var(--yellow)', hours: sumIdle },
    { label: 'Not used hours', color: 'var(--red)', hours: sumNotUsed },
  ]
  const timePieSegments: PieSegment[] = timeShares.map((t) => ({
    label: t.label,
    color: t.color,
    value: t.hours,
  }))

  // Time distribution detail: the same driving/idle/unused totals as the
  // card's 3-bar view, split further into real operational sub-categories —
  // loaded vs. deadhead driving comes straight off each trip's deadheadPct;
  // the idle+unused pool (no per-cause field in the data) spreads across
  // TIME_IDLE_WEIGHTS.
  const deadheadHours = rows.reduce((sum, r) => sum + r.effectiveHours * (r.deadheadPct / 100), 0)
  const idlePoolHours = sumIdle + sumNotUsed
  const timeDetailSegments: PieSegment[] = [
    { label: 'Loaded Driving', color: 'var(--green)', value: sumEffective - deadheadHours },
    { label: 'Deadhead driving', color: 'var(--red)', value: deadheadHours },
    ...TIME_IDLE_WEIGHTS.map((w) => ({ label: w.label, color: w.color, value: idlePoolHours * w.share })),
  ]

  // Delay distribution: same Fair/Early/Late classification shown in the
  // detail modal — the card is just the compact preview of it.
  const { pickup: pickupDelaySegments, dropoff: dropoffDelaySegments } = getDelaySegments(rows)

  // Monetary Evolution's trend follows whatever date filter is selected —
  // same point count as the selected window, ending on rangeEnd.
  const evolutionWave = resampleWave(EVOLUTION_WAVE, Math.max(rangeDays, 2))
  const evolutionStart = new Date(rangeEnd)
  evolutionStart.setDate(evolutionStart.getDate() - (Math.max(rangeDays, 2) - 1))
  const evolutionStartLabel = shortDate(evolutionStart)
  const evolutionEndLabel = shortDate(rangeEnd)

  const incomeSeries = evolutionWave.map((w) => totalIncome * w)
  const costSeries = evolutionWave.map((w) => totalCost * w)
  const profitSeries = incomeSeries.map((v, i) => v - costSeries[i])

  // Each cost category's own trend — same wave shape as total cost, scaled to
  // that category's static share of it.
  const categorySeries = costSegments.map((s) => ({
    key: s.label,
    label: s.label,
    color: s.color,
    s: evolutionWave.map((w) => totalCost * (s.pct / 100) * w),
  }))

  return (
    <div className="pv">
      <div className="kpi-row">
        <StatTile
          label="Total Loads"
          value={totalLoads.toLocaleString()}
          delta="+1"
          goal="high"
          foot={totalTrucks ? `Across ${totalTrucks} truck${totalTrucks === 1 ? '' : 's'}` : undefined}
        />
        <StatTile
          label="Total Income"
          value={usd(totalIncome)}
          delta="+$620"
          goal="high"
          foot={totalLoads ? `${usd(totalIncome / totalLoads)} avg per load` : undefined}
        />
        <StatTile
          label="Total Cost"
          value={usd(totalCost)}
          delta="+$310"
          goal="low"
          foot={totalIncome ? `${pct((totalCost / totalIncome) * 100)} of income` : undefined}
        />
        <StatTile
          label="Total Profit"
          value={usd(totalProfit)}
          delta="+$310"
          goal="high"
          foot={totalLoads ? `${usd(totalProfit / totalLoads)} avg per load` : undefined}
        />
        <StatTile
          label="Margin"
          value={`${profitability.toFixed(1)}%`}
          delta="+0.4"
          goal="high"
          foot="Net profit as a share of revenue"
        />
      </div>

      <div className="grid-2 grid-2-even">
        <section className="card pv-panel">
          <div className="card-head">
            <span className="eyebrow">Cost Distribution by Type</span>
          </div>
          <div className="pv-pie-wrap">
            <PieChart segments={costPieSegments} formatValue={usd} />
          </div>
        </section>
        <section className="card pv-panel">
          <div className="card-head">
            <span className="eyebrow">Monetary Evolution</span>
            <button
              className="pv-panel-icon-btn cf-tip"
              aria-label="View monetary evolution details"
              data-tip="See the full breakdown, including the by-cost-category trend"
              onClick={() => setEvolutionModalOpen(true)}
            >
              <ArrowUpRight size={15} />
            </button>
          </div>
          <MonetaryEvolutionChart
            income={incomeSeries}
            cost={costSeries}
            profit={profitSeries}
            startLabel={evolutionStartLabel}
            endLabel={evolutionEndLabel}
          />
        </section>
      </div>

      <div className="grid-2 grid-2-even">
        <section className="card pv-panel">
          <div className="card-head">
            <span className="eyebrow">Time Distribution</span>
            <button
              className="pv-panel-icon-btn cf-tip"
              aria-label="View time distribution details"
              data-tip="See the full breakdown across driving, loading, and rest categories"
              onClick={() => setTimeModalOpen(true)}
            >
              <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="pv-pie-wrap">
            <PieChart segments={timePieSegments} formatValue={fmtHours} />
          </div>
        </section>
        <section className="card pv-panel">
          <div className="card-head">
            <span className="eyebrow">On-Time Performance</span>
            <button
              className="pv-panel-icon-btn cf-tip"
              aria-label="View on-time performance details"
              data-tip="See the full breakdown — pickup & delivery delays plus late-cause categories"
              onClick={() => setDelayModalOpen(true)}
            >
              <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="pv-delay-donuts">
            <StatusDonut title="Pick Up" segments={pickupDelaySegments} compact />
            <StatusDonut title="Delivery" segments={dropoffDelaySegments} compact />
          </div>
        </section>
      </div>

      {timeModalOpen && (
        <TimeDistributionDetailModal
          summarySegments={timePieSegments}
          segments={timeDetailSegments}
          onClose={() => setTimeModalOpen(false)}
        />
      )}
      {delayModalOpen && <DelayDetailModal rows={rows} onClose={() => setDelayModalOpen(false)} />}
      {evolutionModalOpen && (
        <MonetaryEvolutionDetailModal
          income={incomeSeries}
          cost={costSeries}
          profit={profitSeries}
          categoryLines={categorySeries}
          startLabel={evolutionStartLabel}
          endLabel={evolutionEndLabel}
          onClose={() => setEvolutionModalOpen(false)}
        />
      )}
    </div>
  )
}

function TripsTable({
  band,
  classFilter = [],
  view = 'dashboard',
  truckFilter = [],
  driverFilter = [],
  dimension = 'trucks',
  placeFilter = null,
  onClearPlaceFilter,
}: {
  band?: 'best' | 'worst' | null
  classFilter?: string[]
  view?: 'summary' | 'dashboard'
  truckFilter?: string[]
  driverFilter?: string[]
  dimension?: 'trucks' | 'drivers'
  placeFilter?: { code: string; name: string; direction: 'outbound' | 'inbound' | 'all' } | null
  onClearPlaceFilter?: () => void
}) {
  const [sortKey, setSortKey] = useState<SortKey | null>('profit')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = useState<TripRow | null>(null)
  const [selectedMove, setSelectedMove] = useState<RepositionRow | null>(null)
  const [query, setQuery] = useState('')
  // Also fold in empty repositioning moves (deadhead, no load) alongside trips.
  const [showReposition, setShowReposition] = useState(true)
  // Trips are stateful so assigning an operative gap can fold its empty miles
  // into the target load's deadhead and have the table reflect it live.
  const [trips, setTrips] = useState<TripRow[]>(tripRows)
  // Operative legs are editable: the operator can merge consecutive legs or
  // assign a run to the neighbouring load's deadhead. Seeded from data.
  const [opLegs, setOpLegs] = useState<RepositionRow[]>(repositionRows)
  const [gapDrawer, setGapDrawer] = useState<string | null>(null) // gapId being managed
  const [opToast, setOpToast] = useState<string | null>(null)
  // Merged operative trips whose constituent legs are expanded for viewing.
  const [expandedMerge, setExpandedMerge] = useState<Set<string>>(new Set())
  // Operative legs assigned into a load's deadhead. Each record keeps the
  // original legs + the miles/cost/leak folded in, so an assign can be undone.
  const [assignments, setAssignments] = useState<OpAssignment[]>([])
  // Append-only history of merge/assign actions, newest first. Entries flip to
  // active:false when reversed. Powers the change-log panel and the Undo actions.
  const [changeLog, setChangeLog] = useState<OpLogEntry[]>([])
  const [logOpen, setLogOpen] = useState(false)
  const [logScope, setLogScope] = useState<string | null>(null) // filter log to one loadRef
  const logSeq = useRef(0)
  const nextLogId = () => `log-${(logSeq.current += 1)}`
  // Empty = all statuses shown.
  const [statusFilter, setStatusFilter] = useState<TripRow['status'][]>([])
  const [statusFilterOpen, setStatusFilterOpen] = useState(false)
  const toggleStatusFilter = (status: TripRow['status']) =>
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    )

  // Drag-and-drop column reordering — every column (including Truck / Date /
  // Load / Status) can be dragged via its grip handle. Details stays last as
  // the fixed action column, outside this list.
  const [columnOrder, setColumnOrder] = useState<ColId[]>(() => ALL_COLUMNS.map((c) => c.key))
  const [dragOverKey, setDragOverKey] = useState<ColId | null>(null)
  const dragKeyRef = useRef<ColId | null>(null)

  const handleColDragStart = (key: ColId) => (e: React.DragEvent<HTMLTableCellElement>) => {
    dragKeyRef.current = key
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleColDragOver = (key: ColId) => (e: React.DragEvent<HTMLTableCellElement>) => {
    e.preventDefault()
    if (dragKeyRef.current && dragKeyRef.current !== key) setDragOverKey(key)
  }
  const handleColDragLeave = (key: ColId) => () => {
    setDragOverKey((k) => (k === key ? null : k))
  }
  const handleColDrop = (targetKey: ColId) => (e: React.DragEvent<HTMLTableCellElement>) => {
    e.preventDefault()
    const fromKey = dragKeyRef.current
    dragKeyRef.current = null
    setDragOverKey(null)
    if (!fromKey || fromKey === targetKey) return
    setColumnOrder((order) => {
      const next = [...order]
      next.splice(next.indexOf(fromKey), 1)
      next.splice(next.indexOf(targetKey), 0, fromKey)
      return next
    })
  }
  const handleColDragEnd = () => {
    dragKeyRef.current = null
    setDragOverKey(null)
  }

  // Arriving from "Worst trips" / "Best trips" just sorts by score:
  // worst → ascending (lowest first), best → descending (highest first).
  useEffect(() => {
    if (!band) return
    setSortKey('score')
    setSortDir(band === 'worst' ? 'asc' : 'desc')
  }, [band])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const byClass =
    classFilter.length > 0 ? trips.filter((r) => classFilter.includes(r.cls)) : trips

  // Only the active analysis dimension's filter applies — trucks and drivers
  // never narrow at the same time. In truck mode the header "Trucks:" filter
  // (also set by the Fuel & Savings map click) runs; in driver mode the
  // "Drivers:" filter runs instead.
  const byDriver =
    dimension === 'drivers'
      ? driverFilter.length > 0
        ? byClass.filter((r) => driverFilter.includes(r.driver))
        : byClass
      : truckFilter.length > 0
        ? byClass.filter((r) => truckFilter.includes(r.truck))
        : byClass

  // Arriving from a state's "Leaving X" / "Arriving to X" click, or the
  // Trips Here card's "view all" arrow, on the Fuel and Savings map — filters
  // to trips whose lane actually touches that state in the given direction
  // ('all' = either end, matching the deduped count "Trips Here" shows).
  const byPlace = placeFilter
    ? byDriver.filter((r) => {
        const parsed = parseLane(r.lane)
        if (placeFilter.direction === 'outbound') return parsed.origin === placeFilter.code
        if (placeFilter.direction === 'inbound') return parsed.dest === placeFilter.code
        return parsed.all.includes(placeFilter.code)
      })
    : byDriver

  // Free-text search is by city (lane) or load reference — truck filtering
  // is the header filter's job, not this box's.
  const q = query.trim().toLowerCase()
  const filtered = q
    ? byPlace.filter((r) => r.lane.toLowerCase().includes(q) || r.loadRef.toLowerCase().includes(q))
    : byPlace

  const byStatus =
    statusFilter.length > 0 ? filtered.filter((r) => statusFilter.includes(r.status)) : filtered

  // Repositioning moves run through the same class/truck/driver/place/search
  // filters, but not status (they have no invoice lifecycle) — they're only in
  // the list when the toggle is on.
  const repoRows: RepositionRow[] = showReposition
    ? opLegs.filter((r) => {
        if (classFilter.length > 0 && !classFilter.includes(r.cls)) return false
        if (truckFilter.length > 0 && !truckFilter.includes(r.truck)) return false
        if (driverFilter.length > 0 && !driverFilter.includes(r.driver)) return false
        if (placeFilter) {
          const parsed = parseLane(r.lane)
          if (placeFilter.direction === 'outbound') return parsed.origin === placeFilter.code
          if (placeFilter.direction === 'inbound') return parsed.dest === placeFilter.code
          return parsed.all.includes(placeFilter.code)
        }
        if (q) return r.lane.toLowerCase().includes(q) || r.reason.toLowerCase().includes(q)
        return true
      })
    : []

  // Trips sort normally; operative gaps aren't sorted on their own — each one
  // renders pinned directly above the load it leads into (see gapsByLoadRef),
  // so sorting the loads carries their operative trips along with them.
  const rows: TripRow[] = sortKey
    ? [...byStatus].sort((a, b) => {
        const cmp = SORT_ACCESSOR[sortKey](a) - SORT_ACCESSOR[sortKey](b)
        return sortDir === 'asc' ? cmp : -cmp
      })
    : byStatus
  const combined: TableRow[] = [...byStatus, ...repoRows]

  // Operative legs grouped into their gaps (a gap = one empty stretch split into
  // consecutive legs), ordered by seq, preserving the order gaps first appear.
  const opGroups: { gapId: string; legs: RepositionRow[] }[] = []
  repoRows.forEach((leg) => {
    let g = opGroups.find((x) => x.gapId === leg.gapId)
    if (!g) {
      g = { gapId: leg.gapId, legs: [] }
      opGroups.push(g)
    }
    g.legs.push(leg)
  })
  opGroups.forEach((g) => g.legs.sort((a, b) => a.seq - b.seq))

  // How many operative trips (legs) lead into each load — computed from the full
  // opLegs list regardless of the toggle, so a load can hint "N operative trips
  // before pickup" even when the operative rows are hidden.
  const opCountByLoad = new Map<string, number>()
  opLegs.forEach((leg) => {
    const target = trips.find((t) => t.truck === leg.truck)
    if (target) opCountByLoad.set(target.loadRef, (opCountByLoad.get(target.loadRef) ?? 0) + 1)
  })

  // Pin each operative gap above the load it leads into, so the user reads the
  // empty legs immediately before the deadhead they'd become part of. A gap
  // whose target load isn't in the current view (filtered out) falls back to an
  // "orphan" list rendered after the loads. `targetLoadFor` decides the load.
  type OpGroup = { gapId: string; legs: RepositionRow[] }
  const gapsByLoadRef = new Map<string, OpGroup[]>()
  const orphanGaps: OpGroup[] = []
  opGroups.forEach((g) => {
    // Same rule as targetLoadFor (defined below): the truck's load in the table.
    const target = trips.find((t) => t.truck === g.legs[0].truck)
    if (target && rows.some((r) => r.loadRef === target.loadRef)) {
      const arr = gapsByLoadRef.get(target.loadRef) ?? []
      arr.push(g)
      gapsByLoadRef.set(target.loadRef, arr)
    } else {
      orphanGaps.push(g)
    }
  })

  // Totals: dollar columns (and Total Miles) sum across all trips. Percentages
  // can't be summed meaningfully, so Adherence/Wasted Rate show the average
  // instead. Computed per subset so both the flat table and each group's own
  // footer can share this.
  // Moves add operational load (time, miles — all deadhead — cost) and a straight
  // profit drag; they earn no income (so income stays trip-only) but they DO
  // carry route adherence and money leakage, so those fold moves in. Wasted Rate
  // has no meaning for an empty move, so its average stays trip-only. Profit
  // reconciles: income − cost still holds because a move's profit is exactly −cost.
  const computeTotals = (subset: TableRow[]) => {
    const trips = subset.filter((r): r is TripRow => !isReposition(r))
    const moves = subset.filter(isReposition)
    const moveCost = moves.reduce((sum, r) => sum + r.cost, 0)
    // Adherence averages over everything that carries the metric — every trip
    // and every move does, so the denominator is the full shown set.
    const gradedCount = trips.length + moves.length
    const adherenceSum =
      trips.reduce((s, r) => s + r.adherence, 0) + moves.reduce((s, r) => s + r.adherence, 0)
    return {
      tripCount: trips.length,
      moveCount: moves.length,
      totalTime: trips.reduce((sum, r) => sum + drivingHours(r), 0) + moves.reduce((s, r) => s + r.effectiveHours, 0),
      totalDistance: trips.reduce((sum, r) => sum + r.totalMiles, 0) + moves.reduce((s, r) => s + r.totalMiles, 0),
      totalDeadhead: trips.reduce((sum, r) => sum + deadheadMiles(r), 0) + moves.reduce((s, r) => s + r.totalMiles, 0),
      totalIncome: trips.reduce((sum, r) => sum + r.income, 0),
      totalCost: trips.reduce((sum, r) => sum + r.cost, 0) + moveCost,
      totalProfit: trips.reduce((sum, r) => sum + r.profit, 0) - moveCost,
      avgAdherence: gradedCount ? adherenceSum / gradedCount : 0,
      avgWastedRate: trips.length ? trips.reduce((sum, r) => sum + r.wastedRate, 0) / trips.length : 0,
      totalLeakage: trips.reduce((sum, r) => sum + r.totalExcessCost, 0) + moves.reduce((s, r) => s + r.leakage, 0),
    }
  }

  // ── Operative-leg actions (driven by the timeline drawer) ──
  const round1 = (n: number) => Math.round(n * 10) / 10
  const laneEnds = (lane: string) => lane.split('→').map((s) => s.trim())
  // Merge consecutive legs of one gap into a single operative trip spanning the
  // first leg's start to the last leg's end.
  const mergeLegs = (ids: string[]) => {
    const chosen = opLegs.filter((l) => ids.includes(l.id)).sort((a, b) => a.seq - b.seq)
    if (chosen.length < 2) return
    const first = chosen[0]
    const last = chosen[chosen.length - 1]
    const sum = (f: (l: RepositionRow) => number) => chosen.reduce((s, l) => s + f(l), 0)
    const miles = sum((l) => l.totalMiles)
    const mergedId = `${first.gapId}-merged-${first.seq}`
    const merged: RepositionRow = {
      ...first,
      id: mergedId,
      endDate: last.endDate,
      lane: `${laneEnds(first.lane)[0]} → ${laneEnds(last.lane)[1]}`,
      reason: `Merged ${chosen.length} empty legs into one operative trip`,
      totalMiles: miles,
      effectiveHours: round1(sum((l) => l.effectiveHours)),
      cost: sum((l) => l.cost),
      leakage: sum((l) => l.leakage),
      adherence: miles ? round1(sum((l) => l.adherence * l.totalMiles) / miles) : first.adherence,
      mergedFrom: chosen,
    }
    // Merges of unassigned operative trips are NOT logged in the change log —
    // they're managed inline on the merged trip itself (see the "Merged from N
    // legs" control + Separate). The change log is only for load assignments.
    setOpLegs((prev) => [...prev.filter((l) => !ids.includes(l.id)), merged])
    setGapDrawer(null)
    setOpToast(`Merged ${ids.length} legs into one operative trip`)
  }
  // Split a merged operative trip back into the legs it was built from.
  const unmergeLeg = (mergedId: string) => {
    const merged = opLegs.find((l) => l.id === mergedId)
    if (!merged?.mergedFrom) return
    setOpLegs((prev) => [...prev.filter((l) => l.id !== mergedId), ...merged.mergedFrom!])
    setExpandedMerge((prev) => {
      const next = new Set(prev)
      next.delete(mergedId)
      return next
    })
    setOpToast(`Split back into ${merged.mergedFrom.length} operative legs`)
  }
  // The load an operative gap leads into — the same truck's next load in the
  // table. Assigning the gap folds its empty miles into this load's deadhead.
  const targetLoadFor = (truck: string) => trips.find((t) => t.truck === truck) ?? null
  // Reassign a contiguous run to that load's deadhead: the legs leave the
  // operative list and the load's deadhead miles, cost, profit, leakage and
  // deadhead % all update to include them.
  const assignLegs = (ids: string[]) => {
    const chosen = opLegs.filter((l) => ids.includes(l.id))
    if (chosen.length === 0) return
    const miles = chosen.reduce((s, l) => s + l.totalMiles, 0)
    const cost = chosen.reduce((s, l) => s + l.cost, 0)
    const leak = chosen.reduce((s, l) => s + l.leakage, 0)
    const target = targetLoadFor(chosen[0].truck)
    if (target) {
      setTrips((prev) =>
        prev.map((t) => {
          if (t.loadRef !== target.loadRef) return t
          const totalMiles = t.totalMiles + miles
          const newCost = t.cost + cost
          return {
            ...t,
            totalMiles,
            cost: newCost,
            profit: t.income - newCost,
            totalExcessCost: t.totalExcessCost + leak,
            deadheadPct: round1(((totalMiles - t.loadedMiles) / totalMiles) * 100),
          }
        }),
      )
    }
    setOpLegs((prev) => prev.filter((l) => !ids.includes(l.id)))
    if (target) {
      const assignmentId = `asg-${(logSeq.current += 1)}`
      setAssignments((prev) => [...prev, { id: assignmentId, loadRef: target.loadRef, legs: chosen, miles, cost, leak }])
      setChangeLog((prev) => [
        {
          id: nextLogId(),
          kind: 'assign',
          title: `Assigned ${chosen.length} leg${chosen.length === 1 ? '' : 's'} to ${target.loadRef}`,
          detail: `${miles.toLocaleString()} mi · ${usd(cost)} folded into the load's deadhead`,
          loadRef: target.loadRef,
          refId: assignmentId,
          active: true,
        },
        ...prev,
      ])
    }
    setGapDrawer(null)
    setOpToast(
      `Assigned ${chosen.length} leg${chosen.length === 1 ? '' : 's'} · ${miles.toLocaleString()} mi · ${usd(cost)} to ${target ? target.loadRef : 'the next load'} deadhead`,
    )
  }
  // Reverse an assign: pull the folded miles/cost/leak back out of the load and
  // return the legs to the operative list.
  const detachAssignment = (assignmentId: string) => {
    const a = assignments.find((x) => x.id === assignmentId)
    if (!a) return
    setTrips((prev) =>
      prev.map((t) => {
        if (t.loadRef !== a.loadRef) return t
        const totalMiles = t.totalMiles - a.miles
        const newCost = t.cost - a.cost
        return {
          ...t,
          totalMiles,
          cost: newCost,
          profit: t.income - newCost,
          totalExcessCost: t.totalExcessCost - a.leak,
          deadheadPct: totalMiles > 0 ? round1(((totalMiles - t.loadedMiles) / totalMiles) * 100) : 0,
        }
      }),
    )
    setOpLegs((prev) => [...prev, ...a.legs])
    setAssignments((prev) => prev.filter((x) => x.id !== assignmentId))
    setChangeLog((prev) => prev.map((e) => (e.refId === assignmentId ? { ...e, active: false } : e)))
    setOpToast(`Detached ${a.legs.length} leg${a.legs.length === 1 ? '' : 's'} from ${a.loadRef}`)
  }

  // Cells for every column, rendered in whatever order columnOrder says.
  const renderCell = (key: ColId, r: TripRow) => {
    switch (key) {
      case 'truck':
        return (
          <td key={key} className="fd-left">
            <div className="fd-truck-row">
              <span className="fd-truck">{r.truck}</span>
              <span className="fd-class" style={{ background: CLASS_COLOR[r.cls] }}>
                {r.cls}
              </span>
            </div>
            <div className="fd-driver fd-dim">{r.driver}</div>
          </td>
        )
      case 'startDate':
        return (
          <td key={key} className="fd-left fd-dim">
            {view === 'summary' ? fullDateRange(r) : dateRange(r)}
          </td>
        )
      case 'load': {
        const asg = assignments.filter((a) => a.loadRef === r.loadRef)
        const legCount = asg.reduce((s, a) => s + a.legs.length, 0)
        // Operative trips leading into this load, shown as a heads-up only when
        // the toggle is off (when it's on they're pinned above the row instead).
        const opCount = opCountByLoad.get(r.loadRef) ?? 0
        return (
          <td key={key} className="fd-left">
            <div className="fd-load-ref">{r.loadRef}</div>
            <div className="fd-load-route fd-dim">{r.lane}</div>
            {legCount > 0 && (
              <button
                className="fd-load-ophint cf-tip"
                onClick={(e) => {
                  e.stopPropagation()
                  setLogScope(r.loadRef)
                  setLogOpen(true)
                }}
                data-tip="Operative trips folded into this load's deadhead — click to manage or detach"
              >
                <Layers size={12} />
                {legCount} operative trip{legCount === 1 ? '' : 's'} in DH
              </button>
            )}
            {!showReposition && opCount > 0 && (
              <button
                className="fd-load-opnote cf-tip"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowReposition(true)
                }}
                data-tip="Operative Trips are DH movements before going to pickup the Load"
              >
                <Navigation size={12} />
                {opCount} operative trip{opCount === 1 ? '' : 's'} before pickup of this load
              </button>
            )}
          </td>
        )
      }
      case 'status':
        return (
          <td key={key} className="fd-left">
            <StatusBadge status={r.status} />
          </td>
        )
      case 'time':
        return (
          <td key={key} className="fd-dim">
            {r.estimatedTime ? (
              <span
                className="fd-est cf-tip"
                data-tip="Estimated Driving Hours"
              >
                {fmtHours(drivingHours(r))}
                <span className="fd-est-tag">Est.</span>
              </span>
            ) : (
              fmtHours(drivingHours(r))
            )}
          </td>
        )
      case 'distance':
        return <td key={key} className="fd-dim">{miles(r.totalMiles)}</td>
      case 'deadhead':
        return <td key={key} className="fd-dim">{miles(deadheadMiles(r))}</td>
      case 'income':
        return <td key={key}>{usd(r.income)}</td>
      case 'cost':
        return <td key={key} className="fd-dim">{usd(r.cost)}</td>
      case 'profit':
        return <td key={key} className="fd-strong">{usd(r.profit)}</td>
      case 'adherence':
        return <td key={key} className="fd-dim">{pct(r.adherence)}</td>
      case 'wastedRate':
        return <td key={key} className="fd-dim">{pct(r.wastedRate)}</td>
      case 'leakage':
        return <td key={key} className="fd-neg">{usd(r.totalExcessCost)}</td>
      default:
        return null
    }
  }
  // Same columns, but for an empty repositioning move: real operational values
  // (time / miles — all deadhead — / cost / −cost profit) and a clear
  // "Repositioning" marker in place of a load; revenue & quality columns read
  // "—" since a move earns and scores nothing.
  const na = <span className="fd-na">—</span>
  const renderRepositionCell = (key: ColId, r: RepositionRow) => {
    switch (key) {
      case 'truck':
        return (
          <td key={key} className="fd-left">
            <div className="fd-truck-row">
              <span className="fd-truck">{r.truck}</span>
              <span className="fd-class" style={{ background: CLASS_COLOR[r.cls] }}>{r.cls}</span>
            </div>
            <div className="fd-driver fd-dim">{r.driver}</div>
          </td>
        )
      case 'startDate':
        return <td key={key} className="fd-left fd-dim">{view === 'summary' ? fullDateRange(r) : dateRange(r)}</td>
      case 'load':
        return (
          <td key={key} className="fd-left">
            <span className="fd-repo-tag cf-tip" data-tip={r.reason}>
              <Navigation size={11} /> Operative trip
            </span>
            <div className="fd-load-route fd-dim">{r.lane}</div>
          </td>
        )
      case 'status':
        return <td key={key} className="fd-left"><span className="fd-status" style={{ color: 'var(--red)' }}>DH</span></td>
      case 'time':
        return <td key={key} className="fd-dim">{fmtHours(r.effectiveHours)}</td>
      case 'distance':
        return <td key={key} className="fd-dim">{miles(r.totalMiles)}</td>
      case 'deadhead':
        return <td key={key} className="fd-dim">{miles(r.totalMiles)}</td>
      case 'income':
        return <td key={key}>{na}</td>
      case 'cost':
        return <td key={key} className="fd-dim">{usd(r.cost)}</td>
      case 'profit':
        return <td key={key} className="fd-neg">{usd(-r.cost)}</td>
      case 'adherence':
        return <td key={key} className="fd-dim">{pct(r.adherence)}</td>
      case 'leakage':
        return <td key={key} className="fd-neg">{usd(r.leakage)}</td>
      case 'wastedRate':
        return <td key={key} className="fd-dim">{na}</td>
      default:
        return null
    }
  }
  const renderFooterCell = (key: ColId, t: ReturnType<typeof computeTotals>) => {
    switch (key) {
      case 'truck':
      case 'startDate':
      case 'load':
      case 'status':
        return <td key={key} className="fd-left" />
      case 'time':
        return <td key={key} className="fd-dim">{fmtHours(t.totalTime)}</td>
      case 'distance':
        return <td key={key} className="fd-dim">{miles(t.totalDistance)}</td>
      case 'deadhead':
        return <td key={key} className="fd-dim">{miles(t.totalDeadhead)}</td>
      case 'income':
        return <td key={key} className="fd-strong">{usd(t.totalIncome)}</td>
      case 'cost':
        return <td key={key} className="fd-dim">{usd(t.totalCost)}</td>
      case 'profit':
        return <td key={key} className="fd-strong">{usd(t.totalProfit)}</td>
      case 'adherence':
        return (
          <td key={key} className="fd-dim">
            {pct(t.avgAdherence)}{' '}
            <span className="fd-avg-tag cf-tip" data-tip="Average across all trips shown, not a sum">
              avg
            </span>
          </td>
        )
      case 'wastedRate':
        return (
          <td key={key} className="fd-dim">
            {pct(t.avgWastedRate)}{' '}
            <span className="fd-avg-tag cf-tip" data-tip="Average across all trips shown, not a sum">
              avg
            </span>
          </td>
        )
      case 'leakage':
        return <td key={key} className="fd-neg">{usd(t.totalLeakage)}</td>
      default:
        return null
    }
  }

  const renderTripRow = (r: TripRow) => (
    <tr key={rowKey(r)}>
      {columnOrder.map((key) => renderCell(key, r))}
      <td>
        <button className="fd-view" aria-label="View trip details" onClick={() => setSelected(r)}>
          View <Eye size={13} />
        </button>
      </td>
    </tr>
  )

  const colCount = columnOrder.length + 1

  // One operative gap, rendered as its header row (truck · legs · lane · the
  // load it leads into, with merge/assign/separate actions) followed by its leg
  // rows. Returned as a keyed fragment so it can sit inside a load's <tbody>,
  // pinned directly above that load.
  const renderOpGroup = (g: OpGroup) => {
      const legs = g.legs
      const first = legs[0]
      const last = legs[legs.length - 1]
      const [origin] = laneEnds(first.lane)
      const dest = laneEnds(last.lane)[1]
      const target = targetLoadFor(first.truck)
      // A single merged leg carries mergedFrom — offer to split it back instead
      // of merging. Multi-leg gaps offer merge/assign via the drawer.
      const mergedLeg = legs.length === 1 && legs[0].mergedFrom ? legs[0] : null
      const mergeExpanded = mergedLeg ? expandedMerge.has(mergedLeg.id) : false
      return (
        <Fragment key={g.gapId}>
          <tr className="fd-op-gap-head">
            <td colSpan={colCount}>
              <div className="fd-op-gap-inner">
                <span className="fd-op-gap-title">
                  <Navigation size={13} />
                  <span className="fd-op-gap-truck">{first.truck}</span>
                  <span className="fd-op-gap-meta">
                    {mergedLeg ? (
                      <>
                        <button
                          type="button"
                          className={`fd-op-merged-tag cf-tip ${mergeExpanded ? 'open' : ''}`}
                          onClick={() =>
                            setExpandedMerge((prev) => {
                              const next = new Set(prev)
                              next.has(mergedLeg.id) ? next.delete(mergedLeg.id) : next.add(mergedLeg.id)
                              return next
                            })
                          }
                          data-tip="See the legs this operative trip was merged from"
                        >
                          <Merge size={11} /> Merged from {mergedLeg.mergedFrom!.length} legs
                          {mergeExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </button>{' '}
                        · {origin} → {dest} · leads to{' '}
                      </>
                    ) : (
                      <>
                        {legs.length} {legs.length === 1 ? 'leg' : 'legs'} · {origin} → {dest} · leads to{' '}
                      </>
                    )}
                    <span className="fd-op-gap-load">{target ? target.loadRef : first.nextLoadId}</span>
                  </span>
                </span>
                {mergedLeg ? (
                  <button className="fd-op-manage" onClick={() => unmergeLeg(mergedLeg.id)}>
                    <Split size={13} /> Separate
                  </button>
                ) : (
                  <button className="fd-op-manage" onClick={() => setGapDrawer(g.gapId)}>
                    <Merge size={13} /> {legs.length >= 2 ? 'Merge trips' : 'Assign to load'}
                  </button>
                )}
              </div>
            </td>
          </tr>
          {legs.map((r) => (
            <tr key={r.id} className="fd-repo-row">
              {columnOrder.map((key) => renderRepositionCell(key, r))}
              <td>
                <button className="fd-view" aria-label="View operative trip details" onClick={() => setSelectedMove(r)}>
                  View <Eye size={13} />
                </button>
              </td>
            </tr>
          ))}
          {/* The original legs behind a merged operative trip, shown read-only
              when the "Merged from N legs" tag is expanded — so the user can see
              exactly what was combined before deciding to Separate. */}
          {mergedLeg &&
            mergeExpanded &&
            mergedLeg.mergedFrom!.map((sub) => (
              <tr key={`sub-${sub.id}`} className="fd-repo-row fd-repo-subleg">
                {columnOrder.map((key) => renderRepositionCell(key, sub))}
                <td>
                  <button className="fd-view" aria-label="View leg details" onClick={() => setSelectedMove(sub)}>
                    View <Eye size={13} />
                  </button>
                </td>
              </tr>
            ))}
        </Fragment>
      )
  }

  const renderThead = () => (
    <thead>
      <tr>
        {columnOrder.map((key) => {
          const c = ALL_COLUMNS.find((col) => col.key === key)!
          return (
            <th
              key={key}
              className={`${c.left ? 'fd-left' : ''} ${dragOverKey === key ? 'fd-col-dragover' : ''}`}
              draggable
              onDragStart={handleColDragStart(key)}
              onDragOver={handleColDragOver(key)}
              onDragLeave={handleColDragLeave(key)}
              onDrop={handleColDrop(key)}
              onDragEnd={handleColDragEnd}
            >
              <span className="fd-drag-handle" aria-hidden="true">
                <GripVertical size={12} />
              </span>
              {key === 'status' ? (
                <span className="fd-th-filter cf">
                  {c.label}
                  <button
                    className={`fd-th-filter-btn ${statusFilter.length > 0 ? 'active' : ''}`}
                    aria-label="Filter by status"
                    onClick={() => setStatusFilterOpen((o) => !o)}
                  >
                    <Filter size={12} />
                  </button>
                  {statusFilterOpen && (
                    <>
                      <div className="cf-backdrop" onClick={() => setStatusFilterOpen(false)} />
                      <div className="cf-menu cf-list">
                        <button
                          className={`cf-item ${statusFilter.length === 0 ? 'active' : ''}`}
                          onClick={() => setStatusFilter([])}
                        >
                          All statuses
                          {statusFilter.length === 0 && <Check size={17} className="cf-check" />}
                        </button>
                        {(Object.keys(STATUS_STYLE) as TripRow['status'][]).map((s) => {
                          const active = statusFilter.includes(s)
                          return (
                            <button
                              key={s}
                              className={`cf-item ${active ? 'active' : ''}`}
                              onClick={() => toggleStatusFilter(s)}
                            >
                              {STATUS_STYLE[s].label}
                              {active && <Check size={17} className="cf-check" />}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </span>
              ) : c.sortable ? (
                <button
                  className={`fd-sort ${sortKey === key ? 'active' : ''}`}
                  onClick={() => toggleSort(key as SortKey)}
                >
                  {c.label}
                  {sortKey === key ? (
                    sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                  ) : (
                    <ChevronDown size={12} className="fd-sort-idle" />
                  )}
                </button>
              ) : (
                c.label
              )}
            </th>
          )
        })}
        <th>Details</th>
      </tr>
    </thead>
  )

  // The "Total · N trips" label always anchors the first cell of the footer
  // row — reordering columns moves data around, but this stays a fixed
  // read of "where the row starts," regardless of which column that is.
  const renderFooterRow = (t: ReturnType<typeof computeTotals>) => (
    <tfoot>
      <tr>
        {columnOrder.map((key, i) => {
          if (i !== 0) return renderFooterCell(key, t)
          const left = ALL_COLUMNS.find((c) => c.key === key)?.left
          return (
            <td key={key} className={`fd-total-cell ${left ? 'fd-left' : ''}`}>
              {/* Absolutely positioned so this label never widens the first
                  column — it just overflows across the empty footer cells to
                  its right (Date/Load/Status totals are blank). Otherwise the
                  longer "· N operative" text would stretch the Truck column. */}
              <span className="fd-total-inner">
                <span className="fd-total-label">Total</span>
                <span className="fd-total-count">
                  {t.tripCount} trips
                  {t.moveCount > 0 && ` · ${t.moveCount} operative`}
                </span>
              </span>
            </td>
          )
        })}
        <td />
      </tr>
    </tfoot>
  )

  return (
    <>
      <div className="fd-search-row">
        <div className="fd-search">
          <Search size={14} className="fd-search-icon" />
          <input
            type="text"
            placeholder="Search by city or load id"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="fd-search-clear" aria-label="Clear search" onClick={() => setQuery('')}>
              <X size={13} />
            </button>
          )}
        </div>
        {placeFilter && (
          <div className="fd-place-chip">
            {placeFilter.direction === 'outbound'
              ? 'Trips leaving'
              : placeFilter.direction === 'inbound'
                ? 'Trips arriving to'
                : 'All trips in & out of'}{' '}
            {placeFilter.name}
            <button aria-label="Clear place filter" onClick={onClearPlaceFilter}>
              <X size={12} />
            </button>
          </div>
        )}
        {changeLog.length > 0 && (
          <button
            className="fd-oplog-btn cf-tip"
            onClick={() => {
              setLogScope(null)
              setLogOpen(true)
            }}
            data-tip="History of operative-trip merges and deadhead assignments — undo any of them"
          >
            <History size={14} />
            Change log
            <span className="fd-oplog-count">{changeLog.filter((e) => e.active).length}</span>
          </button>
        )}
        <button
          className={`fd-repo-toggle cf-tip ${showReposition ? 'on' : ''}`}
          role="switch"
          aria-checked={showReposition}
          onClick={() => setShowReposition((s) => !s)}
          data-tip="Operative trips — empty (deadhead) moves made on dispatch instruction, not tied to any load"
        >
          <Navigation size={14} />
          Operative trips
          <span className="fd-repo-switch" aria-hidden="true"><span /></span>
        </button>
      </div>
      <div className="fd-table-wrap">
        <table className="fd-table">
          {renderThead()}
          {rows.length === 0 && opGroups.length === 0 ? (
            <tbody>
              <tr>
                <td className="fd-no-results" colSpan={colCount}>
                  {query ? `No trips match "${query}"` : 'No trips match this filter'}
                </td>
              </tr>
            </tbody>
          ) : (
            // Each load gets its own <tbody> block holding the operative gaps
            // pinned above it, then the load row — so sorting reorders whole
            // blocks and each load's operative trips stay glued to it.
            rows.map((load) => {
              const gaps = gapsByLoadRef.get(load.loadRef)
              return (
                <tbody key={rowKey(load)} className={gaps?.length ? 'fd-load-block has-ops' : 'fd-load-block'}>
                  {gaps?.map((g) => renderOpGroup(g))}
                  {renderTripRow(load)}
                </tbody>
              )
            })
          )}
          {/* Gaps whose load isn't in the current view fall here so they're never lost. */}
          {showReposition && orphanGaps.length > 0 && (
            <tbody className="fd-op-group">{orphanGaps.map((g) => renderOpGroup(g))}</tbody>
          )}
          {renderFooterRow(computeTotals(combined))}
        </table>
      </div>
      {selected && <TripDetailModal trip={selected} onClose={() => setSelected(null)} />}
      {selectedMove && (
        <TripDetailModal trip={repoAsTrip(selectedMove)} repo onClose={() => setSelectedMove(null)} />
      )}
      {gapDrawer && (() => {
        const legs = opLegs.filter((l) => l.gapId === gapDrawer).sort((a, b) => a.seq - b.seq)
        const target = legs[0] ? targetLoadFor(legs[0].truck) : null
        return (
          <OperativeGapDrawer
            legs={legs}
            nextLoad={{
              id: target ? target.loadRef : legs[0]?.nextLoadId ?? '',
              lane: target ? target.lane : legs[0]?.nextLoadLane ?? '',
            }}
            onClose={() => setGapDrawer(null)}
            onMerge={mergeLegs}
            onAssign={assignLegs}
          />
        )
      })()}
      {logOpen && (() => {
        const entries = logScope ? changeLog.filter((e) => e.loadRef === logScope) : changeLog
        const close = () => {
          setLogOpen(false)
          setLogScope(null)
        }
        return (
          <div className="op-log-overlay" onClick={close}>
            <div className="op-log-panel" onClick={(e) => e.stopPropagation()}>
              <div className="op-log-head">
                <span className="op-log-title">
                  <History size={15} />
                  {logScope ? `Changes to ${logScope}` : 'Operative trips · change log'}
                </span>
                <button className="cfm-x" onClick={close} aria-label="Close">
                  <X size={17} />
                </button>
              </div>
              {logScope && (
                <button className="op-log-clearscope" onClick={() => setLogScope(null)}>
                  Show all changes
                </button>
              )}
              <div className="op-log-body">
                {entries.length === 0 ? (
                  <p className="op-log-empty">No changes recorded yet.</p>
                ) : (
                  entries.map((e) => (
                    <div key={e.id} className={`op-log-item ${e.active ? '' : 'reverted'}`}>
                      <span className={`op-log-icon op-log-icon-${e.kind}`}>
                        {e.kind === 'merge' ? <Merge size={14} /> : <ArrowUpRight size={14} />}
                      </span>
                      <div className="op-log-text">
                        <span className="op-log-item-title">{e.title}</span>
                        <span className="op-log-item-detail">{e.detail}</span>
                      </div>
                      {e.active ? (
                        <button
                          className="op-log-undo"
                          onClick={() =>
                            e.kind === 'merge'
                              ? e.refId && unmergeLeg(e.refId)
                              : e.refId && detachAssignment(e.refId)
                          }
                        >
                          {e.kind === 'merge' ? <Split size={12} /> : <Undo2 size={12} />}
                          {e.kind === 'merge' ? 'Separate' : 'Detach'}
                        </button>
                      ) : (
                        <span className="op-log-reverted-tag">Reverted</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )
      })()}
      {opToast && <Toast message={opToast} onDone={() => setOpToast(null)} />}
    </>
  )
}
