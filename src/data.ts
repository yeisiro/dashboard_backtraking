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
  // V1 (summary) override: a trimmed detail set shown in the summary view's
  // detail modal. Falls back to `details` when absent.
  detailsSummary?: DetailMetric[]
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
    // V1 drops the standalone "CPG vs optimal" card (it duplicates the gap between
    // actual and optimal), folding that overpay into a Gap row on the actual-vs-optimal
    // card, shown first.
    detailsSummary: [
      { label: 'CPG: actual vs optimal', value: '$3.60', delta: '+0.06', goal: 'low', hint: 'Cost per gallon paid vs best achievable, and the overpay gap between them', series: ts(3.6, 2), seriesLabel: 'Actual', compare: { label: 'Optimal', value: '$3.42', delta: '+0.02', gap: '+$0.18', gapDelta: '+0.04', series: ts(3.42, 0) } },
      { label: 'Diesel cost', value: '$604,411', delta: '+9.1K', goal: 'neutral', hint: 'Total diesel spend vs the share bought on planned routes', series: ts(604411, 3), seriesLabel: 'Total', compare: { label: 'In routes', value: '$427,923', delta: '+6.2K', series: ts(427923, 3) } },
      { label: 'Gallons refueled', value: '142,830', delta: '+1.2K', goal: 'neutral', hint: 'Total gallons refueled in the period', series: ts(142830, 3) },
      { label: 'Fuel missed sav', value: '$25,710', delta: '+820', goal: 'low', hint: 'Savings missed vs optimal fueling', series: ts(25710, 1) },
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
// "Poor Planning" = money lost to suboptimal planning choices — what you could
// have saved by following the plan we recommended (the old "Planned" concept,
// now a leakage category of its own). Named for the cause, not the fix.
export const leakBars: LeakBar[] = [
  { name: 'Missed Fuel Savings', pct: 30, amount: '-$7,000', width: 70, color: '#c2453f' },
  { name: 'Empty Miles', pct: 24, amount: '-$5,600', width: 56, color: '#cf5a44' },
  { name: 'Route Deviations', pct: 19, amount: '-$4,400', width: 44, color: '#d56b41' },
  { name: 'Poor Planning', pct: 15, amount: '-$3,700', width: 37, color: '#d9843f' },
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
  { name: 'Poor Planning', pct: 17, amount: '-$4,100', width: 41, color: '#d9843f' },
  { name: 'Idle Time Cost', pct: 13, amount: '-$3,100', width: 31, color: '#d99f42' },
]

// Parse a leak amount string like "-$7,200" into a positive number (7200).
export function leakAmount(s: string): number {
  return Math.abs(Number(s.replace(/[^0-9.-]/g, ''))) || 0
}

// The 4 standard causes a row's savings/loss can be attributed to. Every row
// picks one — there's no free-form "issue" text anymore.
export type Cause = 'fuel' | 'empty' | 'deviation' | 'idle'

export const CAUSE_LABEL: Record<Cause, string> = {
  fuel: 'Missed Fuel Savings',
  empty: 'Empty Miles',
  deviation: 'Route Deviations',
  idle: 'Idle Time Cost',
}

// Default text per cause — the wording is fixed; only the metric label
// changes per row. No dollar figure here — the row's own value column
// already shows the cost/savings, so repeating it would be redundant.
// metricLabel arrives pre-formatted (see causeMetricLabel in PotentialRecovery)
// since idle/deviation totals must be scaled to the selected date range first.
export function causeText(cause: Cause, metricLabel: string): string {
  switch (cause) {
    case 'idle':
      return `Idle ${metricLabel}`
    case 'deviation':
      return `${metricLabel} off-route`
    case 'empty':
      return `Deadhead ${metricLabel} of miles`
    case 'fuel':
      // The optimal price is the lowest available — you can only pay at or
      // above it, never under. A small premium (green rows) just means you
      // stayed close to optimal; a large one (red rows) means you didn't.
      return `${metricLabel} over the optimal price`
  }
}

export interface RankRow {
  rank: string
  name: string
  cause?: Cause // one of the 4 standard categories this row is attributed to
  // The cause-specific quantity, same weekly-baseline convention as `weekly`:
  // - idle: minutes/week of idle time (total, scales with the date range)
  // - deviation: miles/week off-route (total, scales with the date range)
  // - empty: % of miles run empty (a ratio — constant across date ranges)
  // - fuel: ¢/gal vs. corridor price (a ratio — constant across date ranges)
  metric?: number
  weekly: number // signed $/week baseline; scaled to the selected date window at render
  tone: Tone
  you?: boolean
}

// Worst offenders: which trucks are dragging the fleet and why.
export const bottom5: RankRow[] = [
  { rank: '01', name: '#7834', cause: 'empty', metric: 31, weekly: -310, tone: 'red' },
  { rank: '02', name: '#3390', cause: 'fuel', metric: 18, weekly: -280, tone: 'red' },
  { rank: '03', name: '#2210', cause: 'idle', metric: 196, weekly: -260, tone: 'red' },
  { rank: '04', name: '#5567', cause: 'deviation', metric: 15, weekly: -190, tone: 'red' },
  { rank: '05', name: '#4521', cause: 'deviation', metric: 22, weekly: -175, tone: 'red' },
]
export const top5: RankRow[] = [
  { rank: '01', name: '#5012', cause: 'deviation', metric: 2, weekly: 465, tone: 'green' },
  { rank: '02', name: '#4408', cause: 'empty', metric: 9, weekly: 390, tone: 'green' },
  { rank: '03', name: '#6120', cause: 'fuel', metric: 3, weekly: 355, tone: 'green' },
  { rank: '04', name: '#3301', cause: 'idle', metric: 28, weekly: 320, tone: 'green' },
  { rank: '05', name: '#2884', cause: 'fuel', metric: 2, weekly: 300, tone: 'green' },
]
// Small-fleet simulation (1–5 trucks): with so few trucks, Bottom and Top end
// up being the same trucks in reverse order — useful to preview the layout.
export const bottomSmall: RankRow[] = [
  { rank: '01', name: '#1201', cause: 'empty', metric: 24, weekly: -210, tone: 'red' },
  { rank: '02', name: '#1188', cause: 'idle', metric: 154, weekly: -160, tone: 'red' },
  { rank: '03', name: '#1150', cause: 'deviation', metric: 8, weekly: -45, tone: 'red' },
]
export const topSmall: RankRow[] = [
  { rank: '01', name: '#1150', cause: 'fuel', metric: 4, weekly: 180, tone: 'green' },
  { rank: '02', name: '#1188', cause: 'deviation', metric: 3, weekly: 90, tone: 'green' },
  { rank: '03', name: '#1201', cause: 'fuel', metric: 2, weekly: 60, tone: 'green' },
]
// Single-truck fleet: no ranking across trucks makes sense, so mirror the
// full-fleet layout (identifier + cause) one level down — name = the load
// this truck ran, cause/metric = why that load lost or gained money.
export const bottomSingle: RankRow[] = [
  { rank: '01', name: 'Load #48213', cause: 'idle', metric: 126, weekly: -70, tone: 'red' },
  { rank: '02', name: 'Load #48207', cause: 'deviation', metric: 12, weekly: -45, tone: 'red' },
  { rank: '03', name: 'Load #48191', cause: 'fuel', metric: 15, weekly: -30, tone: 'red' },
]
export const topSingle: RankRow[] = [
  { rank: '01', name: 'Load #48219', cause: 'deviation', metric: 1, weekly: 120, tone: 'green' },
  { rank: '02', name: 'Load #48213', cause: 'fuel', metric: 3, weekly: 60, tone: 'green' },
  { rank: '03', name: 'Load #48207', cause: 'idle', metric: 14, weekly: 40, tone: 'green' },
]

// Market benchmark ranking — where your best truck sits against the market.
export const leaders: RankRow[] = [
  { rank: '01', name: 'Truck X', weekly: 465, tone: 'green' },
  { rank: '02', name: '#4521', weekly: 465, tone: 'green', you: true },
  { rank: '03', name: 'Truck Z', weekly: 450, tone: 'green' },
  { rank: '04', name: 'Truck W', weekly: 440, tone: 'green' },
  { rank: '05', name: 'Truck Y', weekly: 430, tone: 'green' },
]

// Market benchmark table — how your trips compare to the market. For each
// attribute we show your 3 worst trips, your 3 best trips, the market leaders,
// and the gap your best trips still have to close to reach the leaders.
// `betterHigher` says which direction is good, so the gap can be toned right.
export interface BenchmarkAttr {
  attribute: string
  betterHigher: boolean
  worst: string // avg of your 3 worst trips
  best: string // avg of your 3 best trips
  leaders: string // market leaders
  gap: string // best trips → market leaders
  tip: string // what the metric means, shown on hover
}

export const benchmarkAttrs: BenchmarkAttr[] = [
  { attribute: 'Adherence', betterHigher: true, worst: '63.4%', best: '76.2%', leaders: '80.5%', gap: '+4.3 pp', tip: 'How closely drivers followed the planned route. Higher means fewer unplanned detours and reloads.' },
  { attribute: 'Wasted Rate', betterHigher: false, worst: '11.2%', best: '4.8%', leaders: '4.2%', gap: '−0.6 pp', tip: 'Share of paid miles that produced no revenue. Lower is better.' },
  { attribute: '% Deadhead', betterHigher: false, worst: '23.8%', best: '16.5%', leaders: '14.1%', gap: '−2.4 pp', tip: 'Empty miles run with no load, as a share of total miles. Lower is better.' },
  { attribute: 'RPM Effective', betterHigher: true, worst: '$2.41', best: '$2.77', leaders: '$2.94', gap: '+$0.17', tip: 'Revenue per mile after deadhead — what each mile actually earns.' },
  { attribute: 'MPG', betterHigher: true, worst: '6.05', best: '6.21', leaders: '6.42', gap: '+0.21', tip: 'Average miles per gallon. Higher means lower fuel cost per mile.' },
  { attribute: 'Idle %', betterHigher: false, worst: '18.1%', best: '7.4%', leaders: '5.8%', gap: '−1.6 pp', tip: 'Share of engine hours spent idling. Lower saves fuel and engine wear.' },
]

// Performance drivers — the "why" behind the numbers. Each zone and broker is a
// row with the same columns as the attributes, measured by effective RPM
// ($/mi): your worst 3 trips there, your best 3 trips, the market leaders, and
// the gap left to close. `why` explains the number and shows as a subline.
export interface DriverRow {
  name: string // zone or broker
  why: string // what makes it good or bad
  worst: string // avg RPM of your 3 worst trips
  best: string // avg RPM of your 3 best trips
  leaders: string // market leaders' RPM
  gap: string // best trips → leaders
  verdict: 'win' | 'lose' // is this where your trips win or drag?
  marketAligned: boolean // do the market's best trips also concentrate here?
}

// Sorted best → worst so your winners sit at the top and the drags at the
// bottom. `marketAligned` marks the zones/brokers where the market leaders also
// earn their highest RPM — the ones worth leaning into.
export const zoneDrivers: DriverRow[] = [
  { name: 'ATL ⇄ DAL corridor', why: 'Dense backhauls, almost no deadhead', worst: '$2.58', best: '$3.05', leaders: '$3.20', gap: '+$0.15', verdict: 'win', marketAligned: true },
  { name: 'TX Triangle (DAL–HOU–SAT)', why: 'Short legs, high load density', worst: '$2.44', best: '$2.90', leaders: '$3.02', gap: '+$0.12', verdict: 'win', marketAligned: true },
  { name: 'Mountain West (DEN → SLC)', why: 'Long empty legs on the way back', worst: '$1.86', best: '$2.21', leaders: '$2.64', gap: '+$0.43', verdict: 'lose', marketAligned: false },
  { name: 'FL Panhandle', why: 'Thin backhaul market, low RPM', worst: '$1.79', best: '$2.08', leaders: '$2.42', gap: '+$0.34', verdict: 'lose', marketAligned: false },
]

export const brokerDrivers: DriverRow[] = [
  { name: 'TQL', why: 'Consistent lanes, pays fast', worst: '$2.62', best: '$3.01', leaders: '$3.18', gap: '+$0.17', verdict: 'win', marketAligned: true },
  { name: 'Coyote', why: 'High RPM on reefer loads', worst: '$2.55', best: '$2.98', leaders: '$3.10', gap: '+$0.12', verdict: 'win', marketAligned: true },
  { name: 'Echo Global', why: 'Frequent late reloads, more idle', worst: '$2.01', best: '$2.30', leaders: '$2.66', gap: '+$0.36', verdict: 'lose', marketAligned: false },
  { name: 'Spot market', why: 'Low RPM, detention often unpaid', worst: '$1.74', best: '$2.12', leaders: '$2.58', gap: '+$0.46', verdict: 'lose', marketAligned: false },
]

// One metric shown per plan (income, cost, booking, connectivity, …).
export interface PlanMetric {
  label: string
  value: string
}

// What to improve — prioritized actions, ordered by monthly $ upside.
export interface Recommendation {
  rank: number
  action: string
  detail: string
  category: string
  impact: string
  // Wrong → right framing: what went wrong, and the concrete move to fix it.
  problem?: string
  fix?: string
  // Optional route comparison — the route you ran vs. a better route eFrouting
  // would have planned, each with its own metrics (income, cost, booking, …).
  yourRoute?: string
  betterRoute?: string
  yourMetrics?: PlanMetric[]
  betterMetrics?: PlanMetric[]
}
export const recommendations: Recommendation[] = [
  {
    rank: 1,
    action: 'Cut deadhead on ATL → DAL backhauls',
    detail: 'Truck #7834 running 31% empty',
    category: 'Efficiency',
    impact: '+$4.2k/mo',
    problem: 'Truck #7834 ran 31% of its miles empty on ATL → DAL backhauls.',
    fix: 'Book a paired backhaul out of DAL so the return leg carries a load.',
  },
  {
    rank: 2,
    action: 'Reduce idle at MS hub',
    detail: 'Trucks #2210, #5567 idling 28 min/day',
    category: 'Efficiency',
    impact: '+$2.8k/mo',
    problem: 'Trucks #2210 and #5567 idled 28 min/day waiting at the MS hub.',
    fix: 'Stagger dock appointments so trucks arrive to an open door, not a queue.',
  },
  {
    rank: 3,
    action: 'Keep fueling on-corridor',
    detail: 'Truck #3390 refueling off JAX → NSH',
    category: 'Fuel',
    impact: '+$1.5k/mo',
    problem: 'Truck #3390 refueled off the JAX → NSH corridor at retail pumps.',
    fix: 'Route fuel stops onto on-corridor network pumps (~$0.30/gal cheaper).',
  },
  {
    rank: 4,
    action: 'Lift plan adherence per load',
    detail: 'Currently 67.8%, below target',
    category: 'Execution',
    impact: '+$1.1k/mo',
    problem: 'Plan adherence is 67.8%, below the 80% target.',
    fix: 'Coach drivers to follow the dispatched plan and flag deviations early.',
  },
  {
    rank: 5,
    action: 'Close margin gap on top 5 lanes',
    detail: '$0.13/mi below market rate',
    category: 'Market Position',
    impact: '+$0.9k/mo',
    problem: 'Your top 5 lanes bill $0.13/mi below the market rate.',
    fix: 'Renegotiate those lane rates or shift volume to higher-RPM brokers.',
  },
]

// Plan fixes — how a different plan would have gone better. Together they add
// up to the "Poor Planning" leak ($3,700 this period).
export const planFixes: Recommendation[] = [
  {
    rank: 1,
    action: 'Assign these loads to lower-cost lanes',
    detail: '6 loads ran on higher-cost lanes',
    category: 'Planning',
    impact: '+$1,400',
    yourRoute: 'Los Angeles, CA → Miami, FL',
    betterRoute: 'Los Angeles, CA → Dallas, TX → Miami, FL',
    yourMetrics: [
      { label: 'Income', value: '$10,600' },
      { label: 'Cost', value: '$8,200' },
      { label: 'Booking', value: '62%' },
      { label: 'Connectivity', value: '48%' },
    ],
    betterMetrics: [
      { label: 'Income', value: '$10,600' },
      { label: 'Cost', value: '$6,800' },
      { label: 'Booking', value: '88%' },
      { label: 'Connectivity', value: '91%' },
    ],
  },
  {
    rank: 2,
    action: 'Plan fuel stops into the route',
    detail: '3 trucks fueled off the planned corridor',
    category: 'Planning',
    impact: '+$900',
    yourRoute: 'Jacksonville, FL → Nashville, TN',
    betterRoute: 'Jacksonville, FL → Atlanta, GA → Nashville, TN',
    yourMetrics: [
      { label: 'Income', value: '$5,700' },
      { label: 'Cost', value: '$4,300' },
      { label: 'Booking', value: '55%' },
      { label: 'Connectivity', value: '40%' },
    ],
    betterMetrics: [
      { label: 'Income', value: '$5,700' },
      { label: 'Cost', value: '$3,400' },
      { label: 'Booking', value: '84%' },
      { label: 'Connectivity', value: '86%' },
    ],
  },
  {
    rank: 3,
    action: 'Schedule earlier departure windows',
    detail: '8 departures planned too late',
    category: 'Planning',
    impact: '+$800',
    yourRoute: 'Chicago, IL → Atlanta, GA',
    betterRoute: 'Chicago, IL → Nashville, TN → Atlanta, GA',
    yourMetrics: [
      { label: 'Income', value: '$7,200' },
      { label: 'Cost', value: '$5,600' },
      { label: 'Booking', value: '60%' },
      { label: 'Connectivity', value: '52%' },
    ],
    betterMetrics: [
      { label: 'Income', value: '$7,200' },
      { label: 'Cost', value: '$4,800' },
      { label: 'Booking', value: '82%' },
      { label: 'Connectivity', value: '88%' },
    ],
  },
  {
    rank: 4,
    action: 'Pair backhauls in the plan',
    detail: 'Backhauls left unpaired',
    category: 'Planning',
    impact: '+$600',
    yourRoute: 'Atlanta, GA → Dallas, TX',
    betterRoute: 'Atlanta, GA → Dallas, TX → Atlanta, GA',
    yourMetrics: [
      { label: 'Income', value: '$5,100' },
      { label: 'Cost', value: '$3,900' },
      { label: 'Booking', value: '58%' },
      { label: 'Connectivity', value: '45%' },
    ],
    betterMetrics: [
      { label: 'Income', value: '$5,100' },
      { label: 'Cost', value: '$3,300' },
      { label: 'Booking', value: '90%' },
      { label: 'Connectivity', value: '93%' },
    ],
  },
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

// Full Data → Trips table. One row per completed trip. Values are numeric so the
// table can sort exactly and format at render. Several fields are derived from a
// smaller base (see TRIP_BASE + buildTrip) to keep the data honest and compact.
export interface TripRow {
  // Weighted 0..100 quality score — the composite that ranks trips and drives
  // the best/worst classification (see computeScores).
  score: number
  truck: string
  cls: 'A' | 'B' | 'C' | 'D'
  startDate: string // pickup
  endDate: string // delivery
  lane: string
  band?: 'best' | 'worst'
  // V1 only models trips that already happened — the post-delivery paperwork
  // lifecycle (Delivered → Invoiced/Posted → Paid). Pre-delivery statuses
  // (Booked/Dispatched, Picked up, In Transit) and TONU aren't tracked yet.
  status: 'delivered' | 'invoiced' | 'paid'
  // Revenue
  income: number
  negotiatedRpm: number
  executedRpm: number
  effectiveRpm: number
  wastedRpmPct: number
  // Cost & savings
  cost: number
  totalCost: number
  optimalCost: number
  totalExcessCost: number
  excessMilesCost: number
  missedFuelSavings: number // negative
  actualSaving: number // positive
  profit: number
  // Distance
  totalMiles: number
  loadedMiles: number
  dhMilesPct: number
  deadheadPct: number
  // Efficiency
  effectiveHours: number
  idleHours: number
  idlePct: number
  mpg: number
  adherence: number // %
  planAdherence: number // %
  wastedRate: number // %
}

interface TripBase {
  truck: string
  cls: TripRow['cls']
  startDate: string
  endDate: string
  lane: string
  band?: 'best' | 'worst'
  status?: TripRow['status']
  income: number
  negotiatedRpm: number
  executedRpm: number
  effectiveRpm: number
  cost: number
  optimalCost: number
  totalMiles: number
  loadedMiles: number
  effectiveHours: number
  idleHours: number
  mpg: number
  missedFuelSavings: number
  actualSaving: number
  adherence: number
  planAdherence: number
  wastedRate: number
}

const round1 = (n: number) => Math.round(n * 10) / 10

function buildTrip(b: TripBase): TripRow {
  const dhPct = round1(((b.totalMiles - b.loadedMiles) / b.totalMiles) * 100)
  const totalCost = Math.round(b.cost * 1.08)
  const totalExcessCost = totalCost - b.optimalCost
  return {
    ...b,
    score: 0, // filled in by computeScores once the full set is known
    status: b.status ?? 'delivered',
    profit: b.income - b.cost,
    wastedRpmPct: round1(((b.negotiatedRpm - b.effectiveRpm) / b.negotiatedRpm) * 100),
    totalCost,
    totalExcessCost,
    excessMilesCost: Math.round(totalExcessCost * 0.6),
    dhMilesPct: dhPct,
    deadheadPct: dhPct,
    idlePct: round1((b.idleHours / (b.effectiveHours + b.idleHours)) * 100),
  }
}

// Weighted quality score (0..100). Each driver is min-max normalized across the
// set, then combined by weight. "Lower is better" metrics are inverted so a
// higher score always means a better trip. The score then decides best/worst.
function computeScores(rows: TripRow[]): TripRow[] {
  const norm = (get: (r: TripRow) => number, invert = false) => {
    const vals = rows.map(get)
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    return (r: TripRow) => {
      const t = max === min ? 0.5 : (get(r) - min) / (max - min)
      return invert ? 1 - t : t
    }
  }
  const margin = norm((r) => (r.income ? r.profit / r.income : 0))
  const adherence = norm((r) => r.adherence)
  const rpm = norm((r) => r.effectiveRpm)
  const wasted = norm((r) => r.wastedRate, true)
  const deadhead = norm((r) => r.deadheadPct, true)
  const idle = norm((r) => r.idlePct, true)
  const mpg = norm((r) => r.mpg)

  rows.forEach((r) => {
    const s =
      margin(r) * 0.25 +
      adherence(r) * 0.2 +
      rpm(r) * 0.2 +
      wasted(r) * 0.15 +
      deadhead(r) * 0.1 +
      idle(r) * 0.05 +
      mpg(r) * 0.05
    r.score = Math.round(s * 100)
  })

  // Classify by score: top third = best, bottom third = worst.
  const ranked = [...rows].sort((a, b) => b.score - a.score)
  const cut = Math.max(1, Math.round(ranked.length / 3))
  const best = new Set(ranked.slice(0, cut))
  const worst = new Set(ranked.slice(-cut))
  rows.forEach((r) => {
    r.band = best.has(r) ? 'best' : worst.has(r) ? 'worst' : undefined
  })
  return rows
}

const TRIP_BASE: TripBase[] = [
  { truck: '#5007', cls: 'A', startDate: 'May 14', endDate: 'May 15', lane: 'Atlanta, GA → Orlando, FL', band: 'best', status: 'delivered', income: 1180, negotiatedRpm: 3.02, executedRpm: 2.88, effectiveRpm: 2.72, cost: 480, optimalCost: 440, totalMiles: 415, loadedMiles: 372, effectiveHours: 9.4, idleHours: 0.5, mpg: 6.5, missedFuelSavings: -30, actualSaving: 720, adherence: 94.2, planAdherence: 90.1, wastedRate: 3.8 },
  { truck: '#5012', cls: 'A', startDate: 'May 14', endDate: 'May 14', lane: 'Dallas, TX → Houston, TX', band: 'best', status: 'delivered', income: 690, negotiatedRpm: 2.95, executedRpm: 2.82, effectiveRpm: 2.68, cost: 300, optimalCost: 280, totalMiles: 239, loadedMiles: 220, effectiveHours: 5.1, idleHours: 0.3, mpg: 6.6, missedFuelSavings: -18, actualSaving: 540, adherence: 92.8, planAdherence: 89.0, wastedRate: 4.1 },
  { truck: '#4408', cls: 'B', startDate: 'May 13', endDate: 'May 13', lane: 'Chicago, IL → Indianapolis, IN', band: 'best', status: 'invoiced', income: 540, negotiatedRpm: 2.90, executedRpm: 2.78, effectiveRpm: 2.64, cost: 250, optimalCost: 232, totalMiles: 182, loadedMiles: 168, effectiveHours: 3.9, idleHours: 0.2, mpg: 6.5, missedFuelSavings: -22, actualSaving: 480, adherence: 90.1, planAdherence: 87.2, wastedRate: 4.4 },
  { truck: '#6120', cls: 'B', startDate: 'May 13', endDate: 'May 13', lane: 'Memphis, TN → Nashville, TN', status: 'invoiced', income: 620, negotiatedRpm: 2.75, executedRpm: 2.60, effectiveRpm: 2.45, cost: 300, optimalCost: 270, totalMiles: 210, loadedMiles: 182, effectiveHours: 4.6, idleHours: 0.7, mpg: 6.2, missedFuelSavings: -35, actualSaving: 450, adherence: 84.6, planAdherence: 80.3, wastedRate: 5.6 },
  { truck: '#3301', cls: 'C', startDate: 'May 12', endDate: 'May 12', lane: 'Kansas City, MO → St. Louis, MO', status: 'paid', income: 710, negotiatedRpm: 2.68, executedRpm: 2.52, effectiveRpm: 2.38, cost: 360, optimalCost: 320, totalMiles: 248, loadedMiles: 210, effectiveHours: 5.4, idleHours: 1.1, mpg: 6.0, missedFuelSavings: -60, actualSaving: 410, adherence: 81.5, planAdherence: 76.8, wastedRate: 6.4 },
  { truck: '#2884', cls: 'C', startDate: 'May 12', endDate: 'May 12', lane: 'Charlotte, NC → Atlanta, GA', status: 'paid', income: 700, negotiatedRpm: 2.55, executedRpm: 2.40, effectiveRpm: 2.28, cost: 370, optimalCost: 330, totalMiles: 245, loadedMiles: 205, effectiveHours: 5.6, idleHours: 1.3, mpg: 5.9, missedFuelSavings: -70, actualSaving: 380, adherence: 79.2, planAdherence: 74.1, wastedRate: 7.1 },
  { truck: '#7834', cls: 'D', startDate: 'May 11', endDate: 'May 12', lane: 'Atlanta, GA → Dallas, TX', band: 'worst', status: 'paid', income: 2240, negotiatedRpm: 2.30, executedRpm: 2.05, effectiveRpm: 1.79, cost: 1500, optimalCost: 1200, totalMiles: 781, loadedMiles: 540, effectiveHours: 15.8, idleHours: 3.9, mpg: 5.4, missedFuelSavings: -310, actualSaving: 180, adherence: 63.4, planAdherence: 58.2, wastedRate: 11.2 },
  { truck: '#3390', cls: 'D', startDate: 'May 11', endDate: 'May 12', lane: 'Jacksonville, FL → Nashville, TN', band: 'worst', status: 'paid', income: 1360, negotiatedRpm: 2.42, executedRpm: 2.18, effectiveRpm: 1.95, cost: 900, optimalCost: 720, totalMiles: 476, loadedMiles: 330, effectiveHours: 9.9, idleHours: 2.6, mpg: 5.6, missedFuelSavings: -280, actualSaving: 150, adherence: 66.1, planAdherence: 60.5, wastedRate: 9.8 },
  { truck: '#2210', cls: 'D', startDate: 'May 11', endDate: 'May 13', lane: 'Miami, FL → Houston, TX', band: 'worst', status: 'invoiced', income: 3410, negotiatedRpm: 2.33, executedRpm: 2.10, effectiveRpm: 1.88, cost: 2300, optimalCost: 1900, totalMiles: 1188, loadedMiles: 820, effectiveHours: 23.5, idleHours: 5.2, mpg: 5.5, missedFuelSavings: -260, actualSaving: 210, adherence: 68.9, planAdherence: 62.0, wastedRate: 8.9 },
]

export const tripRows: TripRow[] = computeScores(TRIP_BASE.map(buildTrip))

// Cost breakdown segments (share of total lane cost), sorted largest first.
// Static across trips — only the $ amount they're multiplied against changes.
// Colors are categorical (each segment is a distinct, independently actionable
// cause, not gradations of one thing) and reuse the app's existing accent
// hues so the same category reads the same color everywhere it appears.
export const costSegments = [
  { label: 'Efficient Miles', pct: 79.9, color: 'var(--green)' },
  { label: 'Loaded Deviation Excess', pct: 13, color: 'var(--red)' },
  { label: 'Reposition deadhead', pct: 3.34, color: 'var(--yellow)' },
  { label: 'PC while loaded', pct: 3.29, color: 'var(--blue)' },
  { label: 'Operative center return', pct: 0.261, color: '#7CC8CF' },
  { label: 'PC while unloaded', pct: 0.0973, color: 'var(--orange)' },
  { label: 'Deadhead Deviation Excess', pct: 0.0893, color: '#8a94a6' },
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
