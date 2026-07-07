import { useEffect, useRef, useState } from 'react'
import {
  BarChart3,
  X,
  CheckCircle2,
  Crosshair,
  Maximize2,
  Play,
  Pause,
  ArrowUpRight,
  Minus,
  Plus,
  Check,
  Package,
  TrendingUp,
  Fuel,
  Route,
  MapPin,
  Flag,
  Truck,
} from 'lucide-react'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import { feature, mesh } from 'topojson-client'
import type { FeatureCollection, MultiLineString } from 'geojson'
import usTopo from 'us-atlas/states-10m.json'
import type { TripRow } from '../data'

const money = (n: number) => '$' + Math.round(n).toLocaleString()

// Split "Atlanta, GA → Orlando, FL" into its two hubs.
function splitLane(lane: string): [string, string] {
  const parts = lane.split('→').map((s) => s.trim())
  return [parts[0] ?? lane, parts[1] ?? '']
}

// ── Real US map (same projection/data as MarketMap) ─────────────────────────
// Geometry is computed once at module load — it never changes between trips.
const MAP_W = 960
const MAP_H = 520
const mapProjection = geoAlbersUsa().scale(1280).translate([MAP_W / 2, MAP_H / 2])
const mapPathGen = geoPath().projection(mapProjection)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const usTopoAny = usTopo as any
const NATION_FEATURE = feature(usTopoAny, usTopoAny.objects.nation) as unknown as FeatureCollection
const STATE_MESH = mesh(usTopoAny, usTopoAny.objects.states, (a: unknown, b: unknown) => a !== b)
const NATION_PATH = mapPathGen(NATION_FEATURE) ?? ''
const STATE_MESH_PATH = mapPathGen(STATE_MESH as unknown as MultiLineString) ?? ''

// Coordinates for every city that appears in a trip lane (see data.ts TRIP_BASE).
const CITY_COORDS: Record<string, [number, number]> = {
  'Atlanta, GA': [-84.388, 33.749],
  'Orlando, FL': [-81.379, 28.538],
  'Dallas, TX': [-96.797, 32.776],
  'Houston, TX': [-95.37, 29.76],
  'Chicago, IL': [-87.63, 41.878],
  'Indianapolis, IN': [-86.158, 39.768],
  'Memphis, TN': [-90.048, 35.149],
  'Nashville, TN': [-86.784, 36.165],
  'Kansas City, MO': [-94.578, 39.099],
  'St. Louis, MO': [-90.198, 38.627],
  'Charlotte, NC': [-80.843, 35.227],
  'Jacksonville, FL': [-81.656, 30.332],
  'Miami, FL': [-80.194, 25.774],
}

function projectCity(cityName: string): [number, number] {
  const coords = CITY_COORDS[cityName]
  return coords ? mapProjection(coords) ?? [MAP_W / 2, MAP_H / 2] : [MAP_W / 2, MAP_H / 2]
}

// Street address + zip for each hub, shown on hover on the Route
// start/end pins.
const CITY_DETAILS: Record<string, { address: string; zip: string }> = {
  'Atlanta, GA': { address: '2450 Fulton Industrial Blvd', zip: '30336' },
  'Orlando, FL': { address: '4900 S Orange Ave', zip: '32839' },
  'Dallas, TX': { address: '3838 Irving Blvd', zip: '75247' },
  'Houston, TX': { address: '7887 San Felipe St', zip: '77063' },
  'Chicago, IL': { address: '4100 W Fullerton Ave', zip: '60639' },
  'Indianapolis, IN': { address: '4400 W Minnesota St', zip: '46241' },
  'Memphis, TN': { address: '3450 Winchester Rd', zip: '38118' },
  'Nashville, TN': { address: '3200 Elm Hill Pike', zip: '37214' },
  'Kansas City, MO': { address: '1601 Wyoming St', zip: '64102' },
  'St. Louis, MO': { address: '4000 Forest Park Ave', zip: '63108' },
  'Charlotte, NC': { address: '3620 Westinghouse Blvd', zip: '28273' },
  'Jacksonville, FL': { address: '9550 Regency Square Blvd', zip: '32225' },
  'Miami, FL': { address: '8500 NW 17th St', zip: '33126' },
}

