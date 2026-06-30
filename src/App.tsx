import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Toolbar from './components/Toolbar'
import KpiCards from './components/KpiCards'
import MoneyLeakage from './components/MoneyLeakage'
import PotentialRecovery from './components/PotentialRecovery'
import LiveOperations from './components/LiveOperations'
import FleetMap from './components/FleetMap'
import { PeriodContext, initialCompareRange } from './PeriodContext'

export default function App() {
  const [compareLabel, setCompareLabel] = useState('vs prev 7d')
  const [compareRange, setCompareRange] = useState(initialCompareRange())
  const [rangeDays, setRangeDays] = useState(7)
  const [rangeEnd, setRangeEnd] = useState(() => {
    const t = new Date()
    return new Date(t.getFullYear(), t.getMonth(), t.getDate())
  })
  const setPeriod = (label: string, days: number, range: string, end?: Date) => {
    setCompareLabel(label)
    setRangeDays(days)
    setCompareRange(range)
    if (end) setRangeEnd(end)
  }

  return (
    <PeriodContext.Provider value={{ compareLabel, compareRange, rangeDays, rangeEnd, setPeriod }}>
      <div className="app">
        <Sidebar />
        <div className="main">
          <Header />
          <main className="content">
            <Toolbar />
            <KpiCards />
            <div className="grid-2">
              <MoneyLeakage />
              <PotentialRecovery />
            </div>
            <div className="grid-live">
              <LiveOperations />
              <FleetMap />
            </div>
          </main>
        </div>
      </div>
    </PeriodContext.Provider>
  )
}
