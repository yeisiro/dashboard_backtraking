import { HelpCircle, Bookmark, Bell } from 'lucide-react'

export default function Header() {
  return (
    <header className="header">
      <div className="brand">
        <span className="ef">ef</span>
        <span className="rest">Routing</span>
      </div>
      <div className="header-actions">
        <button className="icon-btn" aria-label="Help">
          <HelpCircle size={19} />
        </button>
        <button className="icon-btn" aria-label="Bookmarks">
          <Bookmark size={19} />
        </button>
        <button className="icon-btn" aria-label="Notifications">
          <Bell size={19} />
        </button>
        <div className="avatar">DP</div>
      </div>
    </header>
  )
}
