import { Home } from 'lucide-react'

export type View = 'summary' | 'dashboard'

export default function Sidebar({
  view,
  onViewChange,
}: {
  view: View
  onViewChange: (v: View) => void
}) {
  return (
    <aside className="sidebar">
      <button
        className={`side-btn ${view === 'summary' ? 'active' : ''}`}
        aria-label="V1"
        onClick={() => onViewChange('summary')}
      >
        V1
      </button>
      <button
        className={`side-btn ${view === 'dashboard' ? 'active' : ''}`}
        aria-label="V2"
        onClick={() => onViewChange('dashboard')}
      >
        V2
      </button>

      <div className="spacer" />

      <button className="side-btn" aria-label="Workspaces">
        <Home size={20} />
      </button>
      <div className="side-avatar">Bg</div>
    </aside>
  )
}
