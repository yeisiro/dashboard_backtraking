import { useState } from 'react'
import Sidebar, { type View } from './components/Sidebar'
import Header from './components/Header'
import Toolbar, { type DataTab } from './components/Toolbar'
import KpiCards from './components/KpiCards'
import MoneyLeakage from './components/MoneyLeakage'
import PotentialRecovery, { type FleetMode } from './components/PotentialRecovery'
import LiveOperations from './components/LiveOperations'
import MarketMap from './components/MarketMap'
import FullData from './components/FullData'
import { PeriodContext, initialCompareRange } from './PeriodContext'

export default function App() {
  const [compareLabel, setCompareLabel] = useState('vs prev 7d')
  const [compareRange, setCompareRange] = useState(initialCompareRange())
  const [rangeDays, setRangeDays] = useState(7)
  const [fleetMode, setFleetMode] = useState<FleetMode>('full')
  const [view, setView] = useState<View>('summary')
  const [dataTab, setDataTab] = useState<DataTab>('overview')
  const [tripsBand, setTripsBand] = useState<'best' | 'worst' | null>(null)
  const [classFilter, setClassFilter] = useState<string[]>([])
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
        <Sidebar view={view} onViewChange={setView} />
        <div className="main">
          <Header />
          <main className="content">
            <Toolbar
              tab={dataTab}
              onTabChange={setDataTab}
              classFilter={classFilter}
              onClassFilterChange={setClassFilter}
              view={view}
            />
            {dataTab === 'full' ? (
              <FullData band={tripsBand} classFilter={classFilter} view={view} />
            ) : (
              <>
                <KpiCards noData={noData} hideMarketPosition={view === 'summary'} />
                <div className={`grid-2 ${view === 'summary' ? 'grid-2-even' : ''}`}>
                  <MoneyLeakage noData={noData} hidePoorPlanning={view === 'summary'} />
                  <PotentialRecovery
                    fleetMode={fleetMode}
                    hideLeaders={view === 'summary'}
                    onViewTrips={(band) => {
                      setTripsBand(band)
                      setDataTab('full')
                    }}
                  />
                </div>
                {view === 'summary' && <MarketMap />}
                {view === 'dashboard' && (
                  <div className="grid-live">
                    <LiveOperations noData={noData} />
                    <MarketMap fill />
                  </div>
                )}
              </>
            )}

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
