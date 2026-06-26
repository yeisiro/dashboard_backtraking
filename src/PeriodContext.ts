import { createContext, useContext } from 'react'

export interface PeriodState {
  // Comparison label shown next to KPI deltas, e.g. "vs prev 7d".
  compareLabel: string
  setCompareLabel: (label: string) => void
}

export const PeriodContext = createContext<PeriodState>({
  compareLabel: 'vs prev 7d',
  setCompareLabel: () => {},
})

export const usePeriod = () => useContext(PeriodContext)

export function compareLabelFor(preset: string, rangeDays: number | null): string {
  if (preset !== 'Custom') {
    const n = preset === 'Last 15 days' ? 15 : preset === 'Last 30 days' ? 30 : 7
    return `vs prev ${n}d`
  }
  return rangeDays ? `vs prev ${rangeDays}d` : 'vs prev period'
}
