import { useEffect, useRef, useState } from 'react'
import { ChevronUp, ChevronDown, Eye, Search, X, CheckCircle2, Clock, GripVertical } from 'lucide-react'
import { tripRows, type TripRow } from '../data'
import TripDetailModal from './TripDetailModal'

const SUBTABS = ['Trips', 'Fleet Analytics', 'Productivity', 'Fuel & Savings', 'Rewards'] as const
type SubTab = (typeof SUBTABS)[number]

// V1 ("summary") drops the Rewards subtab; V2 ("dashboard") keeps the full set.
const subtabsForView = (view: 'summary' | 'dashboard'): readonly SubTab[] =>
  view === 'summary' ? SUBTABS.filter((t) => t !== 'Rewards') : SUBTABS

const CLASS_COLOR: Record<TripRow['cls'], string> = {
  A: 'var(--green)',
  B: 'var(--blue)',
  C: 'var(--orange)',
  D: 'var(--red)',
}

const STATUS_STYLE: Record<TripRow['status'], { label: string; color: string; icon: typeof CheckCircle2 }> = {
  completed: { label: 'Completed', color: 'var(--green)', icon: CheckCircle2 },
  'in-progress': { label: 'In Progress', color: 'var(--blue)', icon: Clock },
}

// ── Formatters ────────────────────────────────────────────────────────────
const usd = (n: number) => '$' + Math.round(n).toLocaleString()
const pct = (n: number) => n.toFixed(1) + '%'
const miles = (n: number) => n.toLocaleString() + ' mi'
// "9h 24m" — built from the trip's real effectiveHours + idleHours, not an estimate.
const fmtHours = (h: number) => {
  const totalMin = Math.round(h * 60)
  return `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`
}
const tripHours = (r: TripRow) => r.effectiveHours + r.idleHours

// ── Sorting ───────────────────────────────────────────────────────────────
// Truck, Date, and Lane are plain (unsortable) — only the metric columns sort.
// 'score' has no column of its own but stays sortable internally — arriving
// from a "Worst trips"/"Best trips" link ranks rows by it without showing it.
type SortKey =
  | 'score' | 'time' | 'distance' | 'income' | 'cost' | 'profit' | 'adherence' | 'wastedRate' | 'leakage'

const SORT_ACCESSOR: Record<SortKey, (r: TripRow) => number> = {
  score: (r) => r.score,
  time: (r) => tripHours(r),
  distance: (r) => r.totalMiles,
  income: (r) => r.income,
  cost: (r) => r.cost,
  profit: (r) => r.profit,
  adherence: (r) => r.adherence,
  wastedRate: (r) => r.wastedRate,
  leakage: (r) => r.totalExcessCost,
}

const PLAIN_COLUMNS = [
  { label: 'Truck', left: true },
  { label: 'Date', left: true },
  { label: 'Lane', left: true },
  { label: 'Status', left: true },
]

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'time', label: 'Time' },
  { key: 'distance', label: 'Total Miles' },
  { key: 'income', label: 'Income' },
  { key: 'cost', label: 'Cost' },
  { key: 'profit', label: 'Profit' },
  { key: 'adherence', label: 'Adherence' },
  { key: 'wastedRate', label: 'Wasted Rate' },
  { key: 'leakage', label: 'Leakage' },
]

const rowKey = (r: TripRow) => `${r.truck}-${r.startDate}-${r.lane}`

// "May 14 → May 15", collapsed to "May 14" when start and end match.
const dateRange = (r: TripRow) =>
  r.startDate === r.endDate ? r.startDate : `${r.startDate} → ${r.endDate}`

// V1 always spells out both ends of the trip, even for same-day trips.
const fullDateRange = (r: TripRow) => `${r.startDate} → ${r.endDate}`

function StatusBadge({ status }: { status: TripRow['status'] }) {
  const { label, color, icon: Icon } = STATUS_STYLE[status]
  return (
    <span className="fd-status" style={{ color }}>
      <Icon size={13} />
      {label}
    </span>
  )
}

export default function FullData({
  band = null,
  classFilter = [],
  view = 'dashboard',
}: {
  band?: 'best' | 'worst' | null
  classFilter?: string[]
  view?: 'summary' | 'dashboard'
}) {
  const [tab, setTab] = useState<SubTab>('Trips')
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
        <TripsTable band={band} classFilter={classFilter} view={view} />
      ) : tab === 'Fleet Analytics' ? (
        <FleetAnalytics classFilter={classFilter} view={view} />
      ) : (
        <div className="fd-empty">{tab} — coming soon</div>
      )}
    </div>
  )
}

