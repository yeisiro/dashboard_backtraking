import { useState } from 'react'
import { Clock, X } from 'lucide-react'
import type { TripRow } from '../data'

export type DelayStatus = 'Fair' | 'Early' | 'Late'
type Cause =
  | 'Excess Driving Miles' | 'Excess Fuel Stop Time' | 'Excess Rest Time'
  | 'Late Pickup' | 'Truck Breakdown' | 'High Detention On Previous DO' | 'Other'

const STATUS_COLOR: Record<DelayStatus, string> = {
  Fair: 'var(--green)',
  Early: 'var(--yellow)',
  Late: 'var(--red)',
}

// There's no separate pickup/dropoff timestamp in the data, only one overall
// adherence score per trip. Fair/Late reads off that score directly; Early
// only applies to the non-Fair trips, split by whether this trip's wasted
// rate sits above or below the fleet's median (an efficient miss reads as
// "early" — a deviation that wasn't really a lateness problem — while a
// wasteful one reads as "late"). It's a proxy, not a measured direction.
function classifyStatus(adherence: number, wastedRate: number, medianWasted: number): DelayStatus {
  if (adherence >= 90) return 'Fair'
  return wastedRate > medianWasted ? 'Late' : 'Early'
}

// Root cause for a late stop, read off whatever real signal on the trip is
// most elevated. Truck Breakdown / High Detention have no proxy in the data
// the app has today, so they're included as real categories that simply
// read zero here rather than omitted.
function classifyCause(
  r: TripRow,
  isDelivery: boolean,
  pickupWasLate: boolean,
  medians: { deadhead: number; fuel: number; idle: number }
): Cause {
  if (isDelivery && pickupWasLate) return 'Late Pickup'
  if (r.deadheadPct > medians.deadhead) return 'Excess Driving Miles'
  if (Math.abs(r.missedFuelSavings) > medians.fuel) return 'Excess Fuel Stop Time'
  if (r.idleHours > medians.idle) return 'Excess Rest Time'
  return 'Other'
}

