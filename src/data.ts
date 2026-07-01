export type Tone = 'green' | 'yellow' | 'orange' | 'red' | 'blue' | 'gray'

// Which direction is "good" for a metric. 'high' = higher is better
// (margin, MPG), 'low' = lower is better (wasted rate, idle burn),
// 'neutral' = neither up nor down is inherently good (e.g. gallons refueled).
export type Goal = 'high' | 'low' | 'neutral'

// Color a delta by whether the change is favorable, given the metric's goal.
// 'neutral' shows the change without judging it good or bad (gray).
export function deltaTone(delta: string | undefined, goal?: Goal): Tone {
  if (!delta || !goal || goal === 'neutral') return 'gray'
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
  // Legend name for the primary series when a second line is overlaid.
  seriesLabel?: string
  // Optional second line drawn on the same chart, for related pairs
  // (e.g. total vs in-route cost, actual vs optimal CPG).
  compare?: { label: string; value: string; delta?: string; series: number[] }
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
    label: 'Profitability',
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
    ],
    details: [
      { label: 'Margin', value: '6.6%', delta: '+0.4', goal: 'high', hint: 'Net margin on revenue', series: ts(6.6, 0) },
      { label: 'Profit / mile', value: '$0.921', unit: '/mi', delta: '+0.02', goal: 'high', hint: 'Profit earned per mile driven', series: ts(0.921, 2) },
      { label: 'Income / truck', value: '$740', unit: '/day', delta: '+18', goal: 'high', hint: 'Average revenue per truck per day', series: ts(740, 3) },
      { label: 'Total leak', value: '-$1,200', unit: '/day', delta: '-40', goal: 'low', hint: 'Money lost to inefficiency per day', series: ts(1.2, 1) },
      { label: 'Recoverable ( a recipe )', value: '+$88k', unit: '/mo', delta: '+6', goal: 'high', hint: 'Monthly money you could recover by following the winning recipe', series: ts(88, 0) },
    ],
  },
  {
    label: 'Efficiency',
    metrics: [
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
      { label: 'Wasted rate', value: '5.45%', delta: '-0.2', goal: 'low', hint: 'Share of expected revenue lost to inefficiency', series: ts(5.45, 1) },
      { label: 'Deadhead %', value: '19.4%', delta: '-0.6', goal: 'low', hint: 'Share of miles driven empty', series: ts(19.4, 1) },
      { label: 'Idle %', value: '12.1%', delta: '-0.3', goal: 'low', hint: 'Share of engine hours spent idling', series: ts(12.1, 1) },
      { label: 'MPG', value: '6.18', unit: 'mpg', delta: '+0.12', goal: 'high', hint: 'Miles per gallon, fleet average', series: ts(6.18, 0) },
      { label: 'Cost / mile', value: '$1.97', unit: '/mi', delta: '-0.03', goal: 'low', hint: 'All-in operating cost per mile', series: ts(1.97, 2) },
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
        foot: '',
        footDelta: '+1.2',
        goal: 'high',
      },
    ],
    details: [
      { label: 'Adherence', value: '70.4%', delta: '+1.2', goal: 'high', hint: 'Trips run as planned', series: ts(70.4, 0) },
      { label: 'Late departures', value: '6.8%', delta: '-0.9', goal: 'low', hint: 'Share of trips that departed later than the planned pickup time', series: ts(6.8, 1) },
      { label: 'Off-route events', value: '23', delta: '-5', goal: 'low', hint: 'Times a truck left the planned route', series: ts(23, 2) },
      { label: 'Fuel deviations', value: '17', delta: '-3', goal: 'low', hint: 'Fuel usage anomalies vs plan', series: ts(17, 1) },
      { label: 'Plan adherence / load', value: '67.8%', delta: '+1.1', goal: 'high', hint: 'Loads executed as planned', series: ts(67.8, 3) },
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
        foot: '',
        footDelta: '+0.04',
        goal: 'low',
      },
    ],
    details: [
      { label: 'CPG vs optimal', value: '+$0.18', unit: '/gal', delta: '+0.04', goal: 'low', hint: 'Overpay per gallon vs the best achievable cost', series: ts(0.18, 2) },
      { label: 'CPG: actual vs optimal', value: '$3.60', delta: '+0.06', goal: 'low', hint: 'Cost per gallon paid vs best achievable', series: ts(3.6, 2), seriesLabel: 'Actual', compare: { label: 'Optimal', value: '$3.42', delta: '+0.02', series: ts(3.42, 0) } },
      { label: 'Diesel cost', value: '$604,411', delta: '+9.1K', goal: 'neutral', hint: 'Total diesel spend vs the share bought on planned routes', series: ts(604411, 3), seriesLabel: 'Total', compare: { label: 'In routes', value: '$427,923', delta: '+6.2K', series: ts(427923, 3) } },
      { label: 'Gallons refueled', value: '142,830', delta: '+1.2K', goal: 'neutral', hint: 'Total gallons refueled in the period', series: ts(142830, 3) },
      { label: 'Fuel missed sav', value: '$25,710', delta: '+820', goal: 'low', hint: 'Savings missed vs optimal fueling', series: ts(25710, 1) },
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
        foot: '',
        footDelta: '',
        goal: 'high',
      },
    ],
    details: [
      { label: 'vs market', value: '−2.3 pp', delta: '-0.2', goal: 'high', hint: 'Margin gap vs market benchmark', series: ts(2.3, 1) },
      { label: 'RPM negotiated', value: '$3.37', unit: '/mi', delta: '+0.03', goal: 'high', hint: 'Negotiated revenue per mile', series: ts(3.37, 0) },
      { label: 'RPM effective', value: '$2.62', unit: '/mi', delta: '-0.02', goal: 'high', hint: 'Actual revenue earned per mile', series: ts(2.62, 2) },
      { label: 'Lane gap (top5)', value: '-$0.13', unit: '/mi', delta: '+0.01', goal: 'high', hint: 'Rate gap vs market on your top 5 lanes', series: ts(0.13, 1) },
      { label: 'Opportunity', value: '$24k', unit: '/wk', delta: '+2K', goal: 'high', hint: 'Weekly upside if you close the market gap', series: ts(24, 3) },
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
  { name: 'Missed Fuel savings', pct: 35, amount: '-$7,000', width: 70, color: '#c2453f' },
  { name: 'Deadhead Miles', pct: 28, amount: '-$5,600', width: 56, color: '#cf5a44' },
  { name: 'Route Deviations', pct: 22, amount: '-$4,400', width: 44, color: '#d97a3e' },
  { name: 'Idle Time', pct: 15, amount: '-$3,000', width: 30, color: '#d99440' },
]

// Total money lost across all leakage categories (sum of leakBars), and the
// change vs the comparison period. Goal is 'low' — less leakage is better.
export const leakTotal = '-$20,000'
export const leakDelta = '-5.2%'

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
