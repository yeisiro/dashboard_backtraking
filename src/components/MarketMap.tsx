import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X, RefreshCw, Copy, ChevronDown, Download } from 'lucide-react'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import { select } from 'd3-selection'
import { zoom, zoomIdentity } from 'd3-zoom'
import { feature, mesh } from 'topojson-client'
import type { FeatureCollection } from 'geojson'
import usTopo from 'us-atlas/states-10m.json'

// Every destination circle uses one light-blue color.
const DESTINATION_COLOR = '#63b3ed'

// Truck class → pin color (matches the fleet legend: A/B/C/D).
const CLASS_COLOR: Record<string, string> = {
  A: '#27a767',
  B: '#3b82f6',
  C: '#f97316',
  D: '#eb4343',
}

type City = {
  city: string
  lat: number
  lon: number
  grade: string
  score: number
  labelRight: boolean
}

type Truck = {
  id: string
  lat: number
  lon: number
  class: keyof typeof CLASS_COLOR
  // Unit detail — shown in the side panel when the pin is clicked.
  location: string
  eta: string
  eld: string
  plate: string
  vin: string
  fuel: string
  maxHitch: string
  axle: string
  tank: string
  documents: number
  driver: { name: string; phone: string; license: string; status: string }
  trailer: { number: string; type: string; length: string; status: string }
}

// My fleet — pins placed by location, colored by class.
const TRUCKS: Truck[] = [
  {
    id: 'R11045', lat: 41.878, lon: -87.63, class: 'A',
    location: 'Chicago, IL', eta: '12h 04m', eld: '281474984321740', plate: '12354567453',
    vin: '1HGCM82633A004352', fuel: 'diesel', maxHitch: '1236', axle: '6x4', tank: '298 mi', documents: 3,
    driver: { name: 'Marcus Reed', phone: '(312) 555-0142', license: 'IL-D9921', status: 'On duty' },
    trailer: { number: 'TR-4451', type: 'Dry Van', length: '53 ft', status: 'Linked' },
  },
  {
    id: 'R11021', lat: 39.099, lon: -94.578, class: 'A',
    location: 'Kansas City, MO', eta: '8h 22m', eld: '281474984321721', plate: '98213445621',
    vin: '2FMDK3GC4BB004128', fuel: 'diesel', maxHitch: '1180', axle: '6x4', tank: '315 mi', documents: 4,
    driver: { name: 'Elena Vasquez', phone: '(816) 555-0198', license: 'MO-K4471', status: 'On duty' },
    trailer: { number: 'TR-2210', type: 'Reefer', length: '53 ft', status: 'Linked' },
  },
  {
    id: 'R11003', lat: 39.768, lon: -86.158, class: 'A',
    location: 'Indianapolis, IN', eta: '3h 47m', eld: '281474984321703', plate: '55129384712',
    vin: '3VWDX7AJ5DM004901', fuel: 'diesel', maxHitch: '1310', axle: '6x4', tank: '340 mi', documents: 2,
    driver: { name: 'Trevor Nolan', phone: '(317) 555-0166', license: 'IN-N1183', status: 'Resting' },
    trailer: { number: 'TR-8830', type: 'Flatbed', length: '48 ft', status: 'Linked' },
  },
  {
    id: 'R11032', lat: 32.776, lon: -96.797, class: 'B',
    location: 'Dallas, TX', eta: '22h 10m', eld: '281474984321732', plate: '77410023981',
    vin: '1FTFW1ET5DFC00218', fuel: 'diesel', maxHitch: '1150', axle: '4x2', tank: '276 mi', documents: 3,
    driver: { name: 'Priya Shah', phone: '(214) 555-0173', license: 'TX-S6620', status: 'On duty' },
    trailer: { number: 'TR-1902', type: 'Dry Van', length: '53 ft', status: 'Linked' },
  },
  {
    id: 'R11018', lat: 39.961, lon: -82.999, class: 'B',
    location: 'Columbus, OH', eta: '5h 55m', eld: '281474984321718', plate: '33019284471',
    vin: '5NPE24AF1FH004552', fuel: 'diesel', maxHitch: '1205', axle: '6x4', tank: '302 mi', documents: 5,
    driver: { name: 'Darnell Price', phone: '(614) 555-0121', license: 'OH-P8842', status: 'On duty' },
    trailer: { number: 'TR-6641', type: 'Reefer', length: '53 ft', status: 'Unlinked' },
  },
  {
    id: 'R11055', lat: 36.165, lon: -86.784, class: 'C',
    location: 'Nashville, TN', eta: '48h 41m', eld: '281474984321755', plate: '12354567453',
    vin: '1HGCM82633A004352', fuel: 'regular', maxHitch: '1236', axle: '4x2', tank: '321 mi', documents: 3,
    driver: { name: 'Kayla Brooks', phone: '(615) 555-0155', license: 'TN-B3390', status: 'On duty' },
    trailer: { number: 'TR-3320', type: 'Dry Van', length: '48 ft', status: 'Linked' },
  },
  {
    id: 'R11007', lat: 35.149, lon: -90.049, class: 'C',
    location: 'Memphis, TN', eta: '18h 30m', eld: '281474984321707', plate: '66210394812',
    vin: '4T1BF1FK7CU004773', fuel: 'diesel', maxHitch: '1090', axle: '4x2', tank: '288 mi', documents: 1,
    driver: { name: 'Hector Ramos', phone: '(901) 555-0139', license: 'TN-R7712', status: 'Resting' },
    trailer: { number: 'TR-5504', type: 'Flatbed', length: '48 ft', status: 'Linked' },
  },
  {
    id: 'R11060', lat: 29.76, lon: -95.37, class: 'D',
    location: 'Houston, TX', eta: '31h 15m', eld: '281474984321760', plate: '48820193746',
    vin: '1G1ZD5ST8LF004199', fuel: 'diesel', maxHitch: '980', axle: '4x2', tank: '265 mi', documents: 2,
    driver: { name: 'Wanda Fields', phone: '(713) 555-0188', license: 'TX-F2205', status: 'Off duty' },
    trailer: { number: 'TR-7719', type: 'Dry Van', length: '53 ft', status: 'Unlinked' },
  },
]

