import { useEffect, useRef, useState } from 'react'
import { ChevronUp, ChevronDown, Eye, Search, X, CheckCircle2, Clock, GripVertical, Filter, Check } from 'lucide-react'
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

// ── Columns ───────────────────────────────────────────────────────────────
// Every data column is user-reorderable (dragged via the grip handle) —
// 'truck'/'lane'/'status' just don't have a sort accessor, and 'status' gets
// its own filter dropdown instead of a sort button. Details stays last as
// the fixed action column, outside this list.
type ColId =
  | 'truck' | 'lane' | 'status' | 'startDate' | 'time' | 'distance' | 'deadhead' | 'income'
  | 'cost' | 'profit' | 'adherence' | 'wastedRate' | 'leakage'

const ALL_COLUMNS: { key: ColId; label: string; left?: boolean; sortable?: boolean }[] = [
  { key: 'truck', label: 'Truck', left: true },
  { key: 'startDate', label: 'Date', left: true, sortable: true },
  { key: 'lane', label: 'Lane', left: true },
  { key: 'status', label: 'Status', left: true },
  { key: 'time', label: 'Driving Time', sortable: true },
  { key: 'distance', label: 'Total Miles', sortable: true },
  { key: 'deadhead', label: 'Miles DH', sortable: true },
  { key: 'income', label: 'Income', sortable: true },
  { key: 'cost', label: 'Cost', sortable: true },
  { key: 'profit', label: 'Profit', sortable: true },
  { key: 'adherence', label: 'Adherence', sortable: true },
  { key: 'wastedRate', label: 'Wasted Rate', sortable: true },
  { key: 'leakage', label: 'Leakage', sortable: true },
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
                <span className="fd-fleet-total-item"><i>Miles DH</i><b>{miles(totalDeadhead)}</b></span>
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
  // Empty = all statuses shown.
  const [statusFilter, setStatusFilter] = useState<TripRow['status'][]>([])
  const [statusFilterOpen, setStatusFilterOpen] = useState(false)
  const toggleStatusFilter = (status: TripRow['status']) =>
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    )

  // Drag-and-drop column reordering — every column (including Truck / Date /
  // Lane / Status) can be dragged via its grip handle. Details stays last as
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

  const byStatus =
    statusFilter.length > 0 ? filtered.filter((r) => statusFilter.includes(r.status)) : filtered

  const rows = sortKey
    ? [...byStatus].sort((a, b) => {
        const cmp = SORT_ACCESSOR[sortKey](a) - SORT_ACCESSOR[sortKey](b)
        return sortDir === 'asc' ? cmp : -cmp
      })
    : byStatus

  // Totals: dollar columns (and Total Miles) sum across all trips. Percentages
  // can't be summed meaningfully, so Adherence/Wasted Rate show the average
  // instead. Computed per subset so both the flat table and each group's own
  // footer can share this.
  const computeTotals = (subset: TripRow[]) => ({
    tripCount: subset.length,
    completedCount: subset.filter((r) => r.status === 'completed').length,
    totalTime: subset.reduce((sum, r) => sum + drivingHours(r), 0),
    totalDistance: subset.reduce((sum, r) => sum + r.totalMiles, 0),
    totalDeadhead: subset.reduce((sum, r) => sum + deadheadMiles(r), 0),
    totalIncome: subset.reduce((sum, r) => sum + r.income, 0),
    totalCost: subset.reduce((sum, r) => sum + r.cost, 0),
    totalProfit: subset.reduce((sum, r) => sum + r.profit, 0),
    avgAdherence: subset.length ? subset.reduce((sum, r) => sum + r.adherence, 0) / subset.length : 0,
    avgWastedRate: subset.length ? subset.reduce((sum, r) => sum + r.wastedRate, 0) / subset.length : 0,
    totalLeakage: subset.reduce((sum, r) => sum + r.totalExcessCost, 0),
  })

  // Cells for every column, rendered in whatever order columnOrder says.
  const renderCell = (key: ColId, r: TripRow) => {
    switch (key) {
      case 'truck':
        return (
          <td key={key} className="fd-left">
            <span className="fd-truck">{r.truck}</span>
            <span className="fd-class" style={{ background: CLASS_COLOR[r.cls] }}>
              {r.cls}
            </span>
          </td>
        )
      case 'startDate':
        return (
          <td key={key} className="fd-left fd-dim">
            {view === 'summary' ? fullDateRange(r) : dateRange(r)}
          </td>
        )
      case 'lane':
        return <td key={key} className="fd-left fd-dim">{r.lane}</td>
      case 'status':
        return (
          <td key={key} className="fd-left">
            <StatusBadge status={r.status} />
          </td>
        )
      case 'time':
        return <td key={key} className="fd-dim">{fmtHours(drivingHours(r))}</td>
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
  const renderFooterCell = (key: ColId, t: ReturnType<typeof computeTotals>) => {
    switch (key) {
      case 'truck':
      case 'startDate':
      case 'lane':
        return <td key={key} className="fd-left" />
      case 'status':
        return (
          <td key={key} className="fd-left fd-dim">
            {t.completedCount}/{t.tripCount} completed
          </td>
        )
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

  const renderRow = (r: TripRow) => (
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
            <td key={key} className={left ? 'fd-left' : ''}>
              <span className="fd-total-label">Total</span>
              <span className="fd-total-count">{t.tripCount} trips</span>
            </td>
          )
        })}
        <td />
      </tr>
    </tfoot>
  )

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
          {renderThead()}
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="fd-no-results" colSpan={colCount}>
                  {query ? `No trips match "${query}"` : 'No trips match this filter'}
                </td>
              </tr>
            )}
            {rows.map(renderRow)}
          </tbody>
          {renderFooterRow(computeTotals(rows))}
        </table>
      </div>
      {selected && <TripDetailModal trip={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
