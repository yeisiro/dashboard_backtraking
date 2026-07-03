import { Truck } from 'lucide-react'

export default function EmptyState({
  title = 'No truck data yet',
  subtitle = 'Connect your fleet to see this',
  compact = false,
}: {
  title?: string
  subtitle?: string
  compact?: boolean
}) {
  return (
    <div className={`empty-state ${compact ? 'compact' : ''}`}>
      {!compact && <Truck size={24} color="var(--text-muted)" />}
      <span className="empty-state-title">{title}</span>
      {!compact && <span className="empty-state-sub">{subtitle}</span>}
    </div>
  )
}