// Deterministic per-trip seed so the same trip always draws the same route
// shape (no Math.random — a reload shouldn't reshape an already-driven route).
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h) || 1
}
function seededRandom(seed: number): () => number {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

// Fuel-stop station name generator — a plausible highway travel center,
// deterministic per stop via the passed random generator.
const FUEL_CHAINS = ['Pilot Travel Center', 'Flying J Travel Plaza', "Love's Travel Stop", 'TA Travel Center', 'Petro Stopping Center']
const FUEL_HIGHWAYS = [75, 85, 95, 65, 40, 20, 24, 59]
function fakeStation(rand: () => number): string {
  const chain = FUEL_CHAINS[Math.floor(rand() * FUEL_CHAINS.length)]
  const hwy = FUEL_HIGHWAYS[Math.floor(rand() * FUEL_HIGHWAYS.length)]
  const exit = 5 + Math.floor(rand() * 300)
  return `${chain} · Exit ${exit}, I-${hwy}`
}
const round2 = (n: number) => Math.round(n * 100) / 100

// An "as-driven" route: a few bends between origin and destination instead
// of a straight line, so it reads as a real executed route on the highway
// network rather than a bird's-eye connector.
function buildRoutePoints(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  seed: number
): [number, number][] {
  const rand = seededRandom(seed)
  const totalDx = dx - ox
  const totalDy = dy - oy
  const dist = Math.hypot(totalDx, totalDy) || 1
  const perpX = -totalDy / dist
  const perpY = totalDx / dist
  const BENDS = 3
  const points: [number, number][] = [[ox, oy]]
  for (let i = 1; i <= BENDS; i++) {
    const t = i / (BENDS + 1)
    const baseX = ox + totalDx * t
    const baseY = oy + totalDy * t
    const offset = (rand() - 0.5) * dist * 0.44
    points.push([baseX + perpX * offset, baseY + perpY * offset])
  }
  points.push([dx, dy])
  return points
}

// Position and local heading at fraction `t` (0..1) along a polyline's length.
function pointAtFraction(
  points: [number, number][],
  t: number
): { pos: [number, number]; heading: number } {
  const segLens = points.slice(0, -1).map((p, i) => Math.hypot(points[i + 1][0] - p[0], points[i + 1][1] - p[1]))
  const total = segLens.reduce((a, b) => a + b, 0)
  let target = total * t
  for (let i = 0; i < segLens.length; i++) {
    const len = segLens[i]
    if (target <= len || i === segLens.length - 1) {
      const segT = len === 0 ? 0 : Math.min(target / len, 1)
      const [x1, y1] = points[i]
      const [x2, y2] = points[i + 1]
      return {
        pos: [x1 + (x2 - x1) * segT, y1 + (y2 - y1) * segT],
        heading: (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI,
      }
    }
    target -= len
  }
  return { pos: points[points.length - 1], heading: 0 }
}

// A map pin: a small diamond badge by default, expanding into a labeled
// pill on hover (Google Maps-style "Route start"/"Route end" markers).
function MapPinMarker({
  x,
  y,
  vbW,
  label,
  icon: Icon,
  bg,
  fg,
  iconBadge,
  hovered,
  onHoverChange,
  city,
  address,
  zip,
}: {
  x: number
  y: number
  vbW: number
  label: string
  icon: typeof MapPin
  bg: string
  fg: string
  iconBadge?: string
  hovered: boolean
  onHoverChange: (v: boolean) => void
  city: string
  address: string
  zip: string
}) {
  const stemTop = y - vbW * 0.05
  const diamondSize = vbW * 0.065
  const diamondIconSize = vbW * 0.032
  const badgeR = vbW * 0.02

  // Hover card: place name, street address, and zip. SVG text has no layout
  // measurement without touching the DOM, so line widths are estimated.
  const titleSize = vbW * 0.026
  const citySize = vbW * 0.022
  const addrSize = vbW * 0.019
  const padX = vbW * 0.02
  const padY = vbW * 0.018
  const lineGap = vbW * 0.03
  const addressLine = `${address}, ${zip}`
  const cardW =
    Math.max(label.length * 0.6 * titleSize, city.length * 0.58 * citySize, addressLine.length * 0.56 * addrSize) +
    padX * 2
  const cardH = padY * 2 + titleSize + lineGap * 2

  return (
    <g
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      style={{ cursor: 'pointer' }}
    >
      <line x1={x} y1={y} x2={x} y2={stemTop} stroke={bg} strokeWidth={vbW * 0.004} />
      <circle cx={x} cy={y} r={vbW * 0.01} fill={bg} />

      {hovered ? (
        <g transform={`translate(${x - cardW / 2},${stemTop - cardH})`}>
          <rect width={cardW} height={cardH} rx={vbW * 0.014} fill="#0b1524" stroke={bg} strokeWidth={vbW * 0.0025} />
          <text x={padX} y={padY + titleSize * 0.8} fill={bg} fontSize={titleSize} fontWeight={700}>
            {label}
          </text>
          <text x={padX} y={padY + titleSize * 0.8 + lineGap} fill="#e9ecf1" fontSize={citySize} fontWeight={600}>
            {city}
          </text>
          <text x={padX} y={padY + titleSize * 0.8 + lineGap * 2} fill="#8fa3b8" fontSize={addrSize}>
            {addressLine}
          </text>
        </g>
      ) : (
        <g transform={`translate(${x},${stemTop - diamondSize / 2})`}>
          <rect
            transform="rotate(45)"
            x={-diamondSize / 2} y={-diamondSize / 2} width={diamondSize} height={diamondSize}
            rx={diamondSize * 0.2}
            fill={bg}
          />
          {iconBadge && <circle r={badgeR} fill={iconBadge} />}
          <g transform={`translate(${-diamondIconSize / 2},${-diamondIconSize / 2})`}>
            <Icon size={diamondIconSize} color={fg} strokeWidth={2.4} />
          </g>
        </g>
      )}
    </g>
  )
}

// A fuel stop on the map — executed stops (amber) and optimal-but-not-taken
// stops (green) share the same Fuel icon and marker, differentiated by color
// only. Hovering either shows where it is; only the executed one shows a $
// amount, since the optimal one was never actually paid for.
function FuelStopMarker({
  x,
  y,
  vbW,
  icon: Icon,
  color,
  title,
  line2,
  line3,
  hovered,
  onHoverChange,
  dashed,
}: {
  x: number
  y: number
  vbW: number
  icon: typeof Fuel
  color: string
  title: string
  line2: string
  line3: string
  hovered: boolean
  onHoverChange: (v: boolean) => void
  dashed?: boolean
}) {
  const r = vbW * 0.021
  const iconSize = r * 1.3

  // Hover card: status, then location, then price — three short lines
  // instead of one long row that would run off the edge of the crop.
  const titleSize = vbW * 0.019
  const lineSize = vbW * 0.0165
  const padX = vbW * 0.017
  const padY = vbW * 0.015
  const lineGap = vbW * 0.026
  const cardW =
    Math.max(title.length * 0.58 * titleSize, line2.length * 0.56 * lineSize, line3.length * 0.56 * lineSize) +
    padX * 2
  const cardH = padY * 2 + titleSize + lineGap * 2

  return (
    <g
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      style={{ cursor: 'pointer' }}
    >
      <circle
        cx={x} cy={y} r={r}
        fill="#161b21" stroke={color} strokeWidth={vbW * 0.004}
        strokeDasharray={dashed ? `${vbW * 0.006} ${vbW * 0.005}` : undefined}
        opacity={dashed ? 0.85 : 1}
      />
      <g transform={`translate(${x - iconSize / 2},${y - iconSize / 2})`}>
        <Icon size={iconSize} color={color} strokeWidth={2.4} />
      </g>
      {hovered && (
        <g transform={`translate(${x - cardW / 2},${y - r - vbW * 0.018 - cardH})`}>
          <rect width={cardW} height={cardH} rx={vbW * 0.012} fill="#0b1524" stroke={color} strokeWidth={vbW * 0.0025} />
          <text x={padX} y={padY + titleSize * 0.8} fill={color} fontSize={titleSize} fontWeight={700}>
            {title}
          </text>
          <text x={padX} y={padY + titleSize * 0.8 + lineGap} fill="#e9ecf1" fontSize={lineSize}>
            {line2}
          </text>
          <text x={padX} y={padY + titleSize * 0.8 + lineGap * 2} fill="#8fa3b8" fontSize={lineSize}>
            {line3}
          </text>
        </g>
      )}
    </g>
  )
}

type Tone = 'green' | 'orange' | 'yellow' | 'red' | 'teal'
const TONE_VAR: Record<Tone, string> = {
  green: '#33DB9E',
  orange: '#FFAC52',
  yellow: '#F5C84B',
  red: '#FF3945',
  teal: '#7CC8CF',
}

// ── Timeline nodes ──────────────────────────────────────────────────────────
type NodeKind = 'radio-teal' | 'minus' | 'x' | 'check' | 'radio-empty'
interface TlEvent {
  kind: NodeKind
  callout?: { label: string; tone: Tone }
  status: string
  badgeTone: Tone | 'gray'
}

function NodeIcon({ kind }: { kind: NodeKind }) {
  if (kind === 'minus')
    return (
      <span className="ld-node ld-node-sq" style={{ background: '#342E26' }}>
        <Minus size={17} color="#FFAC52" strokeWidth={3} />
      </span>
    )
  if (kind === 'x')
    return (
      <span className="ld-node ld-node-sq" style={{ background: '#341D24' }}>
        <X size={17} color="#FF3945" strokeWidth={3} />
      </span>
    )
  if (kind === 'check')
    return (
      <span className="ld-node ld-node-sq" style={{ background: '#1C3736' }}>
        <Check size={17} color="#33DB9E" strokeWidth={3} />
      </span>
    )
  if (kind === 'radio-empty')
    return (
      <span className="ld-node ld-node-radio" style={{ background: '#0E141A' }}>
        <span className="ld-radio-ring" style={{ borderColor: '#9A9A9A' }} />
      </span>
    )
  return (
    <span className="ld-node ld-node-radio" style={{ background: '#233340' }}>
      <span className="ld-radio-dot" />
    </span>
  )
}

const BADGE_STYLE: Record<Tone | 'gray', { bg: string; color: string; border?: string }> = {
  teal: { bg: '#233340', color: '#7CC8CF' },
  orange: { bg: '#342E26', color: '#FFAC52' },
  red: { bg: '#341D24', color: '#FF3945' },
  green: { bg: '#1C3736', color: '#33DB9E' },
  yellow: { bg: '#342E26', color: '#F5C84B' },
  gray: { bg: '#0E141A', color: '#9A9A9A', border: '#162028' },
}

export default function TripDetailModal({
  trip,
  onClose,
}: {
  trip: TripRow
  onClose: () => void
}) {
  const [origin, dest] = splitLane(trip.lane)
  const [hover, setHover] = useState<number | null>(null)
  const [hoverStart, setHoverStart] = useState(false)
  const [hoverEnd, setHoverEnd] = useState(false)
  const [hoverFuel, setHoverFuel] = useState<number | null>(null)
  const [fullMap, setFullMap] = useState(false)

  const dhMiles = Math.round(trip.totalMiles - trip.loadedMiles)

  // Build the as-driven route as a real polyline (not a straight connector),
  // seeded per trip so it's stable across re-renders.
  const [ox, oy] = projectCity(origin)
  const [dx, dy] = projectCity(dest)
  const routeSeed = hashStr(`${trip.truck}|${trip.startDate}|${trip.lane}`)
  const routePoints = buildRoutePoints(ox, oy, dx, dy, routeSeed)
  const routeStr = routePoints.map(([x, y]) => `${x},${y}`).join(' ')

  // Crop the full US projection to a padded box around the whole route (not
  // just its endpoints), so the mini-map "zooms in" on it without clipping
  // any bends. Sizes below scale with the crop width so markers/text/strokes
  // read the same on screen regardless of route length.
  const routeXs = routePoints.map((p) => p[0])
  const routeYs = routePoints.map((p) => p[1])
  const minX = Math.min(...routeXs)
  const maxX = Math.max(...routeXs)
  const minY = Math.min(...routeYs)
  const maxY = Math.max(...routeYs)
  const spanX = maxX - minX
  const spanY = maxY - minY
  const MIN_HALF = 65
  const PAD_FRAC = 0.4
  let halfW = Math.max(spanX / 2 + spanX * PAD_FRAC, MIN_HALF)
  let halfH = Math.max(spanY / 2 + spanY * PAD_FRAC, MIN_HALF)
  const TARGET_AR = 1.3
  if (halfW / halfH > TARGET_AR) halfH = halfW / TARGET_AR
  else halfW = halfH * TARGET_AR
  const vbX = (minX + maxX) / 2 - halfW
  const vbY = (minY + maxY) / 2 - halfH
  const vbW = halfW * 2
  const vbH = halfH * 2

  // Scroll to zoom in/out around the auto-fit crop above. Marker/text sizes
  // stay tied to the base vbW (not the zoomed-in one), so zooming in also
  // makes everything read bigger — which is the point.
  const mapSvgRef = useRef<SVGSVGElement>(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStateRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)
  const effVbW = vbW / zoomLevel
  const effVbH = vbH / zoomLevel
  const effVbX = vbX + (vbW - effVbW) / 2 - pan.x
  const effVbY = vbY + (vbH - effVbH) / 2 - pan.y

  const handleMapWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    setZoomLevel((z) => Math.min(5, Math.max(1, z + (e.deltaY < 0 ? 0.2 : -0.2))))
  }
  const resetMapView = () => {
    setZoomLevel(1)
    setPan({ x: 0, y: 0 })
  }
  const handleMapMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault()
    dragStateRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y }
    setDragging(true)
  }

  // Drag-to-pan: listen on the window (not just the svg) so a fast drag that
  // briefly leaves the map's bounds doesn't stall mid-gesture.
  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const drag = dragStateRef.current
      const svgEl = mapSvgRef.current
      if (!drag || !svgEl) return
      const rect = svgEl.getBoundingClientRect()
      const scale = effVbW / rect.width
      const dx = (e.clientX - drag.startX) * scale
      const dy = (e.clientY - drag.startY) * scale
      const maxPan = Math.max(vbW, vbH) * 1.5
      setPan({
        x: Math.min(maxPan, Math.max(-maxPan, drag.panX + dx)),
        y: Math.min(maxPan, Math.max(-maxPan, drag.panY + dy)),
      })
    }
    const onUp = () => {
      dragStateRef.current = null
      setDragging(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, effVbW, vbW, vbH])

  // Route playback — every load here is completed, so playing it always runs
  // start → finish. progress is 0..1 along the driven polyline; the truck
  // marker below tracks it directly, whether it's animating or being scrubbed.
  const PLAYBACK_MS = 12000
  const [progress, setProgress] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [scrubbing, setScrubbing] = useState(false)
  const scrubTrackRef = useRef<HTMLDivElement>(null)
  const scrubDragRef = useRef(false)
  const lastTsRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isPlaying) {
      lastTsRef.current = null
      return
    }
    let raf: number
    const step = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts
      const dt = ts - lastTsRef.current
      lastTsRef.current = ts
      setProgress((p) => {
        const next = p + dt / PLAYBACK_MS
        if (next >= 1) {
          setIsPlaying(false)
          return 1
        }
        return next
      })
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [isPlaying])

  const togglePlay = () => {
    setIsPlaying((wasPlaying) => {
      if (!wasPlaying && progress >= 1) setProgress(0)
      return !wasPlaying
    })
  }

  const seekFromClientX = (clientX: number) => {
    const el = scrubTrackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setProgress(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)))
  }
  const handleScrubMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsPlaying(false)
    setScrubbing(true)
    scrubDragRef.current = true
    seekFromClientX(e.clientX)
  }

  useEffect(() => {
    if (!scrubbing) return
    const onMove = (e: MouseEvent) => {
      if (scrubDragRef.current) seekFromClientX(e.clientX)
    }
    const onUp = () => {
      scrubDragRef.current = false
      setScrubbing(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [scrubbing])

  // "Where I am" — the truck's position along the driven route right now.
  const [curX, curY] = pointAtFraction(routePoints, progress).pos

  // Fuel stops — roughly one every ~400 mi. Each planned stop either landed
  // exactly on the optimal station (one marker: optimal + executed), or it
  // didn't — split into the station actually used (executed, not optimal,
  // real $ spent) and the station the plan called for (optimal, not
  // executed, only a missed-savings figure). How often that split happens
  // scales with how big this trip's missed fuel savings actually were.
  const fuelStopCount = trip.totalMiles > 800 ? 3 : trip.totalMiles > 400 ? 2 : 1
  const totalGallons = trip.totalMiles / trip.mpg
  const gallonsPerStop = totalGallons / fuelStopCount
  const fuelCostTotal = trip.cost * 0.38
  const fuelRand = seededRandom(routeSeed + 777)
  const mismatchChance = Math.min(0.85, Math.abs(trip.missedFuelSavings) / Math.max(fuelCostTotal, 1) + 0.15)

  type FuelStop = {
    pos: [number, number]
    mile: number
    station: string
    pricePerGal: number
    amount: number | null
    missed: number | null
    status: 'optimal-executed' | 'optimal-only' | 'executed-only'
  }
  const fuelStops: FuelStop[] = []
  for (let i = 0; i < fuelStopCount; i++) {
    const baseT = (i + 1) / (fuelStopCount + 1)
    if (fuelRand() < mismatchChance) {
      const optimalPrice = round2(3.35 + fuelRand() * 0.3)
      const actualPrice = round2(3.78 + fuelRand() * 0.35)
      const tExec = Math.min(Math.max(baseT - 0.045, 0.05), 0.95)
      const tOpt = Math.min(Math.max(baseT + 0.045, 0.05), 0.95)
      fuelStops.push({
        pos: pointAtFraction(routePoints, tExec).pos,
        mile: Math.round(trip.totalMiles * tExec),
        station: fakeStation(fuelRand),
        pricePerGal: actualPrice,
        amount: Math.round(gallonsPerStop * actualPrice),
        missed: null,
        status: 'executed-only',
      })
      fuelStops.push({
        pos: pointAtFraction(routePoints, tOpt).pos,
        mile: Math.round(trip.totalMiles * tOpt),
        station: fakeStation(fuelRand),
        pricePerGal: optimalPrice,
        amount: null,
        missed: Math.round(gallonsPerStop * (actualPrice - optimalPrice)),
        status: 'optimal-only',
      })
    } else {
      const price = round2(3.35 + fuelRand() * 0.3)
      fuelStops.push({
        pos: pointAtFraction(routePoints, baseT).pos,
        mile: Math.round(trip.totalMiles * baseT),
        station: fakeStation(fuelRand),
        pricePerGal: price,
        amount: Math.round(gallonsPerStop * price),
        missed: null,
        status: 'optimal-executed',
      })
    }
  }

  // Shared between the inline mini-map and the full-screen map — same route,
  // pins, and fuel stops, just rendered inside whichever <svg> is currently
  // mounted (see the `ref={fullMap ? ... }` split below).
  const mapLayers = (
    <>
      <path d={NATION_PATH} fill="#161b21" />
      <path d={STATE_MESH_PATH} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={vbW * 0.0018} />
      <polyline
        points={routeStr}
        fill="none"
        stroke="#4d9dff"
        strokeWidth={vbW * 0.006}
        strokeDasharray={`${vbW * 0.012} ${vbW * 0.024}`}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {fuelStops.map((s, i) => {
        const title =
          s.status === 'optimal-executed'
            ? 'Fuel stop — optimal, executed'
            : s.status === 'executed-only'
            ? 'Fuel stop — executed, not optimal'
            : 'Fuel stop — optimal, not executed'
        const line3 =
          s.status === 'optimal-only' ? `$${s.pricePerGal}/gal` : `$${s.pricePerGal}/gal — $${s.amount} spent`
        return (
          <FuelStopMarker
            key={i}
            x={s.pos[0]} y={s.pos[1]} vbW={vbW}
            icon={Fuel}
            color={s.status === 'executed-only' ? '#F5C84B' : '#33DB9E'}
            dashed={s.status === 'optimal-only'}
            title={title}
            line2={s.station}
            line3={line3}
            hovered={hoverFuel === i}
            onHoverChange={(v) => setHoverFuel(v ? i : null)}
          />
        )
      })}
      <g>
        <circle
          cx={curX} cy={curY} r={vbW * 0.028}
          fill="#7CC8CF" stroke="#0b1524" strokeWidth={vbW * 0.005}
        />
        <g transform={`translate(${curX - vbW * 0.019},${curY - vbW * 0.019})`}>
          <Truck size={vbW * 0.038} color="#0b1524" strokeWidth={2.6} />
        </g>
      </g>
      <MapPinMarker
        x={ox} y={oy} vbW={vbW}
        label="Route start"
        icon={MapPin}
        bg="#7CC8CF" fg="#fff" iconBadge="#0b1524"
        hovered={hoverStart}
        onHoverChange={setHoverStart}
        city={origin}
        address={CITY_DETAILS[origin]?.address ?? ''}
        zip={CITY_DETAILS[origin]?.zip ?? ''}
      />
      <MapPinMarker
        x={dx} y={dy} vbW={vbW}
        label="Route end"
        icon={Flag}
        bg="#4d9dff" fg="#fff"
        hovered={hoverEnd}
        onHoverChange={setHoverEnd}
        city={dest}
        address={CITY_DETAILS[dest]?.address ?? ''}
        zip={CITY_DETAILS[dest]?.zip ?? ''}
      />
    </>
  )

  const cards: { q: string; value: React.ReactNode; icon: React.ReactNode }[] = [
    {
      q: 'How much was earned?',
      value: (
        <div className="ld-miles-row">
          <div className="ld-miles-stat">
            <span className="ld-miles-num">${trip.negotiatedRpm.toFixed(2)}</span>
            <span className="ld-miles-lbl">Negotiated RPM</span>
          </div>
          <span className="ld-miles-sep" />
          <div className="ld-miles-stat">
            <span className="ld-miles-num">${trip.executedRpm.toFixed(2)}</span>
            <span className="ld-miles-lbl">Executed RPM</span>
          </div>
        </div>
      ),
      icon: <TrendingUp size={16} />,
    },
    {
      q: 'How much fuel was consumed?',
      value: (
        <div className="ld-miles-row">
          <div className="ld-miles-stat">
            <span className="ld-miles-num">{money(Math.round(trip.cost * 0.38))}</span>
            <span className="ld-miles-lbl">Cost</span>
          </div>
          <span className="ld-miles-sep" />
          <div className="ld-miles-stat">
            <span className="ld-miles-num">{Math.round(trip.totalMiles / trip.mpg)} gal</span>
            <span className="ld-miles-lbl">Gallons</span>
          </div>
        </div>
      ),
      icon: <Fuel size={16} />,
    },
    {
      q: 'How many miles were driven?',
      value: (
        <div className="ld-miles-row">
          <div className="ld-miles-stat">
            <span className="ld-miles-num">{trip.loadedMiles.toLocaleString()}</span>
            <span className="ld-miles-lbl">Loaded</span>
          </div>
          <span className="ld-miles-sep" />
          <div className="ld-miles-stat">
            <span className="ld-miles-num">{dhMiles.toLocaleString()}</span>
            <span className="ld-miles-lbl">Deadhead</span>
          </div>
          <span className="ld-miles-sep" />
          <div className="ld-miles-stat">
            <span className="ld-miles-num">{trip.totalMiles.toLocaleString()}</span>
            <span className="ld-miles-lbl">Total</span>
          </div>
        </div>
      ),
      icon: <Route size={16} />,
    },
  ]

  const events: TlEvent[] = [
    { kind: 'radio-teal', status: 'Completed', badgeTone: 'teal' },
    { kind: 'minus', callout: { label: 'Desvío', tone: 'orange' }, status: 'Completed', badgeTone: 'orange' },
    { kind: 'x', callout: { label: 'Outcome malo', tone: 'red' }, status: 'Completed', badgeTone: 'red' },
    { kind: 'check', callout: { label: 'Outcome bueno', tone: 'green' }, status: 'Completed', badgeTone: 'green' },
    { kind: 'radio-empty', callout: { label: 'No ejecutado', tone: 'orange' }, status: 'Skipped', badgeTone: 'gray' },
    { kind: 'radio-teal', status: 'Completed', badgeTone: 'teal' },
    { kind: 'radio-teal', status: 'Completed', badgeTone: 'teal' },
  ]

  // Cost breakdown segments (share of total lane cost), sorted largest first.
  const COST_SEGMENTS = [
    { label: 'Efficient Miles', pct: 79.9, color: '#2ec86e' },
    { label: 'Loaded Deviation Excess', pct: 13, color: '#d94a35' },
    { label: 'Reposition deadhead', pct: 3.34, color: '#b23a2a' },
    { label: 'PC while loaded', pct: 3.29, color: '#ff6a4d' },
    { label: 'Operative center return', pct: 0.261, color: '#8a3020' },
    { label: 'PC while unloaded', pct: 0.0973, color: '#ff8a5c' },
    { label: 'Deadhead Deviation Excess', pct: 0.0893, color: '#5a2018' },
  ]
  const R = 60
  const C = 2 * Math.PI * R
  let acc = 0

  return (
    <>
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal ld-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ld-head">
          <span className="ld-head-title">
            <span className="ld-head-icon">
              <BarChart3 size={28} color="#9A9A9A" />
            </span>
            Operation details
          </span>
          <button className="ld-close" onClick={onClose} aria-label="Close">
            <X size={30} color="#9A9A9A" />
          </button>
        </div>

        <div className="ld-body">
          {/* Route strip */}
          <div className="ld-strip">
            <div className="ld-hub">
              <div className="ld-hub-name">{origin}</div>
            </div>
            <div className="ld-route-mid">
              <span className="ld-distance">{trip.loadedMiles.toLocaleString()} mi</span>
              <span className="ld-route-track">
                <span className="ld-route-dot" />
                <span className="ld-route-arrow">→</span>
              </span>
            </div>
            <div className="ld-hub">
              <div className="ld-hub-name">{dest}</div>
            </div>
            <div className="ld-loadid">
              <span className="ld-loadid-icon">
                <Package size={22} color="#7CC8CF" />
              </span>
              <div className="ld-loadid-txt">
                <div className="ld-loadid-val">L00000000</div>
                <div className="ld-loadid-sub">Load id</div>
              </div>
            </div>
            <span className="ld-status-pill">
              <CheckCircle2 size={20} /> Completed
            </span>
          </div>

          {/* Top: cost summary + metric grid + map */}
          <div className="ld-top">
            <section className="ld-card ld-cost">
              <div className="ld-card-head">
                <span className="ld-cost-title">Lane Cost Summary</span>
                <BarChart3 size={18} color="#686868" />
              </div>
              <div className="ld-cost-chart">
                <div className="ld-donut2">
                  <svg viewBox="0 0 160 160">
                    {COST_SEGMENTS.map((s, i) => {
                      const len = (s.pct / 100) * C
                      const offset = -acc
                      acc += len
                      const dimmed = hover !== null && hover !== i
                      return (
                        <circle
                          key={s.label}
                          cx="80"
                          cy="80"
                          r={R}
                          fill="none"
                          stroke={s.color}
                          strokeWidth="26"
                          strokeDasharray={`${len} ${C - len}`}
                          strokeDashoffset={offset}
                          transform="rotate(-90 80 80)"
                          opacity={dimmed ? 0.3 : 1}
                          className="ld-donut2-seg"
                          onMouseEnter={() => setHover(i)}
                          onMouseLeave={() => setHover(null)}
                        />
                      )
                    })}
                  </svg>
                  <div className="ld-donut2-center">
                    {hover !== null ? (
                      <>
                        <span className="ld-donut2-total" style={{ color: COST_SEGMENTS[hover].color }}>
                          {COST_SEGMENTS[hover].pct < 1
                            ? COST_SEGMENTS[hover].pct.toFixed(2)
                            : Math.round(COST_SEGMENTS[hover].pct)}
                          %
                        </span>
                        <span className="ld-donut2-label">{COST_SEGMENTS[hover].label}</span>
                      </>
                    ) : (
                      <>
                        <span className="ld-donut2-total">{money(trip.totalCost)}</span>
                        <span className="ld-donut2-label">Total</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="ld-legend">
                  {COST_SEGMENTS.map((s, i) => (
                    <div
                      className={`ld-legend-row ${hover === i ? 'active' : ''}`}
                      key={s.label}
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                    >
                      <span className="ld-legend-name">
                        <span className="ld-legend-dot" style={{ background: s.color }} />
                        {s.label}
                      </span>
                      <span className="ld-legend-pct">{s.pct < 1 ? s.pct.toFixed(2) : Math.round(s.pct)}%</span>
                      <span className="ld-legend-val">{money((trip.totalCost * s.pct) / 100)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <div className="ld-metrics">
              {cards.map((c) => (
                <div className="ld-card ld-metric" key={c.q}>
                  <div className="ld-metric-q">{c.q}</div>
                  <div className="ld-metric-val">{c.value}</div>
                  <div className="ld-metric-foot">
                    <span className="ld-metric-icon">{c.icon}</span>
                  </div>
                </div>
              ))}
            </div>

            <section className="ld-map">
              <div className="ld-map-controls">
                <button
                  className="ld-map-btn ld-map-round"
                  aria-label="Recenter"
                  onClick={resetMapView}
                >
                  <Crosshair size={16} />
                </button>
                <div className="ld-map-zoom">
                  <button
                    className="ld-map-btn ld-map-round"
                    aria-label="Zoom in"
                    onClick={() => setZoomLevel((z) => Math.min(5, z + 0.5))}
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    className="ld-map-btn ld-map-round"
                    aria-label="Zoom out"
                    onClick={() => setZoomLevel((z) => Math.max(1, z - 0.5))}
                  >
                    <Minus size={16} />
                  </button>
                </div>
                <button className="ld-map-btn ld-map-full" onClick={() => setFullMap(true)}>
                  Open full map <Maximize2 size={14} />
                </button>
              </div>

              <svg
                ref={!fullMap ? mapSvgRef : undefined}
                viewBox={`${effVbX} ${effVbY} ${effVbW} ${effVbH}`}
                className="ld-map-canvas"
                preserveAspectRatio="xMidYMid slice"
                style={{ cursor: dragging ? 'grabbing' : 'grab' }}
                onWheel={handleMapWheel}
                onMouseDown={handleMapMouseDown}
              >
                {mapLayers}
              </svg>

              <div className="ld-map-scrub">
                <button className="ld-scrub-play" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
                  {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                </button>
                <div className="ld-scrub-track" ref={scrubTrackRef} onMouseDown={handleScrubMouseDown}>
                  <div className="ld-scrub-fill" style={{ width: `${progress * 100}%` }} />
                  <div className="ld-scrub-thumb" style={{ left: `${progress * 100}%` }} />
                </div>
              </div>
            </section>
          </div>

          {/* Timeline */}
          <div className="ld-timeline">
            <div className="ld-tl-line" />
            {events.map((e, i) => {
              const badge = BADGE_STYLE[e.badgeTone]
              return (
                <div className="ld-tl-col" key={i}>
                  <div className="ld-tl-callout-slot">
                    {e.callout && (
                      <div className="ld-tl-callout-wrap">
                        <div className="ld-tl-callout">
                          <div className="ld-callout-txt">
                            <span className="ld-callout-head" style={{ color: TONE_VAR[e.callout.tone] }}>
                              {e.callout.label}
                            </span>
                            <span className="ld-callout-sub">Muy breve explicación</span>
                          </div>
                          <span className="ld-callout-arrow">
                            <ArrowUpRight size={14} color="#9A9A9A" />
                          </span>
                        </div>
                        <span className="ld-callout-stem" />
                      </div>
                    )}
                  </div>
                  <div className="ld-tl-node-slot">
                    <NodeIcon kind={e.kind} />
                  </div>
                  <div className="ld-tl-info">
                    <div className="ld-tl-name">Nombre evento aquí simple</div>
                    <span
                      className="ld-tl-badge"
                      style={{
                        background: badge.bg,
                        color: badge.color,
                        border: badge.border ? `2px solid ${badge.border}` : 'none',
                      }}
                    >
                      {e.status}
                    </span>
                    <div className="ld-tl-desc">Aquí se puede explicar un poquito más del evento</div>
                    <div className="ld-tl-time">16:44 - 12/06/26</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>

    {fullMap && (
      <div className="ld-fullmap-overlay" onClick={() => setFullMap(false)}>
        <div className="ld-fullmap" onClick={(e) => e.stopPropagation()}>
          <div className="ld-fullmap-head">
            <span className="ld-fullmap-title">
              {origin} <span className="ld-route-arrow">→</span> {dest}
            </span>
            <button className="ld-close" onClick={() => setFullMap(false)} aria-label="Close full map">
              <X size={26} color="#9A9A9A" />
            </button>
          </div>
          <div className="ld-fullmap-body">
            <div className="ld-map-controls">
              <button className="ld-map-btn ld-map-round" aria-label="Recenter" onClick={resetMapView}>
                <Crosshair size={16} />
              </button>
              <div className="ld-map-zoom">
                <button
                  className="ld-map-btn ld-map-round"
                  aria-label="Zoom in"
                  onClick={() => setZoomLevel((z) => Math.min(5, z + 0.5))}
                >
                  <Plus size={16} />
                </button>
                <button
                  className="ld-map-btn ld-map-round"
                  aria-label="Zoom out"
                  onClick={() => setZoomLevel((z) => Math.max(1, z - 0.5))}
                >
                  <Minus size={16} />
                </button>
              </div>
            </div>
            <svg
              ref={fullMap ? mapSvgRef : undefined}
              viewBox={`${effVbX} ${effVbY} ${effVbW} ${effVbH}`}
              className="ld-fullmap-canvas"
              preserveAspectRatio="xMidYMid slice"
              style={{ cursor: dragging ? 'grabbing' : 'grab' }}
              onWheel={handleMapWheel}
              onMouseDown={handleMapMouseDown}
            >
              {mapLayers}
            </svg>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
