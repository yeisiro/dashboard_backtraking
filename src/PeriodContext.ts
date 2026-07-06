import { createContext, useContext } from 'react'

export interface PeriodState {
  // Comparison label shown next to KPI deltas, e.g. "vs prev 7d".
  compareLabel: string
  // Human-readable date range of the comparison window, e.g. "Apr 26 – May 2, 2026".
  // Empty while a custom range is mid-selection.
  compareRange: string
  // Number of days in the selected window — drives the detail-chart x-axis.
  rangeDays: number
  // End date of the selected window (the date the user picked, or today).
  // Detail charts anchor their series here and count backwards.
  rangeEnd: Date
  setPeriod: (label: string, days: number, range: string, end?: Date) => void
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
const monthShort = (d: Date) => d.toLocaleString('en-US', { month: 'short' })

function formatRange(start: Date, end: Date): string {
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear())
    return `${monthShort(start)} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`
  return `${monthShort(start)} ${start.getDate()} – ${monthShort(end)} ${end.getDate()}, ${end.getFullYear()}`
}

// Date range of the period immediately preceding a window that begins at `start`
// and spans `days` days. Drives the "vs prev" tooltip.
export function prevPeriodLabel(start: Date, days: number): string {
  const pe = addDays(startOfDay(start), -1)
  const ps = addDays(pe, -(days - 1))
  return formatRange(ps, pe)
}

// Date range of the currently selected window (spans `days` days, ending on
// `end`). Shown on hover so a per-period value says which dates it covers.
export function currentPeriodLabel(end: Date, days: number): string {
  const start = addDays(startOfDay(end), -(days - 1))
  return formatRange(start, end)
}

// Comparison range for the default window (Last 7 days ending today).
export function initialCompareRange(): string {
  const start = addDays(startOfDay(new Date()), -6)
  return prevPeriodLabel(start, 7)
}

export const PeriodContext = createContext<PeriodState>({
  compareLabel: 'vs prev 7d',
  compareRange: '',
  rangeDays: 7,
  rangeEnd: startOfDay(new Date()),
  setPeriod: () => {},
})

export const usePeriod = () => useContext(PeriodContext)

export function compareLabelFor(preset: string, rangeDays: number | null): string {
  if (preset !== 'Custom') {
    const n = preset === 'Last 15 days' ? 15 : preset === 'Last 30 days' ? 30 : 7
    return `vs prev ${n}d`
  }
  return rangeDays ? `vs prev ${rangeDays}d` : 'vs prev period'
}
