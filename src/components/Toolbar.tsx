import { useState } from 'react'
import { Plus } from 'lucide-react'
import ClassFilter from './ClassFilter'
import TrucksFilter from './TrucksFilter'
import DateFilter from './DateFilter'
import ConnectFleetModal from './ConnectFleetModal'

export default function Toolbar() {
  const [showConnect, setShowConnect] = useState(false)

  return (
    <div className="toolbar">
      <div className="tabs">
        <button className="tab active">Overview</button>
        <button className="tab">Full Data</button>
      </div>
      <div className="filters">
        <ClassFilter />
        <TrucksFilter />
        <DateFilter />
        <button className="btn-primary" onClick={() => setShowConnect(true)}>
          Connect Fleet
          <Plus size={15} />
        </button>
      </div>

      {showConnect && <ConnectFleetModal onClose={() => setShowConnect(false)} />}
    </div>
  )
}
