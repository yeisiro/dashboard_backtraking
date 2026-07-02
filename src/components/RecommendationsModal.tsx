import { X, TrendingUp } from 'lucide-react'
import { recommendations } from '../data'

export default function RecommendationsModal({ onClose }: { onClose: () => void }) {
  const total = recommendations.length
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal recs-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="cfm-title">
            <TrendingUp size={17} color="var(--green)" /> What to improve
          </span>
          <button className="cfm-x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p className="cfm-sub">
            {total} prioritized actions, ordered by monthly upside. Fixing all of them
            recovers about <strong>+$10.5k/mo</strong>.
          </p>

          <div className="recs-list">
            {recommendations.map((r) => (
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
