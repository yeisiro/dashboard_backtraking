import { useState } from 'react'
import { X, BarChart3, ArrowUpRight, Truck, User, ChevronDown } from 'lucide-react'
import { benchmarkAttrs, benchmarkCostGroups, benchmarkGapTotal, type BenchmarkCostGroup } from '../data'

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

// The $ a group loses by not performing at market-leader level. A group already
// at (or above) market level has no loss — shown as a green "−$0". `worst` tones
// an actual loss red; the best column stays neutral.
function CostAmount({ n, worst = false, total = false }: { n: number; worst?: boolean; total?: boolean }) {
  const cls = total ? 'bench-total-amt' : 'bench-cost-amt'
  if (n <= 0) return <span className={`${cls} atmarket`}>−$0</span>
  return <span className={`${cls} ${worst ? 'neg' : ''}`}>−${Math.round(n).toLocaleString('en-US')}</span>
}

// Which cost group each attribute belongs to, whether it's the group's first
// row (where the spanning cost cell is drawn), and how many rows it spans.
const groupByAttr = new Map<string, { group: BenchmarkCostGroup; isAnchor: boolean; span: number }>()
benchmarkCostGroups.forEach((g) =>
  g.attributes.forEach((a, i) =>
    groupByAttr.set(a, { group: g, isAnchor: i === 0, span: g.attributes.length }),
  ),
)

// "How the market is doing" — worst/best trips vs the market leaders across the
// key attributes, plus what the gap to the leaders costs each group per period.
// Seven metric rows collapse into four cost figures (cells span their group).
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
            Your <strong>worst</strong> and <strong>best</strong> vs the market leaders.
          </p>

          <table className="bench-table bench-table-cost">
            <thead>
              <tr>
                <th className="bench-attr-col" rowSpan={2}>Attribute</th>
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
              {benchmarkAttrs.map((r) => {
                const info = groupByAttr.get(r.attribute)
                const g = info?.group
                return (
                  <tr key={r.attribute}>
                    <td className="bench-attr">
                      <span className="bench-tip" data-tip={r.tip}>{r.attribute}</span>
                      {g?.nameCaption && <div className="bench-attr-cap">{g.nameCaption}</div>}
                    </td>
                    <td className="bench-val neg">{r.worst}</td>
                    <td className="bench-val">{r.best}</td>
                    <td className="bench-val lead">{r.leaders}</td>
                    {info?.isAnchor && g && (
                      <>
                        <td className="bench-cost-cell bench-cost-worst-col" rowSpan={info.span}>
                          <CostAmount n={g.costWorst} worst />
                          {g.caption && <div className="bench-cost-cap">{g.caption}</div>}
                        </td>
                        <td className="bench-cost-cell" rowSpan={info.span}>
                          <CostAmount n={g.costBest} />
                        </td>
                      </>
                    )}
                  </tr>
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
            Each figure is what the group would have kept at market-leader level. Adherence dollars
            break down into the groups below it, so the total counts each loss once.
          </p>
        </div>
      </div>
    </div>
  )
}
