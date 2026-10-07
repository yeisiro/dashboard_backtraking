import { useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

// A compact single-month date + time picker used to bound the visible GPS
// trail window. Reuses the Date filter's calendar styles (df-*) in a reduced,
// one-month popover, and adds a time input to set the hour of the bound.
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const monthName = (d: Date) => d.toLocaleString('en-US', { month: 'long' })
const pad2 = (n: number) => String(n).padStart(2, '0')
const fmt = (d: Date) =>
  `${d.toLocaleString('en-US', { month: 'short', day: 'numeric' })}, ${((d.getHours() + 11) % 12) + 1}:${pad2(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`
const timeStr = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`

// 42 cells (6×7), Sunday-first, spilling into neighbouring months.
function monthCells(y: number, m: number): { date: Date; inMonth: boolean }[] {
  const offset = new Date(y, m, 1).getDay()
  const gridStart = new Date(y, m, 1 - offset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
    return { date: d, inMonth: d.getMonth() === m }
  })
}

export default function TrailDatePicker({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: Date
  min: Date
  max: Date
  onChange: (d: Date) => void
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(new Date(value.getFullYear(), value.getMonth(), 1))

  const clamp = (d: Date) => (d.getTime() < min.getTime() ? new Date(min) : d.getTime() > max.getTime() ? new Date(max) : d)
  const dayOff = (d: Date) => startOfDay(d).getTime() < startOfDay(min).getTime() || startOfDay(d).getTime() > startOfDay(max).getTime()
  const pickDay = (d: Date) => {
    if (dayOff(d)) return
    onChange(clamp(new Date(d.getFullYear(), d.getMonth(), d.getDate(), value.getHours(), value.getMinutes())))
  }
  const pickTime = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    onChange(clamp(new Date(value.getFullYear(), value.getMonth(), value.getDate(), h || 0, m || 0)))
  }
  const dayClass = (d: Date, inMonth: boolean) => {
    const cls = ['df-day']
    if (!inMonth) cls.push('spill')
    if (sameDay(d, value)) cls.push('endpoint', 'is-start')
    if (dayOff(d)) cls.push('df-day-off')
    return cls.join(' ')
  }
  const y = view.getFullYear()
  const m = view.getMonth()

  return (
    <div className="tdp-wrap">
      <button
        type="button"
        className="tdp-trigger"
        onClick={() => {
          setView(new Date(value.getFullYear(), value.getMonth(), 1))
          setOpen((o) => !o)
        }}
      >
        <CalendarDays size={13} />
        <span className="tdp-lbl">{label}</span>
        <b>{fmt(value)}</b>
      </button>

      {open && (
        <>
          <div className="cf-backdrop" onClick={() => setOpen(false)} />
          <div className="tdp-menu">
            <div className="df-cal">
              <div className="df-cal-head">
                <button type="button" className="df-navbtn" onClick={() => setView(new Date(y, m - 1, 1))} aria-label="Previous month">
                  <ChevronLeft size={16} />
                </button>
                <span className="df-month">{monthName(view)} {y}</span>
                <button type="button" className="df-navbtn" onClick={() => setView(new Date(y, m + 1, 1))} aria-label="Next month">
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="df-grid">
                {DOW.map((d, i) => (
                  <span className="df-dow" key={i}>{d}</span>
                ))}
                {monthCells(y, m).map(({ date, inMonth }, i) => (
                  <button key={i} type="button" className={dayClass(date, inMonth)} disabled={dayOff(date)} onClick={() => pickDay(date)}>
                    {date.getDate()}
                  </button>
                ))}
              </div>
            </div>
            <div className="tdp-time">
              <span>Time</span>
              <input type="time" value={timeStr(value)} onChange={(e) => pickTime(e.target.value)} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
