import { useEffect, useState } from 'react'
import { ChevronUp, ChevronDown, Eye, Search, X } from 'lucide-react'
import { tripRows, type TripRow } from '../data'
import TripDetailModal from './TripDetailModal'

const SUBTABS = ['Trips', 'Fleet Analytics', 'Productivity', 'Fuel & Savings', 'Rewards'] as const
type SubTab = (typeof SUBTABS)[number]

const CLASS_COLOR: Record<TripRow['cls'], string> = {
  A: 'var(--green)',
  B: 'var(--blue)',
  C: 'var(--orange)',
  D: 'var(--red)',
}

// ── Formatters ────────────────────────────────────────────────────────────
const usd = (n: number) => '$' + Math.round(n).toLocaleString()
const pct = (n: number) => n.toFixed(1) + '%'
const miles = (n: number) => n.toLocaleString() + ' mi'

function scoreColor(n: number): string {
  if (n >= 70) return 'var(--green)'
  if (n >= 45) return 'var(--yellow)'
  return 'var(--red)'
}

// ── Sorting ───────────────────────────────────────────────────────────────
// Truck, Date, and Lane are plain (unsortable) — only the metric columns sort.
type SortKey = 'score' | 'distance' | 'income' | 'cost' | 'profit' | 'adherence' | 'wastedRate'

const SORT_ACCESSOR: Record<SortKey, (r: TripRow) => number> = {
  score: (r) => r.score,
  distance: (r) => r.totalMiles,
  income: (r) => r.income,
  cost: (r) => r.cost,
  profit: (r) => r.profit,
  adherence: (r) => r.adherence,
  wastedRate: (r) => r.wastedRate,
}

const PLAIN_COLUMNS = [
  { label: 'Truck', left: true },
  { label: 'Date', left: true },
  { label: 'Lane', left: true },
]

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'score', label: 'Score' },
  { key: 'distance', label: 'Distance' },
  { key: 'income', label: 'Income' },
  { key: 'cost', label: 'Cost' },
  { key: 'profit', label: 'Profit' },
  { key: 'adherence', label: 'Adherence' },
  { key: 'wastedRate', label: 'Wasted Rate' },
]

const rowKey = (r: TripRow) => `${r.truck}-${r.startDate}-${r.lane}`

// "May 14 → May 15", collapsed to "May 14" when start and end match.
const dateRange = (r: TripRow) =>
  r.startDate === r.endDate ? r.startDate : `${r.startDate} → ${r.endDate}`

export default function FullData({
  band = null,
  classFilter = [],
}: {
  band?: 'best' | 'worst' | null
  classFilter?: string[]
}) {
  const [tab, setTab] = useState<SubTab>('Trips')

  return (
    <div className="fd">
      <div className="fd-tabs">
        {SUBTABS.map((t) => (
          <button key={t} className={`fd-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Trips' ? (
        <TripsTable band={band} classFilter={classFilter} />
      ) : (
        <div className="fd-empty">{tab} — coming soon</div>
      )}
    </div>
  )
}

function TripsTable({
  band,
  classFilter = [],
}: {
  band?: 'best' | 'worst' | null
  classFilter?: string[]
}) {
  const [sortKey, setSortKey] = useState<SortKey | null>('score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = useState<TripRow | null>(null)
  const [query, setQuery] = useState('')

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

  // Search matches truck number, either date, or either city in the lane.
  const q = query.trim().toLowerCase()
  const filtered = q
    ? byClass.filter(
        (r) =>
          r.truck.toLowerCase().includes(q) ||
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

  // Totals: dollar columns sum across all trips. Percentages can't be summed
  // meaningfully, so Adherence/Wasted Rate show the fleet-wide average instead.
  const totalIncome = rows.reduce((sum, r) => sum + r.income, 0)
  const totalCost = rows.reduce((sum, r) => sum + r.cost, 0)
  const totalProfit = rows.reduce((sum, r) => sum + r.profit, 0)
  const avgAdherence = rows.length ? rows.reduce((sum, r) => sum + r.adherence, 0) / rows.length : 0
  const avgWastedRate = rows.length ? rows.reduce((sum, r) => sum + r.wastedRate, 0) / rows.length : 0

  return (
    <>
      <div className="fd-search">
        <Search size={14} className="fd-search-icon" />
        <input
          type="text"
          placeholder="Search by truck, date, or city"
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
              {SORT_COLUMNS.map((c) => (
                <th key={c.key}>
                  <button
                    className={`fd-sort ${sortKey === c.key ? 'active' : ''}`}
                    onClick={() => toggleSort(c.key)}
                  >
                    {c.label}
                    {sortKey === c.key ? (
                      sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    ) : (
                      <ChevronDown size={12} className="fd-sort-idle" />
                    )}
                  </button>
                </th>
              ))}
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
                <td className="fd-left fd-dim">{dateRange(r)}</td>
                <td className="fd-left fd-dim">{r.lane}</td>
                <td>
                  <span className="fd-score" style={{ color: scoreColor(r.score) }}>
                    {r.score}
                  </span>
                </td>
                <td className="fd-dim">{miles(r.totalMiles)}</td>
                <td>{usd(r.income)}</td>
                <td className="fd-dim">{usd(r.cost)}</td>
                <td className="fd-strong">{usd(r.profit)}</td>
                <td className="fd-dim">{pct(r.adherence)}</td>
                <td className="fd-dim">{pct(r.wastedRate)}</td>
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
              <td className="fd-left" colSpan={3}>
                <span className="fd-total-label">Total</span>
              </td>
              <td />
              <td />
              <td className="fd-strong">{usd(totalIncome)}</td>
              <td className="fd-dim">{usd(totalCost)}</td>
              <td className="fd-strong">{usd(totalProfit)}</td>
              <td className="fd-dim">
                {pct(avgAdherence)}{' '}
                <span className="fd-avg-tag cf-tip" data-tip="Average across all trips shown, not a sum">
                  avg
                </span>
              </td>
              <td className="fd-dim">
                {pct(avgWastedRate)}{' '}
                <span className="fd-avg-tag cf-tip" data-tip="Average across all trips shown, not a sum">
                  avg
                </span>
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {selected && <TripDetailModal trip={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
