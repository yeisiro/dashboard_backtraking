import { X, TrendingUp } from 'lucide-react'
import { recommendations, type Recommendation } from '../data'

export default function RecommendationsModal({
  title = 'What to improve',
  subtitle,
  items = recommendations,
  onClose,
}: {
  title?: string
  subtitle?: string
  items?: Recommendation[]
  onClose: () => void
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal recs-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="cfm-title">
            <TrendingUp size={17} color="var(--green)" /> {title}
          </span>
          <button className="cfm-x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {subtitle && <p className="cfm-sub">{subtitle}</p>}

          <div className="recs-list">
            {items.map((r) => (
              <div className="recs-row" key={r.rank}>
                <span className="recs-rank">{r.rank}</span>
                <div className="recs-text">
                  <span className="recs-action">{r.action}</span>
                  <span className="recs-detail">{r.detail}</span>
                </div>
                <span className="recs-cat">{r.category}</span>
                <span className="recs-impact pos">{r.impact}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
