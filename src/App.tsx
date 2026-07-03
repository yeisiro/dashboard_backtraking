import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Toolbar from './components/Toolbar'
import KpiCards from './components/KpiCards'
import MoneyLeakage from './components/MoneyLeakage'
import PotentialRecovery, { type FleetMode } from './components/PotentialRecovery'
import LiveOperations from './components/LiveOperations'
import FleetMap from './components/FleetMap'
import { PeriodContext, initialCompareRange } from './PeriodContext'

export default function App() {
  const [compareLabel, setCompareLabel] = useState('vs prev 7d')
  const [compareRange, setCompareRange] = useState(initialCompareRange())
  const [rangeDays, setRangeDays] = useState(7)
  const [fleetMode, setFleetMode] = useState<FleetMode>('full')
  const noData = fleetMode === 'empty'
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
            <KpiCards noData={noData} />
            <div className="grid-2">
              <MoneyLeakage noData={noData} />
              <PotentialRecovery fleetMode={fleetMode} />
            </div>
            <div className="grid-live">
              <LiveOperations noData={noData} />
              <FleetMap noData={noData} />
            </div>

            <div className="fleet-sim">
              <span className="fleet-sim-label">Preview dashboard with</span>
              {(
                [
                  { v: 'full', label: 'Full fleet' },
                  { v: 'small', label: 'Small fleet (3)' },
                  { v: 'single', label: 'Single truck' },
                  { v: 'empty', label: 'No truck data' },
                ] as { v: FleetMode; label: string }[]
              ).map((o) => (
                <button
                  key={o.v}
                  className={`fleet-sim-btn ${fleetMode === o.v ? 'active' : ''}`}
                  onClick={() => setFleetMode(o.v)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </main>
        </div>
      </div>
    </PeriodContext.Provider>
  )
}
