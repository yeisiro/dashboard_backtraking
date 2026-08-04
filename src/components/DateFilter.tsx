import { useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { usePeriod, prevPeriodLabel } from '../PeriodContext'

// Quick-pick presets shown in the left rail. Each maps to a concrete
// start/end range computed off "today" (see rangeForPreset).
const PRESETS = [
  'This Week',
  'Last Week',
  'Current Month',
  'Last Month',
  'This Year',
  'Last Year',
] as const
type Preset = (typeof PRESETS)[number]

// Every preset compares against the equivalent window right before it.
const COMPARE_LABEL: Record<Preset, string> = {
  'This Week': 'vs prev week',
  'Last Week': 'vs prev week',
  'Current Month': 'vs prev month',
  'Last Month': 'vs prev month',
  'This Year': 'vs prev year',
  'Last Year': 'vs prev year',
}

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const monthName = (d: Date) => d.toLocaleString('en-US', { month: 'long' })
const monthShort = (d: Date) => d.toLocaleString('en-US', { month: 'short' })

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}
function daysBetween(start: Date, end: Date) {
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86400000) + 1
}

// Sunday-first range for each preset, anchored on today.
function rangeForPreset(preset: Preset): { start: Date; end: Date } {
  const t = startOfDay(new Date())
  switch (preset) {
    case 'This Week': {
      const sun = addDays(t, -t.getDay())
      return { start: sun, end: addDays(sun, 6) }
    }
    case 'Last Week': {
      const sun = addDays(t, -t.getDay() - 7)
      return { start: sun, end: addDays(sun, 6) }
    }
    case 'Current Month':
      return { start: new Date(t.getFullYear(), t.getMonth(), 1), end: new Date(t.getFullYear(), t.getMonth() + 1, 0) }
    case 'Last Month':
      return { start: new Date(t.getFullYear(), t.getMonth() - 1, 1), end: new Date(t.getFullYear(), t.getMonth(), 0) }
    case 'This Year':
      return { start: new Date(t.getFullYear(), 0, 1), end: new Date(t.getFullYear(), 11, 31) }
    case 'Last Year':
      return { start: new Date(t.getFullYear() - 1, 0, 1), end: new Date(t.getFullYear() - 1, 11, 31) }
  }
}

function formatLabel(start: Date | null, end: Date | null) {
  if (!start) return 'Select dates'
  if (!end || sameDay(start, end))
    return `${monthShort(start)} ${start.getDate()}, ${start.getFullYear()}`
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear())
    return `${monthShort(start)} ${start.getDate()}-${end.getDate()}, ${end.getFullYear()}`
  return `${monthShort(start)} ${start.getDate()} - ${monthShort(end)} ${end.getDate()}, ${end.getFullYear()}`
}

// 42 cells (6 rows × 7), Sunday-first, filling the leading/trailing week with
// the neighbouring months' days so the grid is always a full rectangle. Each
// cell carries whether it belongs to the displayed month (spill days render
// muted) — see the image reference.
function monthCells(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const startOffset = new Date(year, month, 1).getDay() // 0 = Sunday
  const gridStart = new Date(year, month, 1 - startOffset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
    return { date: d, inMonth: d.getMonth() === month }
  })
}

export default function DateFilter() {
  const { rangeDays, setPeriod } = usePeriod()
  const [open, setOpen] = useState(false)
  const [preset, setPreset] = useState<Preset | null>(null)
  // Default selection preserves the dashboard's original "last 7 days ending
  // today" window, so opening the picker doesn't shift what the KPIs mean.
  const initEnd = startOfDay(new Date())
  const initStart = addDays(initEnd, -6)
  const [start, setStart] = useState<Date | null>(initStart)
  const [end, setEnd] = useState<Date | null>(initEnd)
  // Left month of the two-up calendar; the right month is always view + 1.
  const [view, setView] = useState<Date>(new Date(initStart.getFullYear(), initStart.getMonth(), 1))

  const choosePreset = (p: Preset) => {
    setPreset(p)
    const r = rangeForPreset(p)
    const days = daysBetween(r.start, r.end)
    setStart(r.start)
    setEnd(r.end)
    setView(new Date(r.start.getFullYear(), r.start.getMonth(), 1))
    setPeriod(COMPARE_LABEL[p], days, prevPeriodLabel(r.start, days), r.end)
  }

  const reset = () => {
    setPreset(null)
    setStart(null)
    setEnd(null)
    setPeriod('vs prev period', rangeDays, '')
  }

  const clickDay = (day: Date) => {
    setPreset(null)
    if (!start || (start && end)) {
      setStart(day)
      setEnd(null)
      setPeriod('vs prev period', rangeDays, '')
    } else if (day < start) {
      setStart(day)
    } else {
      setEnd(day)
      const days = daysBetween(start, day)
      setPeriod(`vs prev ${days}d`, days, prevPeriodLabel(start, days), startOfDay(day))
    }
  }

  const inRange = (d: Date) => !!(start && end && d >= startOfDay(start) && d <= startOfDay(end))
  const dayClass = (d: Date, inMonth: boolean) => {
    const cls = ['df-day']
    if (!inMonth) cls.push('spill')
    if (inRange(d)) cls.push('in-range')
    if (start && sameDay(d, start)) cls.push('endpoint', 'is-start')
    if (end && sameDay(d, end)) cls.push('endpoint', 'is-end')
    return cls.join(' ')
  }

  const renderMonth = (monthDate: Date, side: 'left' | 'right') => {
    const y = monthDate.getFullYear()
    const m = monthDate.getMonth()
    return (
      <div className="df-cal">
        <div className="df-cal-head">
          {side === 'left' ? (
            <button
              className="df-navbtn"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
          ) : (
            <span className="df-navbtn-spacer" />
          )}
          <span className="df-month">
            {monthName(monthDate)} {y}
          </span>
          {side === 'right' ? (
            <button
              className="df-navbtn"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
              aria-label="Next month"
            >
              <ChevronRight size={18} />
            </button>
          ) : (
            <span className="df-navbtn-spacer" />
          )}
        </div>
        <div className="df-grid">
          {DOW.map((d, i) => (
            <span className="df-dow" key={i}>
              {d}
            </span>
          ))}
          {monthCells(y, m).map(({ date, inMonth }, i) => (
            <button key={i} className={dayClass(date, inMonth)} onClick={() => clickDay(date)}>
              {date.getDate()}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const rightView = new Date(view.getFullYear(), view.getMonth() + 1, 1)

  return (
    <div className="cf">
      <button className="filter" onClick={() => setOpen((o) => !o)}>
        <span>Date:</span>
        <b>{formatLabel(start, end)}</b>
        <ChevronDown className="chev" size={15} />
      </button>

      {open && (
        <>
          <div className="cf-backdrop" onClick={() => setOpen(false)} />
          <div className="cf-menu df-menu df-menu-2">
            <div className="df-side">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  className={`df-side-btn ${preset === p ? 'active' : ''}`}
                  onClick={() => choosePreset(p)}
                >
                  {p}
                </button>
              ))}
              <button className="df-reset" onClick={reset}>
                Reset
              </button>
            </div>

            <div className="df-cals">
              {renderMonth(view, 'left')}
              {renderMonth(rightView, 'right')}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