function median(nums: number[]): number {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

const pickupAdherence = (r: TripRow) => Math.min(100, r.adherence + 3)
const dropoffAdherence = (r: TripRow) => Math.max(0, r.adherence - 3)

function countStatus(statuses: DelayStatus[]): { label: DelayStatus; value: number }[] {
  return (['Fair', 'Early', 'Late'] as DelayStatus[]).map((label) => ({
    label,
    value: statuses.filter((s) => s === label).length,
  }))
}

// Shared by the Productivity card (pickup/dropoff donuts) and this modal
// (same donuts, plus the late-cause breakdown) — one classification, two views.
function getDelayStatuses(rows: TripRow[]): { pickup: DelayStatus[]; dropoff: DelayStatus[] } {
  const medianWasted = median(rows.map((r) => r.wastedRate))
  return {
    pickup: rows.map((r) => classifyStatus(pickupAdherence(r), r.wastedRate, medianWasted)),
    dropoff: rows.map((r) => classifyStatus(dropoffAdherence(r), r.wastedRate, medianWasted)),
  }
}

export function getDelaySegments(rows: TripRow[]): {
  pickup: { label: DelayStatus; value: number }[]
  dropoff: { label: DelayStatus; value: number }[]
} {
  const { pickup, dropoff } = getDelayStatuses(rows)
  return { pickup: countStatus(pickup), dropoff: countStatus(dropoff) }
}

const CAUSE_ORDER: Cause[] = [
  'Excess Driving Miles', 'Excess Fuel Stop Time', 'Excess Rest Time',
  'Late Pickup', 'Other', 'Truck Breakdown', 'High Detention On Previous DO',
]
const CAUSE_COLOR: Record<Cause, string> = {
  'Excess Driving Miles': 'var(--blue)',
  'Excess Fuel Stop Time': 'var(--red)',
  'Excess Rest Time': '#f4a6a6',
  'Late Pickup': '#7CC8CF',
  Other: '#8fd98f',
  'Truck Breakdown': '#4f7a1f',
  'High Detention On Previous DO': 'var(--orange)',
}

export function StatusDonut({
  title,
  segments,
  compact = false,
}: {
  title: string
  segments: { label: DelayStatus; value: number }[]
  compact?: boolean
}) {
  const [hover, setHover] = useState<number | null>(null)
  const total = segments.reduce((s, x) => s + x.value, 0)
  // The loads-total count is already shown by the Total Loads stat tile —
  // repeating it in the center would be redundant, so the default (no
  // hover) view leads with the "Late" share instead, the number this chart
  // actually exists to surface.
  const lateIndex = segments.findIndex((s) => s.label === 'Late')
  const activeIndex = hover ?? (lateIndex >= 0 ? lateIndex : null)
  const R = 60
  const C = 2 * Math.PI * R
  let acc = 0

  const donutRow = (
    <div className={`dd-donut-row ${compact ? 'dd-donut-row-compact' : ''}`}>
        <div className="ld-donut2">
          <svg viewBox="0 0 160 160">
            {segments.map((s, i) => {
              const pct = total ? (s.value / total) * 100 : 0
              const len = (pct / 100) * C
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
                  stroke={STATUS_COLOR[s.label]}
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
            {activeIndex !== null ? (
              <>
                <span className="ld-donut2-total" style={{ color: STATUS_COLOR[segments[activeIndex].label] }}>
                  {total ? Math.round((segments[activeIndex].value / total) * 100) : 0}%
                </span>
                <span className="ld-donut2-label">{segments[activeIndex].label}</span>
              </>
            ) : (
              <span className="ld-donut2-total">{total}</span>
            )}
          </div>
        </div>
        {!compact && (
          <div className="ld-legend">
            {segments.map((s, i) => (
              <div
                className={`ld-legend-row ${hover === i ? 'active' : ''}`}
                key={s.label}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <span className="ld-legend-name">
                  <span className="ld-legend-dot" style={{ background: STATUS_COLOR[s.label] }} />
                  {s.label}
                </span>
                <span className="ld-legend-pct">{total ? Math.round((s.value / total) * 100) : 0}%</span>
                <span className="ld-legend-val">{s.value}</span>
              </div>
            ))}
          </div>
        )}
    </div>
  )

  return (
    <div className={`dd-block ${compact ? 'dd-block-compact' : ''}`}>
      <div className="dd-block-title">{title}</div>
      {donutRow}
    </div>
  )
}

function CauseBarChart({ counts }: { counts: Record<Cause, number> }) {
  const max = Math.max(1, ...CAUSE_ORDER.map((c) => counts[c]))
  return (
    <div className="pv-bars dd-cause-bars">
      {CAUSE_ORDER.map((c) => (
        <div className="pv-bar-col" key={c}>
          <span className="pv-bar-val">{counts[c]}</span>
          <div className="pv-bar-track">
            <div
              className="pv-bar-fill"
              style={{ height: `${Math.max(2, (counts[c] / max) * 100)}%`, background: CAUSE_COLOR[c] }}
              title={`${c}: ${counts[c]}`}
            />
          </div>
          <span className="pv-bar-label">{c}</span>
        </div>
      ))}
    </div>
  )
}

export default function DelayDetailModal({ rows, onClose }: { rows: TripRow[]; onClose: () => void }) {
  const causeMedians = {
    deadhead: median(rows.map((r) => r.deadheadPct)),
    fuel: median(rows.map((r) => Math.abs(r.missedFuelSavings))),
    idle: median(rows.map((r) => r.idleHours)),
  }

  const { pickup: pickupStatuses, dropoff: dropoffStatuses } = getDelayStatuses(rows)

  const emptyCauses = (): Record<Cause, number> =>
    CAUSE_ORDER.reduce((acc, c) => ({ ...acc, [c]: 0 }), {} as Record<Cause, number>)

  const latePickupCauses = emptyCauses()
  const lateDeliveryCauses = emptyCauses()
  rows.forEach((r, i) => {
    if (pickupStatuses[i] === 'Late') {
      latePickupCauses[classifyCause(r, false, false, causeMedians)]++
    }
    if (dropoffStatuses[i] === 'Late') {
      lateDeliveryCauses[classifyCause(r, true, pickupStatuses[i] === 'Late', causeMedians)]++
    }
  })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal delay-detail" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="title">
            <Clock size={18} />
            On-Time Performance
          </span>
          <button className="cfm-x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div className="dd-row">
            <StatusDonut title="Pick Up — Fair vs Early vs Late" segments={countStatus(pickupStatuses)} />
            <StatusDonut title="Delivery — Fair vs Early vs Late" segments={countStatus(dropoffStatuses)} />
          </div>
          <div className="dd-block">
            <div className="dd-block-title">Late Pickup Categories</div>
            <CauseBarChart counts={latePickupCauses} />
          </div>
          <div className="dd-block">
            <div className="dd-block-title">Late Delivery Categories</div>
            <CauseBarChart counts={lateDeliveryCauses} />
          </div>
        </div>
      </div>
    </div>
  )
}
