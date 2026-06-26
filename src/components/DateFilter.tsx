import { useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { usePeriod, compareLabelFor } from '../PeriodContext'

const presets = ['Custom', 'Last 7 days', 'Last 15 days', 'Last 30 days'] as const
type Preset = (typeof presets)[number]

const dow = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
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

function rangeForPreset(preset: Preset): { start: Date; end: Date } {
  const end = startOfDay(new Date())
  const days = preset === 'Last 15 days' ? 15 : preset === 'Last 30 days' ? 30 : 7
  return { start: addDays(end, -(days - 1)), end }
}

function formatLabel(start: Date | null, end: Date | null) {
  if (!start) return 'Select dates'
  if (!end || sameDay(start, end))
    return `${monthShort(start)} ${start.getDate()}, ${start.getFullYear()}`
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear())
    return `${monthShort(start)} ${start.getDate()}-${end.getDate()}, ${end.getFullYear()}`
  return `${monthShort(start)} ${start.getDate()} - ${monthShort(end)} ${end.getDate()}, ${end.getFullYear()}`
}

export default function DateFilter() {
  const { setCompareLabel } = usePeriod()
  const [open, setOpen] = useState(false)
  const [preset, setPreset] = useState<Preset>('Last 7 days')
  const init = rangeForPreset('Last 7 days')
  const [start, setStart] = useState<Date | null>(init.start)
  const [end, setEnd] = useState<Date | null>(init.end)
  const [view, setView] = useState<Date>(new Date(init.end.getFullYear(), init.end.getMonth(), 1))

  const choosePreset = (p: Preset) => {
    setPreset(p)
    if (p === 'Custom') {
      setStart(null)
      setEnd(null)
      setCompareLabel(compareLabelFor('Custom', null))
      return
    }
    const r = rangeForPreset(p)
    setStart(r.start)
    setEnd(r.end)
    setView(new Date(r.end.getFullYear(), r.end.getMonth(), 1))
    setCompareLabel(compareLabelFor(p, null))
  }

  const clickDay = (day: Date) => {
    setPreset('Custom')
    if (!start || (start && end)) {
      setStart(day)
      setEnd(null)
      setCompareLabel(compareLabelFor('Custom', null))
    } else if (day < start) {
      setStart(day)
    } else {
      setEnd(day)
      const days = Math.round((startOfDay(day).getTime() - startOfDay(start).getTime()) / 86400000) + 1
      setCompareLabel(compareLabelFor('Custom', days))
    }
  }

  // Build the month grid (Monday-first).
  const year = view.getFullYear()
  const month = view.getMonth()
  const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < firstOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))

  const inRange = (d: Date) =>
    start && end && d >= startOfDay(start) && d <= startOfDay(end)
  const isEndpoint = (d: Date) =>
    (start && sameDay(d, start)) || (end && sameDay(d, end))

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
          <div className="cf-menu df-menu">
            <div className="df-presets">
              {presets.map((p) => (
                <button
                  key={p}
                  className={`df-preset ${preset === p ? 'active' : ''}`}
                  onClick={() => choosePreset(p)}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="df-cal-head">
              <span className="df-month">
                {monthName(view)} {year}
              </span>
              <div className="df-nav">
                <button
                  onClick={() => setView(new Date(year, month - 1, 1))}
                  aria-label="Previous month"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => setView(new Date(year, month + 1, 1))}
                  aria-label="Next month"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <div className="df-grid">
              {dow.map((d, i) => (
                <span className="df-dow" key={i}>
                  {d}
                </span>
              ))}
              {cells.map((d, i) =>
                d ? (
                  <button
                    key={i}
                    className={`df-day ${inRange(d) ? 'in-range' : ''} ${
                      isEndpoint(d) ? 'endpoint' : ''
                    } ${start && sameDay(d, start) ? 'is-start' : ''} ${
                      end && sameDay(d, end) ? 'is-end' : ''
                    }`}
                    onClick={() => clickDay(d)}
                  >
                    {d.getDate()}
                  </button>
                ) : (
                  <span key={i} className="df-day empty" />
                ),
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
