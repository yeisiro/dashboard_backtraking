export type Tone = 'green' | 'yellow' | 'orange' | 'red' | 'blue' | 'gray'

// Which direction is "good" for a metric. 'high' = higher is better
// (margin, MPG), 'low' = lower is better (wasted rate, idle burn),
// 'neutral' = neither up nor down is inherently good (e.g. gallons refueled).
export type Goal = 'high' | 'low' | 'neutral'

// Color a delta by whether the change is favorable, given the metric's goal.
// 'neutral' shows the change without judging it good or bad (gray).
export function deltaTone(delta: string | undefined, goal?: Goal): Tone {
  if (!delta || !goal || goal === 'neutral') return 'gray'
  const isNeg = isNegative(delta)
  const favorable = goal === 'high' ? !isNeg : isNeg
  return favorable ? 'green' : 'red'
}

// Arrow direction follows the actual sign of the change.
export function deltaTrend(delta?: string): 'up' | 'down' | 'flat' {
  if (!delta) return 'flat'
  return isNegative(delta) ? 'down' : 'up'
}

// True when a value string is negative — accepts both the ASCII hyphen "-"
// and the typographic minus "−" (U+2212) used in some display values.
function isNegative(s: string): boolean {
  const t = s.trim()
  return t.startsWith('-') || t.startsWith('−')
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
  compare?: { label: string; value: string; delta?: string; gap?: string; gapDelta?: string; series: number[] }
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
        foot: 'Net profit as a share of revenue',
        footDelta: '+0.4',
        goal: 'high',
      },
    ],
    details: [
      { label: 'Margin', value: '6.6%', delta: '+0.4', goal: 'high', hint: 'Net margin on revenue', series: ts(6.6, 0) },
      { label: 'Profit / mile', value: '$0.921', unit: '/mi', delta: '+0.02', goal: 'high', hint: 'Profit earned per mile driven', series: ts(0.921, 2) },
      { label: 'Income / truck', value: '$740', unit: '/day', delta: '+18', goal: 'high', hint: 'Average revenue per truck per day', series: ts(740, 3) },
      { label: 'Total leak', value: '-$1,200', unit: '/day', delta: '-40', goal: 'low', hint: 'Money lost to inefficiency per day', series: ts(1.2, 1) },
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
        foot: 'Share of expected revenue lost to inefficiency',
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
        foot: 'Share of trips run as planned',
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
        foot: 'Extra cost per gallon vs the best achievable price',
        footDelta: '+0.04',
        goal: 'low',
      },
    ],
    details: [
      { label: 'CPG vs optimal', value: '+$0.18', unit: '/gal', delta: '+0.04', goal: 'low', hint: 'Overpay per gallon vs the best achievable cost', series: ts(0.18, 2) },
      { label: 'Gallons refueled', value: '142,830', delta: '+1.2K', goal: 'neutral', hint: 'Total gallons refueled in the period', series: ts(142830, 3) },
      { label: 'Fuel missed sav', value: '$25,710', delta: '+820', goal: 'low', hint: 'Savings missed vs optimal fueling', series: ts(25710, 1) },
      { label: 'CPG: actual vs optimal', value: '$3.60', delta: '+0.06', goal: 'low', hint: 'Cost per gallon paid vs best achievable', series: ts(3.6, 2), seriesLabel: 'Actual', compare: { label: 'Optimal', value: '$3.42', delta: '+0.02', series: ts(3.42, 0) } },
      { label: 'Diesel cost', value: '$604,411', delta: '+9.1K', goal: 'neutral', hint: 'Total diesel spend vs the share bought on planned routes', series: ts(604411, 3), seriesLabel: 'Total', compare: { label: 'In routes', value: '$427,923', delta: '+6.2K', series: ts(427923, 3) } },
    ],
  },
  {
    label: 'Market Position',
    metrics: [
      {
        sub: 'Margin gap vs market',
        value: '−2.3%',
        statusText: 'Behind',
        statusTone: 'red',
        foot: 'Your margin is 2.3% below the market benchmark',
        footDelta: '+0.3%',
        goal: 'high',
      },
    ],
    details: [
      { label: 'Margin', value: '6.6%', delta: '+0.4', goal: 'high', hint: 'Your net margin vs the market benchmark, and the gap between them', series: ts(6.6, 0), seriesLabel: 'Mine', compare: { label: 'Market', value: '8.9%', delta: '+0.1', gap: '−2.3%', gapDelta: '+0.3%', series: ts(8.9, 3) } },
      { label: 'RPM negotiated', value: '$3.37', unit: '/mi', delta: '+0.03', goal: 'high', hint: 'Negotiated revenue per mile — yours vs the market benchmark, and the gap between them', series: ts(3.37, 0), seriesLabel: 'Mine', compare: { label: 'Market', value: '$3.50', delta: '+0.02', gap: '−$0.13', gapDelta: '+0.01', series: ts(3.5, 0) } },
      { label: 'RPM effective', value: '$2.62', unit: '/mi', delta: '-0.02', goal: 'high', hint: 'Actual revenue earned per mile — yours vs the market benchmark, and the gap between them', series: ts(2.62, 2), seriesLabel: 'Mine', compare: { label: 'Market', value: '$2.75', delta: '+0.01', gap: '−$0.13', gapDelta: '−0.03', series: ts(2.75, 2) } },
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

// Money Leakage Breakdown — cálculo de cada categoría (ver doc Notion "Nuevo Dashboard").
// Para que las 5 barras sean disjuntas (sin doble conteo), Missed Fuel Savings NO debe
// incluir el fuel de las desviaciones; ese fuel vive en Empty Miles y Route Deviations.
//
// 1. Missed Fuel Savings  = SUM(ABS(MissedSaving)), MissedSaving = Saving − ActualSaving
//                           (loads con Optimizer_AvgCostRoute > 0 y Deadhead = 0)
// 2. Empty Miles          = cost_reposition_deadhead["total"]  (millas DH desvío × $1.9 + fuel)
// 3. Route Deviations     = cost_route_deviation_excess["total"] (millas Loaded desvío × $1.9 + fuel)
// 4. Idle Time Cost       = SUM(IdleHours) × idle_gph(0.8) × precio_gal (avg_cost_gallon)
//                           Samsara no da galones en idle → se estiman con idle_gph configurable.
// 5. Late Deliveries      = Σ cargas_tarde [ chargeback_fijo + horas_tarde × costo_hora_tarde ]
//                           horas_tarde = llegada_real − cita_dropoff (más allá de una tolerancia)
// "Ignored recommendations" = money you could have saved by following the plan
// we recommended (the old "Planned" concept, now a leakage category of its own).
export const leakBars: LeakBar[] = [
  { name: 'Missed Fuel Savings', pct: 30, amount: '-$7,000', width: 70, color: '#c2453f' },
  { name: 'Empty Miles', pct: 24, amount: '-$5,600', width: 56, color: '#cf5a44' },
  { name: 'Route Deviations', pct: 19, amount: '-$4,400', width: 44, color: '#d56b41' },
  { name: 'Ignored recommendations', pct: 15, amount: '-$3,700', width: 37, color: '#d9843f' },
  { name: 'Idle Time Cost', pct: 12, amount: '-$2,800', width: 28, color: '#d99f42' },
]

// Total money lost across all leakage categories (sum of leakBars), and the
// change in dollars vs the comparison period. Goal is 'low' — less is better.
export const leakTotal = '-$23,500'
export const leakDelta = '-$800'

// Same categories for the comparison period, shown side-by-side in the compare
// view. Widths are 0..100 relative to the same $10k axis as leakBars.
export const leakBarsCompare: LeakBar[] = [
  { name: 'Missed Fuel Savings', pct: 30, amount: '-$7,200', width: 72, color: '#c2453f' },
  { name: 'Empty Miles', pct: 21, amount: '-$5,200', width: 52, color: '#cf5a44' },
  { name: 'Route Deviations', pct: 19, amount: '-$4,700', width: 47, color: '#d56b41' },
  { name: 'Ignored recommendations', pct: 17, amount: '-$4,100', width: 41, color: '#d9843f' },
  { name: 'Idle Time Cost', pct: 13, amount: '-$3,100', width: 31, color: '#d99f42' },
]

// Parse a leak amount string like "-$7,200" into a positive number (7200).
export function leakAmount(s: string): number {
  return Math.abs(Number(s.replace(/[^0-9.-]/g, ''))) || 0
}

export interface RankRow {
  rank: string
  name: string
  issue?: string // what's wrong (bottom) or what's going well (top)
  value: string
  tone: Tone
  you?: boolean
}

// Worst offenders: which trucks are dragging the fleet and why.
export const bottom5: RankRow[] = [
  { rank: '01', name: '#7834', issue: 'Deadhead 31% of miles', value: '-$310/wk', tone: 'red' },
  { rank: '02', name: '#3390', issue: 'Fuel outside corridor', value: '-$280/wk', tone: 'red' },
  { rank: '03', name: '#2210', issue: 'Idle 28 min/day', value: '-$260/wk', tone: 'red' },
  { rank: '04', name: '#5567', issue: 'Late departures', value: '-$190/wk', tone: 'red' },
  { rank: '05', name: '#4521', issue: 'Off-route (I-30)', value: '-$175/wk', tone: 'red' },
]
export const top5: RankRow[] = [
  { rank: '01', name: '#5012', issue: 'Best route adherence', value: '+$465/wk', tone: 'green' },
  { rank: '02', name: '#4408', issue: 'Lowest deadhead', value: '+$390/wk', tone: 'green' },
  { rank: '03', name: '#6120', issue: 'On-corridor fueling', value: '+$355/wk', tone: 'green' },
  { rank: '04', name: '#3301', issue: 'Fewest idle minutes', value: '+$320/wk', tone: 'green' },
  { rank: '05', name: '#2884', issue: 'Top fuel economy', value: '+$300/wk', tone: 'green' },
]
// Market benchmark ranking — where your best truck sits against the market.
export const leaders: RankRow[] = [
  { rank: '01', name: 'Truck X', value: '+$465/mo', tone: 'green' },
  { rank: '02', name: '#4521', value: '+$465/mo', tone: 'green', you: true },
  { rank: '03', name: 'Truck Z', value: '+$450/mo', tone: 'green' },
  { rank: '04', name: 'Truck W', value: '+$440/mo', tone: 'green' },
  { rank: '05', name: 'Truck Y', value: '+$430/mo', tone: 'green' },
]

// What to improve — prioritized actions, ordered by monthly $ upside.
export interface Recommendation {
  rank: number
  action: string
  detail: string
  category: string
  impact: string
}
export const recommendations: Recommendation[] = [
  { rank: 1, action: 'Cut deadhead on ATL → DAL backhauls', detail: 'Truck #7834 running 31% empty', category: 'Efficiency', impact: '+$4.2k/mo' },
  { rank: 2, action: 'Reduce idle at MS hub', detail: 'Trucks #2210, #5567 idling 28 min/day', category: 'Efficiency', impact: '+$2.8k/mo' },
  { rank: 3, action: 'Keep fueling on-corridor', detail: 'Truck #3390 refueling off JAX → NSH', category: 'Fuel', impact: '+$1.5k/mo' },
  { rank: 4, action: 'Lift plan adherence per load', detail: 'Currently 67.8%, below target', category: 'Execution', impact: '+$1.1k/mo' },
  { rank: 5, action: 'Close margin gap on top 5 lanes', detail: '$0.13/mi below market rate', category: 'Market Position', impact: '+$0.9k/mo' },
]

// Plan fixes — how a different plan would have gone better. Together they add
// up to the "Ignored recommendations" leak ($3,700 this period).
export const planFixes: Recommendation[] = [
  { rank: 1, action: 'Assign these loads to lower-cost lanes', detail: '6 loads ran on higher-cost lanes', category: 'Planning', impact: '+$1,400' },
  { rank: 2, action: 'Plan fuel stops on the cheaper corridor', detail: '3 trucks fueled off the best corridor', category: 'Fuel', impact: '+$900' },
  { rank: 3, action: 'Schedule earlier departure windows', detail: '8 departures planned too late', category: 'Planning', impact: '+$800' },
  { rank: 4, action: 'Pair backhauls in the plan', detail: 'Backhauls left unpaired', category: 'Planning', impact: '+$600' },
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
