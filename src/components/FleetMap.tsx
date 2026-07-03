import { Maximize2 } from 'lucide-react'
import { mapTrucks, type Tone } from '../data'

const toneColor: Record<Tone, string> = {
  green: 'var(--green)',
  yellow: 'var(--yellow)',
  orange: 'var(--orange)',
  red: 'var(--red)',
  blue: 'var(--blue)',
  gray: 'var(--text-muted)',
}

export default function FleetMap({ noData = false }: { noData?: boolean }) {
  return (
    <section className="card map-card">
      <div className="map-head">
        <button className="btn-ghost">
          <Maximize2 size={13} /> Expand
        </button>
        <span className="map-live">
          <i className={`dot ${noData ? 'gray' : 'green'}`} />{' '}
          {noData ? 'No trucks live · connect your fleet' : '77 trucks live · updated 14s ago'}
        </span>
      </div>

      <div className="map-wrap">
        <svg className="map-svg" viewBox="0 0 560 320" role="img" aria-label="Fleet map">
          {/* abstract region landmass */}
          <path
            d="M120 110 C 160 70, 250 60, 320 70 C 400 80, 480 90, 510 140
               C 530 175, 500 215, 460 250 C 410 295, 330 305, 270 290
               C 210 275, 150 270, 120 230 C 95 195, 95 145, 120 110 Z"
            fill="rgba(255,255,255,0.03)"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
          <path
            d="M170 150 C 220 140, 300 135, 360 150 M 200 200 C 260 195, 340 200, 420 195"
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />

          {!noData && mapTrucks.map((t, i) => (
            <g key={i}>
              {t.ring && (
                <circle
                  cx={t.x}
                  cy={t.y}
                  r={10}
                  fill="none"
                  stroke={toneColor[t.tone]}
                  strokeOpacity={0.35}
                  strokeWidth={2}
                />
              )}
              <circle
                cx={t.x}
                cy={t.y}
                r={t.id ? 5.5 : 3.5}
                fill={toneColor[t.tone]}
              />
              {t.id && (
                <text
                  className="truck-label"
                  x={t.x}
                  y={t.label === 'above' ? t.y - 14 : t.y + 22}
                  textAnchor="middle"
                >
                  {t.id}
                </text>
              )}
            </g>
          ))}
        </svg>

        <div className="map-legend">
          <span><i className="dot green" /> A</span>
          <span><i className="dot blue" /> B</span>
          <span><i className="dot orange" /> C</span>
          <span><i className="dot red" /> D / alert</span>
          <span><i className="dot orange" /> zone alert</span>
        </div>
      </div>
    </section>
  )
}
