import { useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { usePeriod, compareLabelFor, prevPeriodLabel } from '../PeriodContext'

// Quick-pick presets shown as pills across the top of the picker.
const PRESETS = ['Custom', 'Last 7 days', 'Last 15 days', 'Last 30 days'] as const
type Preset = (typeof PRESETS)[number]

// Longest range the backend will pull in one request.
const MAX_DAYS = 31

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

function daysForPreset(p: Preset): number {
  return p === 'Last 15 days' ? 15 : p === 'Last 30 days' ? 30 : 7
}
function rangeForPreset(p: Preset): { start: Date; end: Date } {
  const end = startOfDay(new Date())
  return { start: addDays(end, -(daysForPreset(p) - 1)), end }
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
// cell carries whether it belongs to the displayed month (spill days render muted).
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
  const [preset, setPreset] = useState<Preset>('Last 7 days')
  const init = rangeForPreset('Last 7 days')
  const [start, setStart] = useState<Date | null>(init.start)
  const [end, setEnd] = useState<Date | null>(init.end)
  const [error, setError] = useState<string | null>(null)
  // Left month of the two-up calendar; the right month is always view + 1.
  const [view, setView] = useState<Date>(new Date(init.start.getFullYear(), init.start.getMonth(), 1))

  const choosePreset = (p: Preset) => {
    setPreset(p)
    setError(null)
    if (p === 'Custom') {
      setStart(null)
      setEnd(null)
      // Keep the current window length until the user picks a full range.
      setPeriod(compareLabelFor('Custom', null), rangeDays, '')
      return
    }
    const r = rangeForPreset(p)
    const days = daysForPreset(p)
    setStart(r.start)
    setEnd(r.end)
    setView(new Date(r.start.getFullYear(), r.start.getMonth(), 1))
    setPeriod(compareLabelFor(p, null), days, prevPeriodLabel(r.start, days), r.end)
  }

  const clickDay = (day: Date) => {
    setPreset('Custom')
    if (!start || (start && end)) {
      // Starting a fresh selection — clear any previous over-limit warning.
      setError(null)
      setStart(day)
      setEnd(null)
      setPeriod(compareLabelFor('Custom', null), rangeDays, '')
    } else if (day < start) {
      setError(null)
      setStart(day)
    } else {
      const days = daysBetween(start, day)
      if (days > MAX_DAYS) {
        // Over the limit: keep the start pinned, don't apply the range, and tell
        // the user why nothing changed.
        setError(`Your selection is ${days} days. You can only pull up to ${MAX_DAYS} consecutive days at a time.`)
        return
      }
      setError(null)
      setEnd(day)
      setPeriod(compareLabelFor('Custom', days), days, prevPeriodLabel(start, days), startOfDay(day))
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
            <div className="df-presets">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  className={`df-preset ${preset === p ? 'active' : ''}`}
                  onClick={() => choosePreset(p)}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="df-cals">
              {renderMonth(view, 'left')}
              {renderMonth(rightView, 'right')}
            </div>

            {error && (
              <p className="df-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
