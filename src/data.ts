export type Tone = 'green' | 'yellow' | 'orange' | 'red' | 'blue' | 'gray'

// Which direction is "good" for a metric. 'high' = higher is better
// (margin, MPG), 'low' = lower is better (wasted rate, idle burn).
export type Goal = 'high' | 'low'

// Color a delta by whether the change is favorable, given the metric's goal.
export function deltaTone(delta: string | undefined, goal?: Goal): Tone {
  if (!delta || !goal) return 'gray'
  const isNeg = delta.trim().startsWith('-')
  const favorable = goal === 'high' ? !isNeg : isNeg
  return favorable ? 'green' : 'red'
}

// Arrow direction follows the actual sign of the change.
export function deltaTrend(delta?: string): 'up' | 'down' | 'flat' {
  if (!delta) return 'flat'
  return delta.trim().startsWith('-') ? 'down' : 'up'
}

export interface KpiMetric {
  sub: string
  value: string
  statusText: string
  statusTone: Tone
  foot: string
  footDelta: string
  goal?: Goal
}

export interface DetailMetric {
  label: string
  value: string
  unit?: string
  delta?: string
  goal?: Goal
  hint?: string
  series: number[]
}

export interface KpiCard {
  label: string
  metrics: KpiMetric[]
  wide?: boolean
  details?: DetailMetric[]
}

// Deterministic mock time-series shapes (10 points each).
const WAVES = [
  [0.9, 0.93, 0.91, 0.95, 0.96, 0.97, 0.98, 1.0, 1.02, 1.04],
  [1.06, 1.03, 1.04, 1.01, 1.0, 0.99, 0.98, 0.97, 0.96, 0.95],
  [0.94, 1.0, 0.92, 0.99, 1.03, 0.96, 1.05, 1.0, 1.04, 1.06],
  [0.99, 1.0, 0.99, 1.01, 1.0, 1.0, 1.01, 1.0, 1.02, 1.01],
]
const ts = (base: number, wave: number): number[] =>
  WAVES[wave].map((m) => Math.round(base * m * 1000) / 1000)

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
        footDelta: '+0.4',
        goal: 'high',
      },
      {
        sub: 'Wasted Rate',
        value: '5.45%',
        statusText: 'Slipping',
        statusTone: 'yellow',
        foot: '',
        footDelta: '-0.2',
        goal: 'low',
      },
    ],
    details: [
      { label: 'Margin', value: '6.6%', delta: '+0.4', goal: 'high', hint: 'Net margin on revenue', series: ts(6.6, 0) },
      { label: 'Negotiated rate / mile', value: '$4.10', unit: '/mi', delta: '+0.10', goal: 'high', hint: 'Client-agreed rate · income ÷ loaded miles', series: ts(4.1, 3) },
      { label: 'RPM total', value: '$3.43', unit: '/mi', delta: '+0.05', goal: 'high', hint: 'Real income per mile · income ÷ in-route miles', series: ts(3.43, 2) },
      { label: 'Wasted rate', value: '5.45%', delta: '-0.2', goal: 'low', hint: '% efficiency lost · (rpm_plan − rpm_actual) ÷ rpm_plan', series: ts(5.45, 1) },
      { label: 'Profit / mile loaded', value: '$1.061', unit: '/mi', delta: '+0.03', goal: 'high', hint: 'Profit ÷ loaded miles', series: ts(1.061, 0) },
      { label: 'Profit / mile total', value: '$0.928', unit: '/mi', delta: '+0.02', goal: 'high', hint: 'Profit ÷ in-route miles', series: ts(0.928, 2) },
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
        footDelta: '+1.2',
        goal: 'high',
      },
    ],
    details: [
      { label: 'Adherence', value: '70.4%', delta: '+1.2', goal: 'high', hint: 'Trips run as planned', series: ts(70.4, 0) },
      { label: 'On-time delivery', value: '88%', delta: '+0.6', goal: 'high', hint: 'Loads delivered within window', series: ts(88, 3) },
      { label: 'Plan compliance', value: '60%', delta: '-0.4', goal: 'high', hint: 'Executed vs planned routing', series: ts(60, 1) },
      { label: 'Detention hrs', value: '2.4', unit: 'h', delta: '-0.3', goal: 'low', hint: 'Avg hours held at dock', series: ts(2.4, 1) },
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
        footDelta: '+0.04',
        goal: 'low',
      },
    ],
    details: [
      { label: 'CPG vs optimal', value: '+$0.18', unit: '/gal', delta: '+0.04', goal: 'low', hint: 'Overpay vs optimal cost per gallon', series: ts(0.18, 2) },
      { label: 'MPG', value: '6.9', unit: 'mpg', delta: '+0.16', goal: 'high', hint: 'Miles per gallon, fleet avg', series: ts(6.9, 0) },
      { label: 'Idle burn', value: '10.7%', delta: '-0.3', goal: 'low', hint: '% of fuel burned idling', series: ts(10.7, 1) },
      { label: 'Fuel spend / wk', value: '$92K', delta: '-1.1K', goal: 'low', hint: 'Total weekly fuel cost', series: ts(92, 1) },
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
        goal: 'high',
      },
    ],
    details: [
      { label: 'vs market', value: '−2.3 pp', delta: '-0.2', goal: 'high', hint: 'Margin gap vs market benchmark', series: ts(2.3, 1) },
      { label: 'Win rate', value: '34%', delta: '+1.1', goal: 'high', hint: 'Bids won vs quoted', series: ts(34, 0) },
      { label: 'Lane coverage', value: '78%', delta: '+0.5', goal: 'high', hint: 'Lanes served vs demand', series: ts(78, 3) },
      { label: 'Rate index', value: '0.97', delta: '+0.01', goal: 'high', hint: 'Your rate vs market index', series: ts(0.97, 2) },
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
