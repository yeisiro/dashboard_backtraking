import { Home, LayoutDashboard, Building2 } from 'lucide-react'

export type View = 'summary' | 'dashboard'
// Design versions: V1 = summary dashboard, V2 = full dashboard, V3 = the
// complete onboarding (sign-up → landing with sample data → Connect Fleet),
// rendered with the V2 dashboard once the account exists.
export type Version = 'v1' | 'v2' | 'v3'
// V3 pages once the account exists (production: Home → Dashboard / My Company).
export type V3Page = 'dashboard' | 'company'

export default function Sidebar({
  version,
  onVersionChange,
  page,
  onPageChange,
}: {
  version: Version
  onVersionChange: (v: Version) => void
  // V3 only (after sign-up): page navigation.
  page?: V3Page
  onPageChange?: (p: V3Page) => void
}) {
  return (
    <aside className="sidebar">
      {(['v1', 'v2', 'v3'] as Version[]).map((v) => (
        <button
          key={v}
          className={`side-btn ${version === v ? 'active' : ''}`}
          aria-label={v.toUpperCase()}
          onClick={() => onVersionChange(v)}
        >
          {v.toUpperCase()}
        </button>
      ))}

      {page && onPageChange && (
        <div className="side-nav">
          <button
            className={`side-btn ${page === 'dashboard' ? 'active' : ''}`}
            aria-label="Dashboard"
            title="Dashboard"
            onClick={() => onPageChange('dashboard')}
          >
            <LayoutDashboard size={19} />
          </button>
          <button
            className={`side-btn ${page === 'company' ? 'active' : ''}`}
            aria-label="My Company"
            title="My Company"
            onClick={() => onPageChange('company')}
          >
            <Building2 size={19} />
          </button>
        </div>
      )}

      <div className="spacer" />

      <button className="side-btn" aria-label="Workspaces">
        <Home size={20} />
      </button>
      <div className="side-avatar">Bg</div>
    </aside>
  )
}
