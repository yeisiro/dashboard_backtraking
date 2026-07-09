import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  X,
  RefreshCw,
  Copy,
  ChevronDown,
  Download,
  Search,
  Maximize2,
  Minimize2,
  Plus,
  Minus,
  RotateCcw,
  User,
  MapPin,
  Truck as TruckIcon,
} from 'lucide-react'
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
  // Extra units near existing hubs (Chicago/Dallas) plus two new hubs
  // (Atlanta/LA) — demonstrates pin clustering when several trucks sit
  // close together at the default zoomed-out view.
  {
    id: 'R11101', lat: 42.3, lon: -87.4, class: 'B',
    location: 'Waukegan, IL', eta: '6h 10m', eld: '281474984321101', plate: '11029384756',
    vin: '1FTFW1ET8DFC00301', fuel: 'diesel', maxHitch: '1190', axle: '6x4', tank: '290 mi', documents: 2,
    driver: { name: 'Sam Ortiz', phone: '(847) 555-0110', license: 'IL-O2201', status: 'On duty' },
    trailer: { number: 'TR-1101', type: 'Dry Van', length: '53 ft', status: 'Linked' },
  },
  {
    id: 'R11102', lat: 41.6, lon: -87.9, class: 'C',
    location: 'Joliet, IL', eta: '4h 30m', eld: '281474984321102', plate: '22938475610',
    vin: '2GCEK19T531102938', fuel: 'diesel', maxHitch: '1120', axle: '4x2', tank: '280 mi', documents: 3,
    driver: { name: 'Nina Castillo', phone: '(815) 555-0122', license: 'IL-C3312', status: 'Resting' },
    trailer: { number: 'TR-1102', type: 'Reefer', length: '53 ft', status: 'Linked' },
  },
  {
    id: 'R11103', lat: 42.05, lon: -88.05, class: 'A',
    location: 'Elgin, IL', eta: '2h 15m', eld: '281474984321103', plate: '33847561029',
    vin: '3GNAXUEV5KL103928', fuel: 'diesel', maxHitch: '1250', axle: '6x4', tank: '305 mi', documents: 4,
    driver: { name: 'Owen Baxter', phone: '(224) 555-0133', license: 'IL-B4423', status: 'On duty' },
    trailer: { number: 'TR-1103', type: 'Flatbed', length: '48 ft', status: 'Linked' },
  },
  {
    id: 'R11104', lat: 41.5, lon: -87.15, class: 'D',
    location: 'Gary, IN', eta: '9h 45m', eld: '281474984321104', plate: '44756102938',
    vin: '4T1BF1FK0EU104839', fuel: 'regular', maxHitch: '960', axle: '4x2', tank: '260 mi', documents: 1,
    driver: { name: 'Renee Cole', phone: '(219) 555-0144', license: 'IN-C5534', status: 'Off duty' },
    trailer: { number: 'TR-1104', type: 'Dry Van', length: '53 ft', status: 'Unlinked' },
  },
  {
    id: 'R11105', lat: 33.2, lon: -96.5, class: 'A',
    location: 'McKinney, TX', eta: '5h 20m', eld: '281474984321105', plate: '55610293847',
    vin: '5FNRL6H97EB105940', fuel: 'diesel', maxHitch: '1230', axle: '6x4', tank: '312 mi', documents: 3,
    driver: { name: 'Jorge Delgado', phone: '(469) 555-0155', license: 'TX-D6645', status: 'On duty' },
    trailer: { number: 'TR-1105', type: 'Dry Van', length: '53 ft', status: 'Linked' },
  },
  {
    id: 'R11106', lat: 32.4, lon: -97.1, class: 'B',
    location: 'Arlington, TX', eta: '3h 05m', eld: '281474984321106', plate: '66102938475',
    vin: '6FTFW1EF1EFA10695', fuel: 'diesel', maxHitch: '1160', axle: '4x2', tank: '270 mi', documents: 2,
    driver: { name: 'Chloe Whitfield', phone: '(817) 555-0166', license: 'TX-W7756', status: 'Resting' },
    trailer: { number: 'TR-1106', type: 'Reefer', length: '53 ft', status: 'Linked' },
  },
  {
    id: 'R11107', lat: 33.0, lon: -97.3, class: 'C',
    location: 'Denton, TX', eta: '7h 40m', eld: '281474984321107', plate: '77029384756',
    vin: '7G1ZD5ST1LF107061', fuel: 'diesel', maxHitch: '1080', axle: '4x2', tank: '295 mi', documents: 4,
    driver: { name: 'Marcus Boyd', phone: '(940) 555-0177', license: 'TX-B8867', status: 'On duty' },
    trailer: { number: 'TR-1107', type: 'Flatbed', length: '48 ft', status: 'Linked' },
  },
  {
    id: 'R11108', lat: 33.749, lon: -84.388, class: 'A',
    location: 'Atlanta, GA', eta: '10h 15m', eld: '281474984321108', plate: '88293847561',
    vin: '8HGCM82633A108172', fuel: 'diesel', maxHitch: '1270', axle: '6x4', tank: '330 mi', documents: 3,
    driver: { name: 'Talia Grant', phone: '(404) 555-0188', license: 'GA-G9978', status: 'On duty' },
    trailer: { number: 'TR-1108', type: 'Dry Van', length: '53 ft', status: 'Linked' },
  },
  {
    id: 'R11109', lat: 34.1, lon: -84.0, class: 'B',
    location: 'Lawrenceville, GA', eta: '11h 50m', eld: '281474984321109', plate: '99384756102',
    vin: '9FMDK3GC1BB109283', fuel: 'diesel', maxHitch: '1145', axle: '4x2', tank: '285 mi', documents: 2,
    driver: { name: 'Derek Simmons', phone: '(678) 555-0199', license: 'GA-S0089', status: 'Resting' },
    trailer: { number: 'TR-1109', type: 'Reefer', length: '53 ft', status: 'Unlinked' },
  },
  {
    id: 'R11110', lat: 33.4, lon: -84.7, class: 'C',
    location: 'Newnan, GA', eta: '13h 25m', eld: '281474984321110', plate: '10293847561',
    vin: '1VWDX7AJ0DM110394', fuel: 'diesel', maxHitch: '1095', axle: '4x2', tank: '275 mi', documents: 1,
    driver: { name: 'Paige Alvarado', phone: '(770) 555-0100', license: 'GA-A1190', status: 'Off duty' },
    trailer: { number: 'TR-1110', type: 'Flatbed', length: '48 ft', status: 'Linked' },
  },
  {
    id: 'R11111', lat: 34.0, lon: -84.9, class: 'D',
    location: 'Marietta, GA', eta: '14h 05m', eld: '281474984321111', plate: '11928374650',
    vin: '2G1ZD5ST9LF111405', fuel: 'regular', maxHitch: '975', axle: '4x2', tank: '260 mi', documents: 2,
    driver: { name: 'Isaiah Ferrell', phone: '(470) 555-0111', license: 'GA-F2201', status: 'On duty' },
    trailer: { number: 'TR-1111', type: 'Dry Van', length: '53 ft', status: 'Linked' },
  },
  {
    id: 'R11112', lat: 34.052, lon: -118.244, class: 'A',
    location: 'Los Angeles, CA', eta: '28h 30m', eld: '281474984321112', plate: '12837465091',
    vin: '3VWDX7AJ2DM112516', fuel: 'diesel', maxHitch: '1260', axle: '6x4', tank: '318 mi', documents: 4,
    driver: { name: 'Vanessa Cruz', phone: '(213) 555-0112', license: 'CA-C3312', status: 'On duty' },
    trailer: { number: 'TR-1112', type: 'Dry Van', length: '53 ft', status: 'Linked' },
  },
  {
    id: 'R11113', lat: 34.5, lon: -117.9, class: 'B',
    location: 'Victorville, CA', eta: '26h 10m', eld: '281474984321113', plate: '23948756102',
    vin: '4T1BF1FK2CU113627', fuel: 'diesel', maxHitch: '1130', axle: '4x2', tank: '290 mi', documents: 3,
    driver: { name: 'Miguel Torres', phone: '(760) 555-0123', license: 'CA-T4423', status: 'Resting' },
    trailer: { number: 'TR-1113', type: 'Reefer', length: '53 ft', status: 'Linked' },
  },
  {
    id: 'R11114', lat: 33.7, lon: -118.5, class: 'C',
    location: 'Torrance, CA', eta: '29h 45m', eld: '281474984321114', plate: '34857610293',
    vin: '5NPE24AF3FH114738', fuel: 'diesel', maxHitch: '1085', axle: '4x2', tank: '270 mi', documents: 2,
    driver: { name: 'Sierra Nakamura', phone: '(310) 555-0134', license: 'CA-N5534', status: 'On duty' },
    trailer: { number: 'TR-1114', type: 'Flatbed', length: '48 ft', status: 'Unlinked' },
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

function statusDotColor(status: string) {
  if (status === 'On duty') return 'var(--green, #2ee6a6)'
  if (status === 'Resting') return 'var(--yellow, #f5c84b)'
  return 'var(--text-muted, #626b78)'
}

function formatAgo(ts: number, now: number) {
  const seconds = Math.max(0, Math.round((now - ts) / 1000))
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'} ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  return `${hours} hour${hours === 1 ? '' : 's'} ago`
}

// Trucks projected within this many screen pixels of each other collapse
// into a single cluster marker. Divided by the current zoom scale so the
// grouping loosens as the user zooms in (pins spread out, clusters split).
const CLUSTER_PIXEL_RADIUS = 26

export default function MarketMap({ fill = false }: { fill?: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selected, setSelected] = useState<Truck | null>(null)
  const [search, setSearch] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [hiddenClasses, setHiddenClasses] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState(false)

  // When each truck's location last reported in — staggered on load so the
  // list looks like a live feed, then bumped to "just now" on refresh.
  const [lastUpdated, setLastUpdated] = useState<Record<string, number>>(() => {
    const start = Date.now()
    return Object.fromEntries(TRUCKS.map((t, i) => [t.id, start - (7000 + i * 4231) % 90000]))
  })
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const refreshLocation = (id: string) => {
    setLastUpdated((prev) => ({ ...prev, [id]: Date.now() }))
  }
  const refreshAllLocations = () => {
    const stamp = Date.now()
    setLastUpdated(Object.fromEntries(TRUCKS.map((t) => [t.id, stamp])))
  }

  // Refs so the pin/zoom effects (which re-run on filter changes) can reach
  // the projection, pins layer, and zoom behavior built by the mount effect
  // without rebuilding the whole map (that would reset pan/zoom every keystroke).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projectionRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pinsGroupRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zoomBehaviorRef = useRef<any>(null)
  // Current zoom scale (k) — pins/labels counter-scale by 1/k so they stay a
  // constant on-screen size instead of ballooning when the map zooms in.
  const zoomKRef = useRef(1)
  // Latest cluster/pin render function — rebuilt whenever visibleTrucks
  // changes, called both after that rebuild and on every zoom tick (so
  // clusters re-group live as the zoom level changes pixel distances).
  const drawPinsRef = useRef<(k: number) => void>(() => {})

  const q = search.trim().toLowerCase()
  // Map pins/clusters only respect the class legend — search no longer hides
  // pins, it's just a lookup that jumps to a truck once one is picked.
  const visibleTrucks = useMemo(
    () => TRUCKS.filter((t) => !hiddenClasses.has(t.class)),
    [hiddenClasses],
  )
  // Shows the full fleet by default; typing narrows the list down.
  const searchResults = useMemo(() => {
    if (q === '') return visibleTrucks
    return visibleTrucks.filter(
      (t) =>
        t.id.toLowerCase().includes(q) ||
        t.driver.name.toLowerCase().includes(q) ||
        t.location.toLowerCase().includes(q),
    )
  }, [q, visibleTrucks])

  const toggleClass = (cls: string) => {
    setHiddenClasses((prev) => {
      const next = new Set(prev)
      if (next.has(cls)) next.delete(cls)
      else next.add(cls)
      return next
    })
  }

  const zoomBy = (factor: number) => {
    const svgEl = svgRef.current
    const zoomBehavior = zoomBehaviorRef.current
    if (!svgEl || !zoomBehavior) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(select(svgEl) as any).transition().duration(200).call(zoomBehavior.scaleBy, factor)
  }

  const resetZoom = () => {
    const svgEl = svgRef.current
    const zoomBehavior = zoomBehaviorRef.current
    if (!svgEl || !zoomBehavior) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(select(svgEl) as any).transition().duration(300).call(zoomBehavior.transform, zoomIdentity)
  }

  // Zooms/pans to fit a set of projected pixel points — used both by search
  // (fit the matches) and by clicking a cluster (fit its members, splitting it).
  const zoomToPixelPoints = (pts: [number, number][]) => {
    const svgEl = svgRef.current
    const zoomBehavior = zoomBehaviorRef.current
    if (!svgEl || !zoomBehavior || pts.length === 0) return
    const svg = select(svgEl)

    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const spanX = Math.max(maxX - minX, 1)
    const spanY = Math.max(maxY - minY, 1)
    const padding = 140
    const scale = Math.min(8, Math.max(2.5, Math.min((W - padding) / spanX, (H - padding) / spanY)))
    const transform = zoomIdentity.translate(W / 2, H / 2).scale(scale).translate(-cx, -cy)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(svg as any).transition().duration(500).call(zoomBehavior.transform, transform)
  }

  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return

    const projection = geoAlbersUsa().scale(1280).translate([W / 2, H / 2])
    const path = geoPath().projection(projection)
    projectionRef.current = projection

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

    // Truck pins live in their own group, drawn/updated by a separate effect
    // below so filtering by search/class doesn't require rebuilding the base map.
    pinsGroupRef.current = zoomGroup.append('g')

    // Zoom & pan
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .translateExtent([[0, 0], [W, H]])
      .on('zoom', (event) => {
        zoomGroup.attr('transform', event.transform.toString())
        zoomKRef.current = event.transform.k
        drawPinsRef.current(event.transform.k)
      })
    svg.call(zoomBehavior).on('dblclick.zoom', null)
    zoomBehaviorRef.current = zoomBehavior

    return () => {
      svg.on('.zoom', null)
      svg.call(zoomBehavior.transform, zoomIdentity)
    }
  }, [])

  // Draw/refresh truck pins whenever the search text, class visibility, or
  // zoom level changes. Nearby trucks (within CLUSTER_PIXEL_RADIUS on screen)
  // collapse into a single cluster marker showing how many are grouped there;
  // clicking a cluster zooms in to fit and split its members.
  useEffect(() => {
    const projection = projectionRef.current
    if (!projection) return

    const points = visibleTrucks
      .map((t) => {
        const p = projection([t.lon, t.lat])
        return p ? { t, x: p[0], y: p[1] } : null
      })
      .filter((p): p is { t: Truck; x: number; y: number } => p !== null)

    drawPinsRef.current = (k: number) => {
      const pins = pinsGroupRef.current
      if (!pins) return
      pins.selectAll('*').remove()

      const threshold = CLUSTER_PIXEL_RADIUS / k
      const used = new Set<string>()
      const clusters: { x: number; y: number; items: { t: Truck; x: number; y: number }[] }[] = []
      points.forEach((p) => {
        if (used.has(p.t.id)) return
        const group = [p]
        used.add(p.t.id)
        points.forEach((q) => {
          if (used.has(q.t.id)) return
          if (Math.hypot(p.x - q.x, p.y - q.y) < threshold) {
            group.push(q)
            used.add(q.t.id)
          }
        })
        const cx = group.reduce((s, g) => s + g.x, 0) / group.length
        const cy = group.reduce((s, g) => s + g.y, 0) / group.length
        clusters.push({ x: cx, y: cy, items: group })
      })

      clusters.forEach((c) => {
        if (c.items.length === 1) {
          drawTruckPin(pins, c.items[0].t, c.items[0].x, c.items[0].y, k)
        } else {
          drawClusterMarker(pins, c, k)
        }
      })
    }

    drawPinsRef.current(zoomKRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTrucks])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function drawTruckPin(pins: any, t: Truck, px: number, py: number, k: number) {
    const color = CLASS_COLOR[t.class]
    // Pin tip sits exactly on the projected point. Counter-scale by the
    // current zoom level so the pin/label stay a constant on-screen size.
    const g = pins
      .append('g')
      .attr('transform', `translate(${px},${py}) scale(${0.9 / k})`)
      .style('cursor', 'pointer')
      .on('click', (event: Event) => {
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

    // Truck ID label — always visible above the pin.
    g.append('text')
      .attr('x', 0).attr('y', -32)
      .attr('text-anchor', 'middle')
      .attr('fill', '#fff')
      .attr('font-size', 9)
      .attr('font-family', 'sans-serif')
      .attr('font-weight', 700)
      .attr('stroke', 'rgba(0,0,0,0.65)')
      .attr('stroke-width', 3)
      .style('paint-order', 'stroke')
      .style('pointer-events', 'none')
      .text(t.id)
  }

  function drawClusterMarker(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pins: any,
    cluster: { x: number; y: number; items: { t: Truck; x: number; y: number }[] },
    k: number,
  ) {
    const count = cluster.items.length
    const r = (Math.min(22, 12 + count * 1.6)) / k

    const g = pins
      .append('g')
      .attr('transform', `translate(${cluster.x},${cluster.y})`)
      .style('cursor', 'pointer')
      .on('click', (event: Event) => {
        event.stopPropagation()
        zoomToPixelPoints(cluster.items.map((it) => [it.x, it.y] as [number, number]))
      })

    g.append('circle')
      .attr('r', r)
      .attr('fill', 'rgba(77, 157, 255, 0.9)')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5 / k)
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', '#fff')
      .attr('font-size', 12 / k)
      .attr('font-family', 'sans-serif')
      .attr('font-weight', 700)
      .style('pointer-events', 'none')
      .text(count)
  }

  // Opening the list while the detail panel is open makes them overlap
  // (both anchor to the right edge) — close the panel first.
  const openSearchResults = () => {
    setShowResults(true)
    setSelected(null)
  }

  // Picking a result from the list zooms/pans to that truck and opens the
  // same detail panel a click would — typing alone never moves the map,
  // only choosing a result does.
  const selectSearchResult = (t: Truck) => {
    const projection = projectionRef.current
    const p = projection?.([t.lon, t.lat])
    if (p) zoomToPixelPoints([p])
    setSelected(t)
    setSearch('')
    setShowResults(false)
  }

  return (
    <section className={`card market-map-card ${fill ? 'mm-fill' : ''}`}>
      <div className="card-head">
        <span className="eyebrow">Fleet Monitor</span>
        <div className="mm-header-actions">
        <div className="mm-search-wrap">
          <div className="mm-search-box">
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search truck, driver, or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              // onClick (not just onFocus) because picking a result keeps the
              // input focused (its button's onMouseDown prevents the blur
              // that would otherwise close the dropdown mid-click) — so
              // clicking the already-focused input again fires no new focus
              // event, and this is the only way to reopen the list.
              onFocus={openSearchResults}
              onClick={openSearchResults}
              onBlur={() => setTimeout(() => setShowResults(false), 150)}
            />
            {search && (
              <button
                type="button"
                className="mm-search-clear"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {showResults && (
            <div className="mm-search-results">
              {searchResults.length === 0 && (
                <div className="mm-search-empty">
                  {q === '' ? 'All truck classes are hidden' : `No trucks match "${search.trim()}"`}
                </div>
              )}
              {searchResults.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="mm-search-result"
                  // Fires before the input's onBlur closes the dropdown.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSearchResult(t)}
                >
                  <div className="mm-sr-id">{t.id}</div>
                  <div className="mm-sr-row">
                    <span className="mm-sr-dot" style={{ background: statusDotColor(t.driver.status) }} />
                    <span className="mm-sr-chip">
                      <User size={12} /> {t.driver.name}
                    </span>
                  </div>
                  <div className="mm-sr-row mm-sr-muted">
                    <MapPin size={12} /> {t.location} · {formatAgo(lastUpdated[t.id] ?? now, now)}
                  </div>
                  <div className="mm-sr-row mm-sr-muted">
                    <TruckIcon size={12} /> {t.trailer.type} · {t.trailer.number}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className="mm-refresh-all-btn"
          onClick={refreshAllLocations}
          aria-label="Refresh all truck locations"
        >
          <RefreshCw size={14} />
        </button>
        </div>
      </div>
      {expanded && <div className="mm-expand-backdrop" onClick={() => setExpanded(false)} />}
      <div className={`market-map-wrap ${expanded ? 'expanded' : ''} ${fill && !expanded ? 'mm-fill-wrap' : ''}`}>
        <svg
          ref={svgRef}
          className="market-map-svg"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="US market map"
        />

        <button
          type="button"
          className="mm-expand-btn"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse map' : 'Expand map'}
        >
          {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>

        <div className="mm-zoom-controls">
          <button type="button" onClick={() => zoomBy(1.4)} aria-label="Zoom in">
            <Plus size={16} />
          </button>
          <button type="button" onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom out">
            <Minus size={16} />
          </button>
          <button type="button" onClick={resetZoom} aria-label="Reset view">
            <RotateCcw size={14} />
          </button>
        </div>

        <div className="market-map-legend">
          <div className="mm-legend-label">My trucks (click to hide/show)</div>
          {(['A', 'B', 'C', 'D'] as const).map((cls) => (
            <button
              key={cls}
              type="button"
              className={`mm-legend-item ${hiddenClasses.has(cls) ? 'inactive' : ''}`}
              onClick={() => toggleClass(cls)}
            >
              <i style={{ background: CLASS_COLOR[cls] }} />
              Class {cls}
            </button>
          ))}
        </div>

        {visibleTrucks.length === 0 && (
          <div className="mm-empty">All truck classes are hidden</div>
        )}

        {selected && (
          <TruckDetailPanel
            key={selected.id}
            truck={selected}
            onClose={() => setSelected(null)}
            lastUpdatedAt={lastUpdated[selected.id] ?? now}
            now={now}
            onRefreshLocation={() => refreshLocation(selected.id)}
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
  onRefresh,
  caption,
}: {
  label: string
  value: ReactNode
  badge?: string
  copy?: boolean
  refresh?: boolean
  onRefresh?: () => void
  caption?: string
}) {
  return (
    <div className="tdp-row">
      <span className="tdp-row-label">{label}</span>
      <div className="tdp-row-value-col">
        <div className="tdp-row-value">
          <span>{value}</span>
          {badge && <span className="tdp-badge">{badge}</span>}
          {refresh && (
            onRefresh ? (
              <button type="button" className="tdp-icon-btn" onClick={onRefresh} aria-label={`Refresh ${label}`}>
                <RefreshCw size={15} className="tdp-icon" />
              </button>
            ) : (
              <RefreshCw size={15} className="tdp-icon" />
            )
          )}
          {copy && <Copy size={15} className="tdp-icon" />}
        </div>
        {caption && <span className="tdp-row-caption">{caption}</span>}
      </div>
    </div>
  )
}

function TruckDetailPanel({
  truck,
  onClose,
  lastUpdatedAt,
  now,
  onRefreshLocation,
}: {
  truck: Truck
  onClose: () => void
  lastUpdatedAt: number
  now: number
  onRefreshLocation: () => void
}) {
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
            <DetailRow
              label="Current Location"
              value={truck.location}
              refresh
              onRefresh={onRefreshLocation}
              caption={`Updated ${formatAgo(lastUpdatedAt, now)}`}
            />
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
