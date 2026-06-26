import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Toolbar from './components/Toolbar'
import KpiCards from './components/KpiCards'
import MoneyLeakage from './components/MoneyLeakage'
import PotentialRecovery from './components/PotentialRecovery'
import LiveOperations from './components/LiveOperations'
import FleetMap from './components/FleetMap'
import { PeriodContext } from './PeriodContext'

export default function App() {
  const [compareLabel, setCompareLabel] = useState('vs prev 7d')

  return (
    <PeriodContext.Provider value={{ compareLabel, setCompareLabel }}>
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
