// Tiny inline trendline for a metric's recent series — no axes or labels, just
// the shape. Normalizes the series to the given box.
export default function Sparkline({
  series,
  color = 'var(--text-dim)',
  width = 54,
  height = 16,
}: {
  series: number[]
  color?: string
  width?: number
  height?: number
}) {
  if (!series || series.length < 2) return null
  const min = Math.min(...series)
  const max = Math.max(...series)
  const range = max - min || 1
  const pad = 1.5
  const pts = series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * (width - pad * 2) + pad
      const y = height - pad - ((v - min) / range) * (height - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
