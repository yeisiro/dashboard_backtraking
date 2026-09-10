// Shared US-map geometry helpers — the same projection/data the trip detail map
// and MarketMap use, factored out so focused map views (e.g. the deadhead-split
// modal) can reuse them without duplicating the projection setup.
import { geoAlbersUsa, geoPath } from 'd3-geo'
import { feature, mesh } from 'topojson-client'
import type { FeatureCollection, MultiLineString } from 'geojson'
import usTopo from 'us-atlas/states-10m.json'

export const MAP_W = 960
export const MAP_H = 520
export const mapProjection = geoAlbersUsa().scale(1280).translate([MAP_W / 2, MAP_H / 2])
const mapPathGen = geoPath().projection(mapProjection)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const usTopoAny = usTopo as any
const NATION_FEATURE = feature(usTopoAny, usTopoAny.objects.nation) as unknown as FeatureCollection
const STATE_MESH = mesh(usTopoAny, usTopoAny.objects.states, (a: unknown, b: unknown) => a !== b)
export const NATION_PATH = mapPathGen(NATION_FEATURE) ?? ''
export const STATE_MESH_PATH = mapPathGen(STATE_MESH as unknown as MultiLineString) ?? ''

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
  'Wolcott, IN': [-87.043, 40.758],
  'Louisville, KY': [-85.759, 38.253],
  'San Antonio, TX': [-98.494, 29.424],
  'Austin, TX': [-97.743, 30.267],
  'Sacramento, CA': [-121.494, 38.582],
  'Stockton, CA': [-121.29, 37.958],
  'Omaha, NE': [-95.995, 41.257],
  'Albuquerque, NM': [-106.65, 35.084],
  'Santa Fe, NM': [-105.937, 35.687],
}

export function projectCity(cityName: string): [number, number] {
  const coords = CITY_COORDS[cityName]
  return coords ? mapProjection(coords) ?? [MAP_W / 2, MAP_H / 2] : [MAP_W / 2, MAP_H / 2]
}

// "Miami, FL → Houston, TX" → ["Miami, FL", "Houston, TX"].
export function splitLane(lane: string): [string, string] {
  const parts = lane.split('→').map((s) => s.trim())
  return [parts[0] ?? lane, parts[1] ?? '']
}

// Deterministic per-trip seed so the same trip always draws the same shape.
export function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h) || 1
}
export function seededRandom(seed: number): () => number {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

// A gently-bent polyline between two points (not a straight connector), so it
// reads as a real leg on the highway network.
export function buildRoutePoints(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  seed: number,
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
export function pointAtFraction(
  points: [number, number][],
  t: number,
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