// Freight hubs with their market grade — 89 major US cities.
const CITIES: City[] = [
  { city: 'Chicago, IL', lat: 41.878, lon: -87.63, grade: 'Great', score: 91, labelRight: true },
  { city: 'Indianapolis, IN', lat: 39.768, lon: -86.158, grade: 'Great', score: 85, labelRight: true },
  { city: 'Columbus, OH', lat: 39.961, lon: -82.999, grade: 'Great', score: 88, labelRight: true },
  { city: 'Memphis, TN', lat: 35.149, lon: -90.048, grade: 'Great', score: 82, labelRight: true },
  { city: 'Kansas City, MO', lat: 39.099, lon: -94.578, grade: 'Great', score: 80, labelRight: true },
  { city: 'Dallas, TX', lat: 32.776, lon: -96.797, grade: 'Good', score: 76, labelRight: true },
  { city: 'Houston, TX', lat: 29.76, lon: -95.37, grade: 'Good', score: 68, labelRight: false },
  { city: 'Nashville, TN', lat: 36.165, lon: -86.784, grade: 'Good', score: 73, labelRight: true },
  { city: 'St. Louis, MO', lat: 38.627, lon: -90.198, grade: 'Good', score: 70, labelRight: true },
  { city: 'New York, NY', lat: 40.713, lon: -74.006, grade: 'Mid', score: 58, labelRight: false },
  { city: 'Charlotte, NC', lat: 35.227, lon: -80.843, grade: 'Mid', score: 55, labelRight: false },
  { city: 'Atlanta, GA', lat: 33.749, lon: -84.388, grade: 'Mid', score: 51, labelRight: false },
  { city: 'Philadelphia, PA', lat: 39.952, lon: -75.164, grade: 'Mid', score: 54, labelRight: false },
  { city: 'Minneapolis, MN', lat: 44.977, lon: -93.265, grade: 'Mid', score: 52, labelRight: false },
  { city: 'Los Angeles, CA', lat: 34.052, lon: -118.244, grade: 'Bad', score: 32, labelRight: true },
  { city: 'Seattle, WA', lat: 47.607, lon: -122.332, grade: 'Bad', score: 28, labelRight: true },
  { city: 'Denver, CO', lat: 39.739, lon: -104.984, grade: 'Bad', score: 38, labelRight: true },
  { city: 'Phoenix, AZ', lat: 33.448, lon: -112.074, grade: 'Bad', score: 35, labelRight: true },
  { city: 'Miami, FL', lat: 25.774, lon: -80.194, grade: 'Bad', score: 31, labelRight: false },
  { city: 'Boston, MA', lat: 42.36, lon: -71.058, grade: 'Good', score: 74, labelRight: false },
  { city: 'Washington, DC', lat: 38.907, lon: -77.037, grade: 'Great', score: 83, labelRight: false },
  { city: 'Baltimore, MD', lat: 39.29, lon: -76.612, grade: 'Good', score: 71, labelRight: false },
  { city: 'Pittsburgh, PA', lat: 40.441, lon: -79.996, grade: 'Good', score: 69, labelRight: false },
  { city: 'Cleveland, OH', lat: 41.499, lon: -81.694, grade: 'Good', score: 72, labelRight: false },
  { city: 'Cincinnati, OH', lat: 39.103, lon: -84.512, grade: 'Great', score: 81, labelRight: false },
  { city: 'Detroit, MI', lat: 42.331, lon: -83.046, grade: 'Good', score: 67, labelRight: false },
  { city: 'Milwaukee, WI', lat: 43.039, lon: -87.906, grade: 'Mid', score: 61, labelRight: true },
  { city: 'Louisville, KY', lat: 38.253, lon: -85.759, grade: 'Great', score: 84, labelRight: false },
  { city: 'Richmond, VA', lat: 37.541, lon: -77.436, grade: 'Mid', score: 59, labelRight: false },
  { city: 'Raleigh, NC', lat: 35.78, lon: -78.638, grade: 'Mid', score: 57, labelRight: false },
  { city: 'Jacksonville, FL', lat: 30.332, lon: -81.656, grade: 'Good', score: 66, labelRight: false },
  { city: 'Orlando, FL', lat: 28.538, lon: -81.379, grade: 'Mid', score: 54, labelRight: false },
  { city: 'Tampa, FL', lat: 27.951, lon: -82.457, grade: 'Mid', score: 56, labelRight: false },
  { city: 'New Orleans, LA', lat: 29.951, lon: -90.072, grade: 'Bad', score: 42, labelRight: true },
  { city: 'Birmingham, AL', lat: 33.52, lon: -86.802, grade: 'Mid', score: 53, labelRight: true },
  { city: 'Little Rock, AR', lat: 34.746, lon: -92.289, grade: 'Mid', score: 60, labelRight: true },
  { city: 'Oklahoma City, OK', lat: 35.468, lon: -97.516, grade: 'Good', score: 68, labelRight: true },
  { city: 'Tulsa, OK', lat: 36.154, lon: -95.993, grade: 'Mid', score: 55, labelRight: true },
  { city: 'San Antonio, TX', lat: 29.424, lon: -98.494, grade: 'Good', score: 65, labelRight: true },
  { city: 'Austin, TX', lat: 30.267, lon: -97.743, grade: 'Mid', score: 58, labelRight: true },
  { city: 'El Paso, TX', lat: 31.761, lon: -106.485, grade: 'Bad', score: 39, labelRight: true },
  { city: 'Fort Worth, TX', lat: 32.755, lon: -97.33, grade: 'Good', score: 70, labelRight: true },
  { city: 'Albuquerque, NM', lat: 35.084, lon: -106.651, grade: 'Bad', score: 41, labelRight: true },
  { city: 'Salt Lake City, UT', lat: 40.76, lon: -111.891, grade: 'Great', score: 86, labelRight: true },
  { city: 'Boise, ID', lat: 43.615, lon: -116.203, grade: 'Mid', score: 62, labelRight: true },
  { city: 'Las Vegas, NV', lat: 36.169, lon: -115.14, grade: 'Bad', score: 44, labelRight: true },
  { city: 'Reno, NV', lat: 39.53, lon: -119.814, grade: 'Bad', score: 40, labelRight: true },
  { city: 'Portland, OR', lat: 45.515, lon: -122.678, grade: 'Bad', score: 37, labelRight: true },
  { city: 'Sacramento, CA', lat: 38.582, lon: -121.494, grade: 'Bad', score: 36, labelRight: true },
  { city: 'San Francisco, CA', lat: 37.774, lon: -122.419, grade: 'Bad', score: 30, labelRight: true },
  { city: 'San Diego, CA', lat: 32.716, lon: -117.161, grade: 'Bad', score: 33, labelRight: true },
  { city: 'San Jose, CA', lat: 37.339, lon: -121.895, grade: 'Bad', score: 29, labelRight: true },
  { city: 'Fresno, CA', lat: 36.747, lon: -119.772, grade: 'Mid', score: 51, labelRight: true },
  { city: 'Bakersfield, CA', lat: 35.373, lon: -119.019, grade: 'Mid', score: 52, labelRight: true },
  { city: 'Tucson, AZ', lat: 32.222, lon: -110.975, grade: 'Bad', score: 43, labelRight: true },
  { city: 'Colorado Springs, CO', lat: 38.834, lon: -104.821, grade: 'Mid', score: 63, labelRight: true },
  { city: 'Omaha, NE', lat: 41.257, lon: -95.995, grade: 'Great', score: 87, labelRight: true },
  { city: 'Des Moines, IA', lat: 41.586, lon: -93.625, grade: 'Great', score: 85, labelRight: true },
  { city: 'Wichita, KS', lat: 37.688, lon: -97.336, grade: 'Good', score: 71, labelRight: true },
  { city: 'Sioux Falls, SD', lat: 43.55, lon: -96.7, grade: 'Great', score: 82, labelRight: true },
  { city: 'Fargo, ND', lat: 46.877, lon: -96.79, grade: 'Good', score: 68, labelRight: true },
  { city: 'Billings, MT', lat: 45.783, lon: -108.5, grade: 'Bad', score: 46, labelRight: true },
  { city: 'Spokane, WA', lat: 47.657, lon: -117.424, grade: 'Bad', score: 38, labelRight: true },
  { city: 'Cheyenne, WY', lat: 41.14, lon: -104.82, grade: 'Bad', score: 34, labelRight: true },
  { city: 'Madison, WI', lat: 43.073, lon: -89.401, grade: 'Good', score: 73, labelRight: true },
  { city: 'Grand Rapids, MI', lat: 42.963, lon: -85.668, grade: 'Good', score: 70, labelRight: false },
  { city: 'Toledo, OH', lat: 41.664, lon: -83.555, grade: 'Good', score: 66, labelRight: false },
  { city: 'Buffalo, NY', lat: 42.886, lon: -78.878, grade: 'Mid', score: 60, labelRight: false },
  { city: 'Rochester, NY', lat: 43.161, lon: -77.611, grade: 'Mid', score: 58, labelRight: false },
  { city: 'Syracuse, NY', lat: 43.048, lon: -76.148, grade: 'Mid', score: 55, labelRight: false },
  { city: 'Albany, NY', lat: 42.653, lon: -73.757, grade: 'Mid', score: 57, labelRight: false },
  { city: 'Hartford, CT', lat: 41.764, lon: -72.674, grade: 'Good', score: 65, labelRight: false },
  { city: 'Providence, RI', lat: 41.824, lon: -71.413, grade: 'Mid', score: 53, labelRight: false },
  { city: 'Portland, ME', lat: 43.661, lon: -70.255, grade: 'Bad', score: 45, labelRight: false },
  { city: 'Newark, NJ', lat: 40.735, lon: -74.172, grade: 'Good', score: 75, labelRight: false },
  { city: 'Harrisburg, PA', lat: 40.273, lon: -76.886, grade: 'Good', score: 69, labelRight: false },
  { city: 'Norfolk, VA', lat: 36.851, lon: -76.286, grade: 'Good', score: 65, labelRight: false },
  { city: 'Greensboro, NC', lat: 36.073, lon: -79.792, grade: 'Mid', score: 62, labelRight: false },
  { city: 'Columbia, SC', lat: 34.001, lon: -81.035, grade: 'Mid', score: 56, labelRight: false },
  { city: 'Savannah, GA', lat: 32.083, lon: -81.1, grade: 'Good', score: 72, labelRight: false },
  { city: 'Jackson, MS', lat: 32.299, lon: -90.185, grade: 'Bad', score: 47, labelRight: true },
  { city: 'Baton Rouge, LA', lat: 30.451, lon: -91.187, grade: 'Mid', score: 54, labelRight: true },
  { city: 'Shreveport, LA', lat: 32.525, lon: -93.75, grade: 'Bad', score: 48, labelRight: true },
  { city: 'Knoxville, TN', lat: 35.961, lon: -83.921, grade: 'Mid', score: 61, labelRight: false },
  { city: 'Lexington, KY', lat: 38.04, lon: -84.503, grade: 'Good', score: 67, labelRight: false },
  { city: 'Chattanooga, TN', lat: 35.046, lon: -85.31, grade: 'Good', score: 71, labelRight: false },
  { city: 'Charleston, SC', lat: 32.777, lon: -79.931, grade: 'Good', score: 73, labelRight: false },
  { city: 'Wilmington, NC', lat: 34.226, lon: -77.945, grade: 'Mid', score: 55, labelRight: false },
  { city: 'Amarillo, TX', lat: 35.221, lon: -101.831, grade: 'Bad', score: 44, labelRight: true },
]

