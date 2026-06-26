export type Tone = 'green' | 'yellow' | 'orange' | 'red' | 'blue' | 'gray'

export interface KpiMetric {
  sub: string
  value: string
  statusText: string
  statusTone: Tone
  foot: string
  footDelta: string
  footTone: Tone
  trend: 'up' | 'down' | 'flat'
}

export interface KpiCard {
  label: string
  metrics: KpiMetric[]
  wide?: boolean
}

export const kpiCards: KpiCard[] = [
  {
    label: 'Financial Health',
    wide: true,
    metrics: [
      {
        sub: 'Margin',
        value: '6.6%',
        statusText: 'Healthy',
        statusTone: 'green',
        foot: '',
        footDelta: '+0.4 pp WoW',
        footTone: 'green',
        trend: 'up',
      },
      {
        sub: 'Wasted Rate',
        value: '6.6%',
        statusText: 'Slipping',
        statusTone: 'yellow',
        foot: '(improving)',
        footDelta: '-0.2 pp WoW',
        footTone: 'red',
        trend: 'down',
      },
    ],
  },
  {
    label: 'Execution',
    metrics: [
      {
        sub: 'Adherence',
        value: '70.4%',
        statusText: 'Stable',
        statusTone: 'green',
        foot: '· target 90%',
        footDelta: '+1.2 pp WoW',
        footTone: 'green',
        trend: 'up',
      },
    ],
  },
  {
    label: 'Fuel',
    metrics: [
      {
        sub: 'CPG vs optimal',
        value: '+$0.18/gal',
        statusText: 'Overpay',
        statusTone: 'yellow',
        foot: '· Iran Shock context',
        footDelta: '+0.04 WoW',
        footTone: 'gray',
        trend: 'flat',
      },
    ],
  },
  {
    label: 'Market Position',
    metrics: [
      {
        sub: 'vs market',
        value: '−2.3 pp',
        statusText: 'Behind',
        statusTone: 'red',
        foot: 'opportunity $24K/wk',
        footDelta: '',
        footTone: 'gray',
        trend: 'flat',
      },
    ],
  },
]

export interface LeakBar {
  name: string
  pct: number
  amount: string
  width: number // 0..100 relative to $10k axis
  color: string
}

export const leakBars: LeakBar[] = [
  { name: 'Missed Fuel savings', pct: 32, amount: '-$7,200', width: 80, color: '#c2453f' },
  { name: 'Empty Mile', pct: 26, amount: '-$7,200', width: 66, color: '#cf5a44' },
  { name: 'Route Deviations', pct: 21, amount: '-$7,200', width: 53, color: '#d97a3e' },
  { name: 'Idle Time', pct: 14, amount: '-$7,200', width: 40, color: '#d99440' },
  { name: 'Late Deliveries', pct: 7, amount: '-$7,200', width: 22, color: '#e0b24a' },
]

export interface RankRow {
  rank: string
  name: string
  value: string
  tone: Tone
  you?: boolean
}

export const bottom3: RankRow[] = [
  { rank: '01', name: '#4521', value: '-$465/mo', tone: 'red' },
  { rank: '02', name: '#4521', value: '-$465/mo', tone: 'red' },
  { rank: '03', name: '#4521', value: '-$465/mo', tone: 'red' },
]
export const top3: RankRow[] = [
  { rank: '01', name: '#4521', value: '+$465/mo', tone: 'green' },
  { rank: '02', name: '#4521', value: '+$465/mo', tone: 'green' },
  { rank: '03', name: '#4521', value: '+$465/mo', tone: 'green' },
]
export const leaders: RankRow[] = [
  { rank: '01', name: 'Truck X', value: '+$465/mo', tone: 'green' },
  { rank: '02', name: '#4521', value: '+$465/mo', tone: 'green', you: true },
  { rank: '03', name: 'Truck Z', value: '+$465/mo', tone: 'green' },
]

export interface Trip {
  id: string
  cls: 'C' | 'D'
  alert: string
  alertTone: Tone
  route: string
  leakLabel: string
  leakValue: string
  leakTone: Tone
}

export const trips: Trip[] = [
  { id: '#4521', cls: 'D', alert: 'Off-route now (I-30)', alertTone: 'orange', route: 'ATL → DAL', leakLabel: 'Leak wk:', leakValue: '-$465', leakTone: 'red' },
  { id: '#4521', cls: 'D', alert: 'Fuel outside corridor', alertTone: 'orange', route: 'JAX → NSH', leakLabel: 'Leak wk:', leakValue: '-$280', leakTone: 'red' },
  { id: '#4521', cls: 'C', alert: 'Idle 28 min · MS hub', alertTone: 'yellow', route: 'MIA → HOU', leakLabel: 'Leak wk:', leakValue: '-$390', leakTone: 'red' },
  { id: '#4521', cls: 'C', alert: 'HOS limit approaching', alertTone: 'yellow', route: 'CHI → ATL', leakLabel: '', leakValue: 'no leak yet', leakTone: 'gray' },
  { id: '#4521', cls: 'C', alert: 'no current alert', alertTone: 'gray', route: 'CHI → MEM', leakLabel: 'Leak wk:', leakValue: '-$310', leakTone: 'red' },
]

export interface MapTruck {
  id: string
  x: number
  y: number
  tone: Tone
  ring?: boolean
  label?: 'above' | 'below'
}

// Coordinates are within a 560 x 320 viewBox.
export const mapTrucks: MapTruck[] = [
  { id: '#2008', x: 250, y: 120, tone: 'gray', label: 'above' },
  { id: '#2014', x: 330, y: 80, tone: 'orange', ring: true, label: 'above' },
  { id: '#5007', x: 450, y: 110, tone: 'orange', ring: true, label: 'above' },
  { id: '#4521', x: 360, y: 175, tone: 'red', ring: true, label: 'below' },
  { id: '#4012', x: 400, y: 235, tone: 'orange', ring: true, label: 'below' },
  { id: '#5012', x: 360, y: 280, tone: 'orange', ring: true, label: 'below' },
  // ambient dots
  { id: '', x: 150, y: 170, tone: 'green' },
  { id: '', x: 190, y: 210, tone: 'green' },
  { id: '', x: 230, y: 195, tone: 'green' },
  { id: '', x: 270, y: 225, tone: 'green' },
  { id: '', x: 300, y: 200, tone: 'green' },
  { id: '', x: 330, y: 245, tone: 'green' },
  { id: '', x: 410, y: 180, tone: 'green' },
  { id: '', x: 440, y: 210, tone: 'green' },
  { id: '', x: 290, y: 270, tone: 'yellow' },
  { id: '', x: 470, y: 250, tone: 'green' },
  { id: '', x: 210, y: 140, tone: 'green' },
]
