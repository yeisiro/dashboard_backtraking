import { Home, Truck, Map } from 'lucide-react'

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <button className="side-btn active" aria-label="Dashboard">
        <Home size={20} />
      </button>
      <button className="side-btn" aria-label="Fleet">
        <Truck size={20} />
      </button>
      <button className="side-btn" aria-label="Map">
        <Map size={20} />
      </button>

      <div className="spacer" />

      <button className="side-btn" aria-label="Workspaces">
        <Home size={20} />
      </button>
      <div className="side-avatar">Bg</div>
    </aside>
  )
}
