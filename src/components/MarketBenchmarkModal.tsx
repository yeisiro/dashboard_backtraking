import { useState } from 'react'
import { X, BarChart3, ArrowUpRight, Truck, User, ChevronDown, Headset, ChevronRight } from 'lucide-react'
import {
  benchmarkMetrics,
  benchmarkOwners,
  benchmarkOwnerTotal,
  benchmarkGapTotal,
  type BenchOwner,
} from '../data'

// The trucks (or drivers) that make up a column, revealed on demand from a
// neutral pill. Clicking one jumps to just that truck's/driver's trips in Full
// Data (the column header link handles the whole group).
function TruckMarker({
  trucks,
  label,
  noun = 'truck',
  onPickMember,
}: {
  trucks: string[]
  label: string
  noun?: 'truck' | 'driver'
  onPickMember?: (member: string) => void
}) {
  const [open, setOpen] = useState(false)
  if (trucks.length === 0) return null
  const Icon = noun === 'driver' ? User : Truck
  return (
    <div className="bench-trucks-wrap">
      <button className={`bench-trucks-btn ${open ? 'open' : ''}`} onClick={() => setOpen((o) => !o)}>
        <Icon size={13} />
        {trucks.length} {trucks.length === 1 ? noun : `${noun}s`}
        <ChevronDown size={13} className="bench-trucks-chev" />
      </button>
      {open && (
        <>
          <div className="cf-backdrop" onClick={() => setOpen(false)} />
          <div className="bench-trucks-menu">
            <div className="bench-trucks-menu-head">{label} · open one in Full Data</div>
            {trucks.map((t) => (
              <button
                key={t}
                className="bench-trucks-item"
                onClick={() => {
                  setOpen(false)
                  onPickMember?.(t)
                }}
              >
                {t}
                <ArrowUpRight size={13} className="bench-trucks-item-arrow" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// The $ a group loses by not matching the market leader on one metric. A group
// already at (or above) leader level has no loss — shown as a green "−$0".
// `worst` tones an actual loss red; the best column stays neutral.
function CostAmount({
  n,
  worst = false,
  total = false,
  subtotal = false,
}: {
  n: number
  worst?: boolean
  total?: boolean
  subtotal?: boolean
}) {
  // `sum` marks aggregate figures (owner subtotals + grand total) so they get a
  // stronger red than the per-category components they add up.
  const cls = total ? 'bench-total-amt' : 'bench-cost-amt'
  const sum = total || subtotal ? 'bench-sum' : ''
  if (n <= 0) return <span className={`${cls} ${sum} atmarket`}>−$0</span>
  return (
    <span className={`${cls} ${sum} ${worst ? 'neg' : ''}`}>−${Math.round(n).toLocaleString('en-US')}</span>
  )
}

// Who owns the metric — Dispatcher (planning) or Driver (execution).
function OwnerBadge({ owner }: { owner: BenchOwner }) {
  const Icon = owner === 'Dispatcher' ? Headset : User
  return (
    <span className={`bench-owner bench-owner-${owner.toLowerCase()}`}>
      <Icon size={11} />
      {owner}
    </span>
  )
}

// "How the market is doing" — an action-first benchmark. Metrics are grouped by
// who owns them (Dispatcher first, then Driver) and ordered as a recipe: fix
// planning, then execution. Each row expands to show how to reach the leader and
// how its gap cost is figured; each carries its own cost to the worst/best group.
export default function MarketBenchmarkModal({
  onClose,
  onViewTrips,
  v2 = false,
  dimension = 'trucks',
  worstTrucks = [],
  bestTrucks = [],
}: {
  onClose: () => void
  // members: the specific trucks/drivers to filter Full Data to. A column
  // header passes its whole group; a dropdown item passes just that one.
  onViewTrips?: (band: 'best' | 'worst', members?: string[]) => void
  v2?: boolean
  dimension?: 'trucks' | 'drivers'
  worstTrucks?: string[]
  bestTrucks?: string[]
}) {
  const noun = dimension === 'drivers' ? 'driver' : 'truck'
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  // Header link → filter Full Data to the whole worst/best group.
  const goToGroup = (band: 'best' | 'worst') => {
    onViewTrips?.(band, band === 'worst' ? worstTrucks : bestTrucks)
    onClose()
  }
  // Dropdown item → filter Full Data to just that one truck/driver.
  const pickMember = (band: 'best' | 'worst') => (member: string) => {
    onViewTrips?.(band, [member])
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal bench-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="cfm-title">
            <BarChart3 size={17} color="var(--blue)" /> How the market is doing
          </span>
          <button className="cfm-x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p className="cfm-sub">
            What it costs to trail the market leaders — by who owns it. Work the{' '}
            <strong>Dispatcher</strong> rows first, then the <strong>Driver</strong> rows. Click a
            metric to see how to reach the leader.
          </p>

          <table className="bench-table bench-table-cost">
            <thead>
              <tr>
                <th className="bench-attr-col" rowSpan={2}>Metric</th>
                <th rowSpan={2}>
                  <button className="bench-link" onClick={() => goToGroup('worst')} data-tip="See all these trips in Full Data">
                    Worst <ArrowUpRight size={12} />
                  </button>
                  {v2 && <TruckMarker trucks={worstTrucks} label="Worst" noun={noun} onPickMember={pickMember('worst')} />}
                </th>
                <th rowSpan={2}>
                  <button className="bench-link" onClick={() => goToGroup('best')} data-tip="See all these trips in Full Data">
                    Best <ArrowUpRight size={12} />
                  </button>
                  {v2 && <TruckMarker trucks={bestTrucks} label="Best" noun={noun} onPickMember={pickMember('best')} />}
                </th>
                <th rowSpan={2} className="bench-lead-col">Market leaders</th>
                <th colSpan={2} className="bench-costhead">Gap Costs</th>
              </tr>
              <tr>
                <th className="bench-costsub bench-cost-worst-col">Worst</th>
                <th className="bench-costsub">Best</th>
              </tr>
            </thead>
            <tbody>
              {benchmarkOwners.map((sec) => {
                const sub = benchmarkOwnerTotal(sec.owner)
                return (
                  <FragmentSection key={sec.owner}>
                    <tr className="bench-section">
                      <td colSpan={4} className="bench-section-lbl">
                        <div className="bench-section-inner">
                          <OwnerBadge owner={sec.owner} />
                          <span className="bench-section-blurb">{sec.blurb}</span>
                        </div>
                      </td>
                      <td className="bench-section-sub bench-cost-worst-col">
                        <CostAmount n={sub.worst} worst subtotal />
                      </td>
                      <td className="bench-section-sub">
                        <CostAmount n={sub.best} subtotal />
                      </td>
                    </tr>

                    {benchmarkMetrics
                      .filter((m) => m.owner === sec.owner)
                      .map((m) => {
                        const open = expanded.has(m.key)
                        return (
                          <FragmentSection key={m.key}>
                            <tr
                              className={`bench-metric-row ${open ? 'open' : ''}`}
                              onClick={() => toggle(m.key)}
                            >
                              <td className="bench-attr">
                                <span className="bench-attr-name">
                                  <ChevronRight size={14} className="bench-caret" />
                                  <span className="bench-tip" data-tip={m.tip}>{m.attribute}</span>
                                </span>
                              </td>
                              <td className="bench-val neg">{m.worst}</td>
                              <td className="bench-val">{m.best}</td>
                              <td className="bench-val lead">{m.leaders}</td>
                              <td className="bench-cost-cell bench-cost-worst-col">
                                <CostAmount n={m.costWorst} worst />
                              </td>
                              <td className="bench-cost-cell">
                                <CostAmount n={m.costBest} />
                              </td>
                            </tr>
                            {open && (
                              <tr className="bench-detail-row">
                                <td colSpan={6}>
                                  <div className="bench-detail">
                                    <div className="bench-detail-block">
                                      <span className="bench-detail-h">How to become a market leader</span>
                                      <p>{m.action}</p>
                                    </div>
                                    <div className="bench-detail-block">
                                      <span className="bench-detail-h">How this cost is figured</span>
                                      <p>{m.basis}</p>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </FragmentSection>
                        )
                      })}
                  </FragmentSection>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bench-total-row">
                <td colSpan={4} className="bench-total-lbl">Total missed out vs market leaders</td>
                <td className="bench-cost-cell bench-cost-worst-col">
                  <CostAmount n={benchmarkGapTotal.worst} worst total />
                </td>
                <td className="bench-cost-cell">
                  <CostAmount n={benchmarkGapTotal.best} total />
                </td>
              </tr>
            </tfoot>
          </table>

          <p className="bench-foot">
            Each figure is what that group would keep by matching the leader on that metric. Fix the
            Dispatcher rows first — better rates and fewer empty miles lift every driver-side number
            below them.
          </p>
        </div>
      </div>
    </div>
  )
}

// A keyed grouping wrapper so a section can emit several sibling <tr> rows
// without an extra DOM node inside the table.
function FragmentSection({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