const CLASS_ORDER: TripRow['cls'][] = ['A', 'B', 'C', 'D']
// Trip data covers roughly one week — projected to a monthly figure for the
// "$/truck/mo" header stat, same convention as the "/mo" savings elsewhere.
const WEEKS_PER_MONTH = 4.33

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
        const totalTime = rows.reduce((sum, r) => sum + tripHours(r), 0)
        const totalMiles = rows.reduce((sum, r) => sum + r.totalMiles, 0)
        const totalIncome = rows.reduce((sum, r) => sum + r.income, 0)
        const totalCost = rows.reduce((sum, r) => sum + r.cost, 0)
        const totalProfit = rows.reduce((sum, r) => sum + r.profit, 0)
        const avgAdherence = rows.reduce((sum, r) => sum + r.adherence, 0) / rows.length
        const avgWastedRate = rows.reduce((sum, r) => sum + r.wastedRate, 0) / rows.length
        const totalLeakage = rows.reduce((sum, r) => sum + r.totalExcessCost, 0)
        const margin = totalIncome ? (totalProfit / totalIncome) * 100 : 0
        const perTruckMo = truckCount ? (totalProfit / truckCount) * WEEKS_PER_MONTH : 0
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
              <span className="fd-fleet-margin" style={{ color: margin >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {margin >= 0 ? '+' : ''}{margin.toFixed(2)}% margin
              </span>
              <span className="fd-fleet-permo">
                <b>{usd(perTruckMo)}</b> / truck / mo
              </span>
              <ChevronDown size={15} className="fd-fleet-chevron" />
            </button>
            <div className="fd-fleet-bar">
              <span style={{ width: `${barPct}%`, background: CLASS_COLOR[cls] }} />
            </div>
            {/* Collapsed: the class total sits here, outside the dropdown. Expanded:
                this total is dropped in favor of the trip table's own footer row,
                which shows the same total below the itemized trips. */}
            {!isOpen && (
              <div className="fd-fleet-total">
                <span className="fd-fleet-total-label">Total</span>
                <span className="fd-fleet-total-item"><i>Time</i><b>{fmtHours(totalTime)}</b></span>
                <span className="fd-fleet-total-item"><i>Total Miles</i><b>{miles(totalMiles)}</b></span>
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

function TripsTable({
  band,
  classFilter = [],
  view = 'dashboard',
}: {
  band?: 'best' | 'worst' | null
  classFilter?: string[]
  view?: 'summary' | 'dashboard'
}) {
  const [sortKey, setSortKey] = useState<SortKey | null>('profit')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = useState<TripRow | null>(null)
  const [query, setQuery] = useState('')

  // Drag-and-drop column reordering, scoped to the metric columns (Truck /
  // Date / Lane stay put as the row's identity, Details stays last as the
  // action column).
  const [columnOrder, setColumnOrder] = useState<SortKey[]>(() => SORT_COLUMNS.map((c) => c.key))
  const [dragOverKey, setDragOverKey] = useState<SortKey | null>(null)
  const dragKeyRef = useRef<SortKey | null>(null)

  const handleColDragStart = (key: SortKey) => (e: React.DragEvent<HTMLTableCellElement>) => {
    dragKeyRef.current = key
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleColDragOver = (key: SortKey) => (e: React.DragEvent<HTMLTableCellElement>) => {
    e.preventDefault()
    if (dragKeyRef.current && dragKeyRef.current !== key) setDragOverKey(key)
  }
  const handleColDragLeave = (key: SortKey) => () => {
    setDragOverKey((k) => (k === key ? null : k))
  }
  const handleColDrop = (targetKey: SortKey) => (e: React.DragEvent<HTMLTableCellElement>) => {
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
    classFilter.length > 0 ? tripRows.filter((r) => classFilter.includes(r.cls)) : tripRows

  // V1 searches by trip city (lane) only. V2 also matches truck number and
  // either date.
  const q = query.trim().toLowerCase()
  const filtered = q
    ? byClass.filter((r) =>
        view === 'summary'
          ? r.lane.toLowerCase().includes(q)
          : r.truck.toLowerCase().includes(q) ||
            r.startDate.toLowerCase().includes(q) ||
            r.endDate.toLowerCase().includes(q) ||
            r.lane.toLowerCase().includes(q)
      )
    : byClass

  const rows = sortKey
    ? [...filtered].sort((a, b) => {
        const cmp = SORT_ACCESSOR[sortKey](a) - SORT_ACCESSOR[sortKey](b)
        return sortDir === 'asc' ? cmp : -cmp
      })
    : filtered

  // Totals: dollar columns (and Total Miles) sum across all trips. Percentages
  // can't be summed meaningfully, so Adherence/Wasted Rate show the
  // fleet-wide average instead.
  const totalTime = rows.reduce((sum, r) => sum + tripHours(r), 0)
  const totalDistance = rows.reduce((sum, r) => sum + r.totalMiles, 0)
  const totalIncome = rows.reduce((sum, r) => sum + r.income, 0)
  const totalCost = rows.reduce((sum, r) => sum + r.cost, 0)
  const totalProfit = rows.reduce((sum, r) => sum + r.profit, 0)
  const avgAdherence = rows.length ? rows.reduce((sum, r) => sum + r.adherence, 0) / rows.length : 0
  const avgWastedRate = rows.length ? rows.reduce((sum, r) => sum + r.wastedRate, 0) / rows.length : 0
  const totalLeakage = rows.reduce((sum, r) => sum + r.totalExcessCost, 0)

  // Cells for the metric columns, rendered in whatever order columnOrder says.
  const metricCell = (key: SortKey, r: TripRow) => {
    switch (key) {
      case 'time':
        return <td key={key} className="fd-dim">{fmtHours(tripHours(r))}</td>
      case 'distance':
        return <td key={key} className="fd-dim">{miles(r.totalMiles)}</td>
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
  const metricFooterCell = (key: SortKey) => {
    switch (key) {
      case 'time':
        return <td key={key} className="fd-dim">{fmtHours(totalTime)}</td>
      case 'distance':
        return <td key={key} className="fd-dim">{miles(totalDistance)}</td>
      case 'income':
        return <td key={key} className="fd-strong">{usd(totalIncome)}</td>
      case 'cost':
        return <td key={key} className="fd-dim">{usd(totalCost)}</td>
      case 'profit':
        return <td key={key} className="fd-strong">{usd(totalProfit)}</td>
      case 'adherence':
        return (
          <td key={key} className="fd-dim">
            {pct(avgAdherence)}{' '}
            <span className="fd-avg-tag cf-tip" data-tip="Average across all trips shown, not a sum">
              avg
            </span>
          </td>
        )
      case 'wastedRate':
        return (
          <td key={key} className="fd-dim">
            {pct(avgWastedRate)}{' '}
            <span className="fd-avg-tag cf-tip" data-tip="Average across all trips shown, not a sum">
              avg
            </span>
          </td>
        )
      case 'leakage':
        return <td key={key} className="fd-neg">{usd(totalLeakage)}</td>
      default:
        return null
    }
  }

  return (
    <>
      <div className="fd-search">
        <Search size={14} className="fd-search-icon" />
        <input
          type="text"
          placeholder={view === 'summary' ? 'Search by city' : 'Search by truck, date, or city'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button className="fd-search-clear" aria-label="Clear search" onClick={() => setQuery('')}>
            <X size={13} />
          </button>
        )}
      </div>
      <div className="fd-table-wrap">
        <table className="fd-table">
          <thead>
            <tr>
              {PLAIN_COLUMNS.map((c) => (
                <th key={c.label} className={c.left ? 'fd-left' : ''}>
                  {c.label}
                </th>
              ))}
              {columnOrder.map((key) => {
                const c = SORT_COLUMNS.find((col) => col.key === key)!
                return (
                  <th
                    key={key}
                    className={dragOverKey === key ? 'fd-col-dragover' : ''}
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
                    <button
                      className={`fd-sort ${sortKey === key ? 'active' : ''}`}
                      onClick={() => toggleSort(key)}
                    >
                      {c.label}
                      {sortKey === key ? (
                        sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                      ) : (
                        <ChevronDown size={12} className="fd-sort-idle" />
                      )}
                    </button>
                  </th>
                )
              })}
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="fd-no-results" colSpan={PLAIN_COLUMNS.length + SORT_COLUMNS.length + 1}>
                  No trips match "{query}"
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={rowKey(r)}>
                <td className="fd-left">
                  <span className="fd-truck">{r.truck}</span>
                  <span className="fd-class" style={{ background: CLASS_COLOR[r.cls] }}>
                    {r.cls}
                  </span>
                </td>
                <td className="fd-left fd-dim">
                  {view === 'summary' ? fullDateRange(r) : dateRange(r)}
                </td>
                <td className="fd-left fd-dim">{r.lane}</td>
                <td className="fd-left">
                  <StatusBadge status={r.status} />
                </td>
                {columnOrder.map((key) => metricCell(key, r))}
                <td>
                  <button
                    className="fd-view"
                    aria-label="View trip details"
                    onClick={() => setSelected(r)}
                  >
                    View <Eye size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="fd-left" colSpan={PLAIN_COLUMNS.length}>
                <span className="fd-total-label">Total</span>
              </td>
              {columnOrder.map((key) => metricFooterCell(key))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {selected && <TripDetailModal trip={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