const W = 960
const H = 520

export default function MarketMap() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selected, setSelected] = useState<Truck | null>(null)

  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return

    const projection = geoAlbersUsa().scale(1280).translate([W / 2, H / 2])
    const path = geoPath().projection(projection)

    const svg = select(svgEl)
    // Clear any previous render (e.g. hot reload / re-mount).
    svg.selectAll('*').remove()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topo = usTopo as any
    const nation = feature(topo, topo.objects.nation) as unknown as FeatureCollection
    const stateMesh = mesh(topo, topo.objects.states, (a, b) => a !== b)

    const zoomGroup = svg.append('g')

    // Nation fill
    zoomGroup
      .append('path')
      .datum(nation)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .attr('d', path as any)
      .attr('fill', '#1c2226')

    // State borders
    zoomGroup
      .append('path')
      .datum(stateMesh)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .attr('d', path as any)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(255,255,255,0.07)')
      .attr('stroke-width', 0.6)

    // Nation border
    zoomGroup
      .append('path')
      .datum(nation)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .attr('d', path as any)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(255,255,255,0.13)')
      .attr('stroke-width', 0.9)

    // Destination circles — all one light-blue color. City name is hidden
    // until hover, so the map isn't cluttered with 89 always-on labels.
    const dots = zoomGroup.append('g')
    CITIES.forEach((c) => {
      const p = projection([c.lon, c.lat])
      if (!p) return
      const [cx, cy] = p
      const g = dots.append('g').style('cursor', 'default')

      // Invisible, larger hit area so hover triggers anywhere near the ring,
      // not just exactly on the thin stroke or the tiny center dot.
      g.append('circle')
        .attr('cx', cx).attr('cy', cy).attr('r', 15)
        .attr('fill', 'transparent')

      g.append('circle')
        .attr('cx', cx).attr('cy', cy).attr('r', 15)
        .attr('fill', 'none').attr('stroke', DESTINATION_COLOR).attr('stroke-width', 1.5)
        .attr('opacity', 0.1)
      g.append('circle')
        .attr('cx', cx).attr('cy', cy).attr('r', 4.5)
        .attr('fill', DESTINATION_COLOR)
        .attr('opacity', 0.1)

      const lx = c.labelRight ? cx + 19 : cx - 19
      const anchor = c.labelRight ? 'start' : 'end'
      const label = g.append('text')
        .attr('x', lx).attr('y', cy + 1)
        .attr('fill', '#fff').attr('font-size', 9)
        .attr('font-family', 'sans-serif').attr('font-weight', 600)
        .attr('text-anchor', anchor)
        .style('opacity', 0)
        .style('pointer-events', 'none')
        .style('transition', 'opacity 120ms ease')
        .text(c.city)

      g.on('mouseenter', () => label.style('opacity', 1))
        .on('mouseleave', () => label.style('opacity', 0))
    })

    // Truck pins — teardrop markers colored by class.
    const pins = zoomGroup.append('g')
    TRUCKS.forEach((t) => {
      const p = projection([t.lon, t.lat])
      if (!p) return
      const [px, py] = p
      const color = CLASS_COLOR[t.class]
      // Pin tip sits exactly on the projected point.
      const g = pins
        .append('g')
        .attr('transform', `translate(${px},${py}) scale(0.9)`)
        .style('cursor', 'pointer')
        .on('click', (event) => {
          event.stopPropagation()
          setSelected(t)
        })

      // Invisible hit area so the whole pin is easy to click.
      g.append('circle')
        .attr('cx', 0).attr('cy', -14).attr('r', 16)
        .attr('fill', 'transparent')
      g.append('path')
        .attr('d', 'M0 0 C -5 -7 -9 -10 -9 -16 A 9 9 0 1 1 9 -16 C 9 -10 5 -7 0 0 Z')
        .attr('fill', color)
        .attr('stroke', 'rgba(255,255,255,0.85)')
        .attr('stroke-width', 1)
      g.append('circle')
        .attr('cx', 0).attr('cy', -16).attr('r', 3.2)
        .attr('fill', '#fff')
    })

    // Zoom & pan
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .translateExtent([[0, 0], [W, H]])
      .on('zoom', (event) => {
        zoomGroup.attr('transform', event.transform.toString())
      })
    svg.call(zoomBehavior).on('dblclick.zoom', null)

    return () => {
      svg.on('.zoom', null)
      svg.call(zoomBehavior.transform, zoomIdentity)
    }
  }, [])

  return (
    <section className="card market-map-card">
      <div className="card-head">
        <span className="eyebrow">Fleet Monitor</span>
      </div>
      <div className="market-map-wrap">
        <svg
          ref={svgRef}
          className="market-map-svg"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="US market map"
        />
        <div className="market-map-legend">
          <div className="mm-legend-label">My trucks</div>
          {(['A', 'B', 'C', 'D'] as const).map((cls) => (
            <span key={cls}>
              <i style={{ background: CLASS_COLOR[cls] }} />
              Class {cls}
            </span>
          ))}
        </div>

        {selected && (
          <TruckDetailPanel
            key={selected.id}
            truck={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </section>
  )
}

type Tab = 'unit' | 'driver' | 'trailer'

function DetailRow({
  label,
  value,
  badge,
  copy,
  refresh,
}: {
  label: string
  value: ReactNode
  badge?: string
  copy?: boolean
  refresh?: boolean
}) {
  return (
    <div className="tdp-row">
      <span className="tdp-row-label">{label}</span>
      <div className="tdp-row-value">
        <span>{value}</span>
        {badge && <span className="tdp-badge">{badge}</span>}
        {refresh && <RefreshCw size={15} className="tdp-icon" />}
        {copy && <Copy size={15} className="tdp-icon" />}
      </div>
    </div>
  )
}

function TruckDetailPanel({ truck, onClose }: { truck: Truck; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('unit')

  return (
    <div className="tdp" role="dialog" aria-label={`${truck.id} details`}>
      <div className="tdp-head">
        <div>
          <div className="tdp-title">{truck.id}</div>
          <div className="tdp-sub">Unit · Class {truck.class}</div>
        </div>
        <button className="tdp-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </div>

      <div className="tdp-tabs">
        {(['unit', 'driver', 'trailer'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`tdp-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="tdp-body">
        {tab === 'unit' && (
          <>
            <div className="tdp-section-title">General information</div>
            <DetailRow label="Current Location" value={truck.location} refresh />
            <DetailRow label="ETA" value={truck.eta} refresh />
            <DetailRow label="ELD" value={truck.eld} badge="Linked" copy />
            <DetailRow label="Plate Number" value={truck.plate} copy />
            <DetailRow label="VIN" value={truck.vin} copy />
            <DetailRow label="Fuel type" value={truck.fuel} copy />
            <div className="tdp-row tdp-row-collapse">
              <span className="tdp-row-label">Operating Cost</span>
              <ChevronDown size={16} className="tdp-icon" />
            </div>
            <DetailRow label="Max. Hitch" value={truck.maxHitch} copy />
            <DetailRow label="Axle Config" value={truck.axle} copy />
            <DetailRow label="Tank capacity" value={truck.tank} copy />

            <div className="tdp-section-title tdp-docs">Documents</div>
            <div className="tdp-row">
              <span className="tdp-row-label">Vehicle Documents</span>
              <div className="tdp-row-value">
                <span className="tdp-docs-count">{truck.documents} documents</span>
                <ChevronDown size={16} className="tdp-icon" />
                <Download size={15} className="tdp-icon" />
              </div>
            </div>
          </>
        )}

        {tab === 'driver' && (
          <>
            <div className="tdp-section-title">Driver</div>
            <DetailRow label="Name" value={truck.driver.name} />
            <DetailRow label="Phone" value={truck.driver.phone} copy />
            <DetailRow label="License" value={truck.driver.license} copy />
            <DetailRow label="Status" value={truck.driver.status} />
          </>
        )}

        {tab === 'trailer' && (
          <>
            <div className="tdp-section-title">Trailer</div>
            <DetailRow label="Trailer #" value={truck.trailer.number} copy />
            <DetailRow label="Type" value={truck.trailer.type} />
            <DetailRow label="Length" value={truck.trailer.length} />
            <DetailRow label="Status" value={truck.trailer.status} badge={truck.trailer.status === 'Linked' ? 'Linked' : undefined} />
          </>
        )}
      </div>
    </div>
  )
}
