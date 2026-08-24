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
  // Clear, operator-facing explanation of what the metric is (V2 tooltip).
  tip?: string
  // Metrics where 0 is the ideal and any distance from it is a penalty
  // (e.g. cents/gal over the optimal price). Drives the "distance from optimal"
  // scale on the KPI card. `value`/`max` are numeric magnitudes of the overpay.
  penalty?: { value: number; max: number; unit: string }
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
        tip: 'Of every $1 you bill, this is what is left as profit after fuel, driver pay, and all other operating costs. Higher is better.',
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
        tip: 'The revenue you should have earned but lost to inefficiency — empty miles, idling, detours and fuel overpay — as a share of expected revenue. Lower is better.',
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
        tip: 'Share of trips that ran the way they were dispatched — same route, stops and schedule. Higher means fewer unplanned detours, reloads and delays.',
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
        tip: 'How much more than the best achievable price you paid per gallon. $0.00 is optimal — every cent above it is money left on the table across every gallon burned.',
        penalty: { value: 0.18, max: 0.6, unit: '$/gal' },
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
// Execution-side leakage comes first (fuel, deadhead, route, idle, operative
// moves) and "Poor Planning" sits last on its own — it's the only category
// that's purely a planning miss, not an execution one. "Operative
// Inefficiencies" is the cost of the deadhead miles run on operative trips
// (empty repositioning moves not tied to a load), counted as an inefficiency.
export const leakBars: LeakBar[] = [
  { name: 'Missed Fuel Savings', pct: 28, amount: '-$7,000', width: 70, color: '#c2453f' },
  { name: 'Empty Miles', pct: 22, amount: '-$5,600', width: 56, color: '#cf5a44' },
  { name: 'Route Deviations', pct: 18, amount: '-$4,400', width: 44, color: '#d56b41' },
  { name: 'Idle Time Cost', pct: 11, amount: '-$2,800', width: 28, color: '#d99f42' },
  { name: 'Operative Inefficiencies', pct: 6, amount: '-$1,400', width: 14, color: '#cbb15a' },
  { name: 'Poor Planning', pct: 15, amount: '-$3,700', width: 37, color: '#d9843f' },
]

// Total money lost across all leakage categories (sum of leakBars), and the
// change in dollars vs the comparison period. Goal is 'low' — less is better.
export const leakTotal = '-$24,900'
export const leakDelta = '-$800'

// Same categories for the comparison period, shown side-by-side in the compare
// view. Widths are 0..100 relative to the same $10k axis as leakBars.
export const leakBarsCompare: LeakBar[] = [
  { name: 'Missed Fuel Savings', pct: 28, amount: '-$7,200', width: 72, color: '#c2453f' },
  { name: 'Empty Miles', pct: 20, amount: '-$5,200', width: 52, color: '#cf5a44' },
  { name: 'Route Deviations', pct: 18, amount: '-$4,700', width: 47, color: '#d56b41' },
  { name: 'Idle Time Cost', pct: 12, amount: '-$3,100', width: 31, color: '#d99f42' },
  { name: 'Operative Inefficiencies', pct: 5, amount: '-$1,300', width: 13, color: '#cbb15a' },
  { name: 'Poor Planning', pct: 17, amount: '-$4,100', width: 41, color: '#d9843f' },
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
      return `Idle ${metricLabel} of hours`
    case 'deviation':
      return `Off-route ${metricLabel} of miles`
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
  // The cause-specific quantity — all ratios now, so magnitude is comparable at
  // a glance and none of them scale with the date range:
  // - idle: % of engine hours spent idling
  // - deviation: % of miles driven off-route (excess vs the optimal plan)
  // - empty: % of miles run empty (deadhead)
  // - fuel: ¢/gal vs. corridor price (rendered as $/gal)
  metric?: number
  weekly: number // signed $/week baseline; scaled to the selected date window at render
  tone: Tone
  you?: boolean
}

// Worst offenders: which trucks are dragging the fleet and why. First 5 are
// fixed; the rest are generated so the count selector (5/10/15) has depth.
const WORST_CAUSES: Cause[] = ['empty', 'fuel', 'idle', 'deviation']
// All percentages now (except fuel, kept in ¢/gal). Worst trucks run high.
const worstMetric = (cause: Cause, i: number): number => {
  if (cause === 'idle') return Math.max(14, 26 - i) // % of hours idling
  if (cause === 'deviation') return 8 + (i % 7) // % of miles off-route
  if (cause === 'empty') return Math.max(9, 30 - i) // % deadhead
  return Math.max(4, 17 - Math.floor(i / 2)) // ¢/gal over optimal
}
export const bottom5: RankRow[] = [
  { rank: '01', name: '#7834', cause: 'empty', metric: 31, weekly: -310, tone: 'red' },
  { rank: '02', name: '#3390', cause: 'fuel', metric: 18, weekly: -280, tone: 'red' },
  { rank: '03', name: '#2210', cause: 'idle', metric: 24, weekly: -260, tone: 'red' },
  { rank: '04', name: '#5567', cause: 'deviation', metric: 12, weekly: -190, tone: 'red' },
  { rank: '05', name: '#4521', cause: 'deviation', metric: 15, weekly: -175, tone: 'red' },
  ...Array.from({ length: 10 }, (_, k) => {
    const i = k + 5
    const cause = WORST_CAUSES[i % 4]
    return {
      rank: String(i + 1).padStart(2, '0'),
      name: '#' + (6100 + k * 143),
      cause,
      metric: worstMetric(cause, i),
      weekly: -(165 - k * 12),
      tone: 'red' as Tone,
    }
  }),
]
export const top5: RankRow[] = [
  { rank: '01', name: '#5012', cause: 'deviation', metric: 2, weekly: 465, tone: 'green' },
  { rank: '02', name: '#4408', cause: 'empty', metric: 9, weekly: 390, tone: 'green' },
  { rank: '03', name: '#6120', cause: 'fuel', metric: 3, weekly: 355, tone: 'green' },
  { rank: '04', name: '#3301', cause: 'idle', metric: 6, weekly: 320, tone: 'green' },
  { rank: '05', name: '#2884', cause: 'fuel', metric: 2, weekly: 300, tone: 'green' },
  // Best trucks run low on every ratio.
  ...Array.from({ length: 10 }, (_, k) => {
    const i = k + 5
    const cause = WORST_CAUSES[(i + 2) % 4]
    return {
      rank: String(i + 1).padStart(2, '0'),
      name: '#' + (5100 + k * 131),
      cause,
      metric: cause === 'idle' ? 4 + (k % 5) : cause === 'deviation' ? 1 + (k % 3) : cause === 'empty' ? 6 + k : 2 + k,
      weekly: 290 - k * 14,
      tone: 'green' as Tone,
    }
  }),
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
  ...Array.from({ length: 10 }, (_, k) => ({
    rank: String(k + 6).padStart(2, '0'),
    name: 'Truck ' + String.fromCharCode(65 + k), // Truck A, B, ...
    weekly: 425 - k * 11,
    tone: 'green' as Tone,
  })),
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
  { attribute: 'MPG', betterHigher: true, worst: '6.05', best: '6.42', leaders: '6.42', gap: '0.00', tip: 'Average miles per gallon. Higher means lower fuel cost per mile.' },
  { attribute: 'CPG vs optimal', betterHigher: false, worst: '+$0.31/gal', best: '$0.00/gal', leaders: '$0.00/gal', gap: '$0.00/gal', tip: 'How much over the best achievable price the fleet paid per gallon. Market leaders fuel at the optimal price, so their gap is $0.' },
  { attribute: 'Idle %', betterHigher: false, worst: '18.1%', best: '7.4%', leaders: '5.8%', gap: '−1.6 pp', tip: 'Share of engine hours spent idling. Lower saves fuel and engine wear.' },
]

// Cost of NOT being a market leader, grouped by cost driver (not per metric).
// Seven attributes collapse into four dollar figures per trip group, because
// several metrics share one underlying cost:
//  - Adherence            → money lost to Route + Deadhead deviations + Missed Fuel.
//  - Wasted Rate/% Deadhead/RPM Effective → ONE profit-lost figure (profit the
//    group made minus profit at the leaders' deadhead share).
//  - MPG/CPG vs optimal   → ONE missed-fuel-savings figure.
//  - Idle %               → idle cost above the leader idle share.
// `attributes` are the metric rows the group's cost cell spans (in table order).
// `inTotal` is false for Adherence — its dollars overlap the other groups
// (route/deadhead/fuel), so the total sums the other three to count each loss once.
export interface BenchmarkCostGroup {
  attributes: string[]
  costWorst: number
  costBest: number
  caption?: string // shown inside the cost cell (multi-row groups)
  nameCaption?: string // shown under the attribute name (single-row groups)
  inTotal: boolean
}
export const benchmarkCostGroups: BenchmarkCostGroup[] = [
  { attributes: ['Adherence'], costWorst: 6400, costBest: 2200, nameCaption: 'Route + deadhead deviations, missed fuel', inTotal: false },
  { attributes: ['Wasted Rate', '% Deadhead', 'RPM Effective'], costWorst: 8200, costBest: 2400, caption: 'Profit lost across rate, deadhead and RPM', inTotal: true },
  { attributes: ['MPG', 'CPG vs optimal'], costWorst: 2600, costBest: 0, caption: 'Missed fuel savings across MPG and price', inTotal: true },
  { attributes: ['Idle %'], costWorst: 2000, costBest: 200, nameCaption: 'Idle cost above the leader idle share', inTotal: true },
]
// Total cost of not being a leader — sum of the groups that count (Adherence
// excluded to avoid double-counting its overlap with the others).
export const benchmarkGapTotal = benchmarkCostGroups
  .filter((g) => g.inTotal)
  .reduce(
    (acc, g) => ({ worst: acc.worst + g.costWorst, best: acc.best + g.costBest }),
    { worst: 0, best: 0 },
  )

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
  cls: 'A' | 'B' | 'C' | 'D'
  driver: string // driver running this load
  loadRef: string // load id of the trip currently being executed
  alert: string
  alertTone: Tone
  route: string
  leakLabel: string
  leakValue: string
  leakTone: Tone
}

const FLEET_CLASSES: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D']

// Driver roster — the people behind the loads. Shared everywhere a load shows a
// truck, and by the drivers filter + connect/manage flows. `driverForIndex`
// gives every trip a stable driver.
export const DRIVER_POOL: Array<{ id: string; name: string }> = [
  'Marcus Alvarez', 'Jaylen Okafor', 'Diego Herrera', 'Tanner Wolfe', 'Priya Nair',
  'Sofia Castillo', 'Andre Boone', 'Wei Zhang', 'Cody Beckett', 'Luis Fuentes',
  'Grace Mensah', 'Owen Brady', 'Rashida Ali', 'Marco Ferraro', 'Dylan Pope',
  'Hana Suzuki', 'Terrell Grant', 'Ivan Petrov', 'Noah Kessler', 'Camila Rojas',
  'Bryce Sullivan', 'Omar Haddad', 'Nina Volkov', 'Caleb Ndiaye',
].map((name, i) => ({ id: 'DRV-' + (1040 + i * 7), name }))

export const driverForIndex = (i: number) => DRIVER_POOL[i % DRIVER_POOL.length].name

const ACTIVE_ROUTES = [
  'ATL → DAL', 'JAX → NSH', 'MIA → HOU', 'CHI → ATL', 'CHI → MEM',
  'LAX → PHX', 'SEA → PDX', 'DEN → SLC', 'KC → STL', 'CLT → JAX',
  'DAL → HOU', 'IND → CHI', 'NSH → MEM', 'ORL → MIA', 'PHX → LAX',
  'SLC → DEN', 'STL → KC', 'PDX → SEA', 'HOU → DAL', 'MEM → NSH',
]
const ACTIVE_ALERTS: Array<{ a: string; t: Tone }> = [
  { a: 'Off-route now (I-30)', t: 'orange' },
  { a: 'Fuel outside corridor', t: 'orange' },
  { a: 'Idle 28 min · MS hub', t: 'yellow' },
  { a: 'HOS limit approaching', t: 'yellow' },
  { a: 'Detour · weather hold', t: 'yellow' },
  { a: 'Hard brake event', t: 'orange' },
  { a: 'no current alert', t: 'gray' },
]

// 32 active trips — a realistic board. Generated deterministically off the
// index so the list is stable across reloads.
export const trips: Trip[] = Array.from({ length: 32 }, (_, i) => {
  const alert = ACTIVE_ALERTS[i % ACTIVE_ALERTS.length]
  const noLeak = alert.t === 'gray' && i % 3 === 0
  const leak = 120 + ((i * 37) % 420)
  return {
    id: '#' + (4000 + i * 13),
    cls: FLEET_CLASSES[i % 4],
    driver: driverForIndex(i),
    loadRef: String(300000 + i * 40993).slice(-7).padStart(7, '0'),
    alert: alert.a,
    alertTone: alert.t,
    route: ACTIVE_ROUTES[i % ACTIVE_ROUTES.length],
    leakLabel: noLeak ? '' : 'Leak wk:',
    leakValue: noLeak ? 'no leak yet' : '-$' + leak,
    leakTone: noLeak ? 'gray' : 'red',
  }
})

// Live Operation Monitoring → Inactive tab (V2 only). Trucks with no load
// assigned. `unassignedDays` (days since a load was last assigned) is the
// source of truth — it drives the displayed metric, the severity tone, and the
// sort order (see LiveOperations), so a single number stays consistent.
export interface InactiveTruck {
  id: string
  cls: 'A' | 'B' | 'C' | 'D'
  location: string // where it's parked right now
  unassignedDays: number // days since a load was last assigned to this truck
}

const INACTIVE_LOCATIONS = [
  'El Paso, TX', 'Laredo, TX yard', 'Fresno, CA', 'Memphis, TN hub', 'Savannah, GA',
  'Kansas City, MO', 'Dallas, TX yard', 'Charlotte, NC', 'Columbus, OH', 'Reno, NV',
  'Tucson, AZ', 'Boise, ID', 'Omaha, NE', 'Little Rock, AR', 'Toledo, OH',
  'Fargo, ND', 'Mobile, AL', 'Spokane, WA', 'Amarillo, TX', 'Macon, GA',
]

// 20 idle cabins with no load assigned. `unassignedDays` spreads across a
// realistic range so the sort has something to chew on.
export const inactiveTrucks: InactiveTruck[] = Array.from({ length: 20 }, (_, i) => ({
  id: '#' + (1000 + i * 137),
  cls: FLEET_CLASSES[i % 4],
  location: INACTIVE_LOCATIONS[i % INACTIVE_LOCATIONS.length],
  unassignedDays: 1 + ((i * 11) % 39),
}))

// ── Fleet connect / manage ────────────────────────────────────────────────
// Sync windows offered when linking cabins, and the pool of cabins we
// "discover" across a connected TMS + ELD. Shared by the connect wizard and
// the manage-fleet view.
export const SYNC_PERIODS = [
  { key: '1m', label: '1 month', months: 1 },
  { key: '3m', label: '3 months', months: 3 },
  { key: '6m', label: '6 months', months: 6 },
  { key: '1y', label: '1 year', months: 12 },
] as const
export type PeriodKey = (typeof SYNC_PERIODS)[number]['key']
export const monthsForPeriod = (key: PeriodKey) => SYNC_PERIODS.find((p) => p.key === key)?.months ?? 3
export const labelForPeriod = (key: PeriodKey) => SYNC_PERIODS.find((p) => p.key === key)?.label ?? key

export const CABIN_POOL: string[] = [
  '4', '7003', '2077', '7001', '7002',
  ...Array.from({ length: 82 }, (_, i) => String(1000 + i * 17)),
]

// A cabin the operator has linked, with the date window already synced for it
// (drives the "Synced Feb 5 – Aug 5" readout and the on-demand re-sync).
export interface FleetCabin {
  id: string
  syncedFrom: Date // oldest date synced
  syncedTo: Date // newest date synced
}

// A driver the operator has linked. Drivers carry no sync window — linking just
// adds them to the DB.
export interface FleetDriver {
  id: string
  name: string
}

// Integration providers, shared by the connect wizard and the manage
// Integrations tab. `fields` are the credentials each one asks for.
export interface IntegrationField {
  key: string
  label: string
  placeholder: string
  secret?: boolean
  // Live preview of what the field's value builds into, e.g. the full API URL.
  // `{v}` is replaced with the current input (or a bracketed hint when empty).
  hintTemplate?: string
}
export interface Provider {
  name: string
  mono: string
  fields: IntegrationField[]
}
export const ELD_PROVIDERS: Provider[] = [
  { name: 'Samsara', mono: 'Sa', fields: [{ key: 'apikey', label: 'API key', placeholder: 'Enter the API key', secret: true }] },
  {
    name: 'Geotab',
    mono: 'Ge',
    fields: [
      { key: 'user', label: 'User', placeholder: 'Enter the User', secret: true },
      { key: 'database', label: 'Database', placeholder: 'Enter the Database' },
      { key: 'password', label: 'Password', placeholder: 'Enter the Password', secret: true },
    ],
  },
  { name: 'Motive', mono: 'Mo', fields: [{ key: 'apikey', label: 'API key', placeholder: 'Enter the API key', secret: true }] },
]
export const TMS_PROVIDERS: Provider[] = [
  {
    name: 'Datatruck',
    mono: 'Da',
    // Datatruck: the operator gives us the API token and their assigned company
    // subdomain — we build the full endpoint from the subdomain internally. The
    // hint shows exactly how their API URL ends up, so it's clear the subdomain
    // is the company Datatruck assigned them, not an arbitrary name.
    fields: [
      { key: 'token', label: 'API token', placeholder: 'Enter the API token', secret: true },
      {
        key: 'subdomain',
        label: 'Company subdomain',
        placeholder: 'your-company',
        hintTemplate: 'https://{v}.datatruck.io/api/v1/openapi',
      },
    ],
  },
  { name: 'Alvys', mono: 'Al', fields: [{ key: 'apikey', label: 'API key', placeholder: 'Enter the API key', secret: true }] },
  { name: 'McLeod LoadMaster', mono: 'Mc', fields: [{ key: 'apikey', label: 'API key', placeholder: 'Enter the API key', secret: true }] },
  { name: 'Trimble TMW Suite', mono: 'Tr', fields: [{ key: 'apikey', label: 'API key', placeholder: 'Enter the API key', secret: true }] },
  { name: 'MercuryGate', mono: 'MG', fields: [{ key: 'apikey', label: 'API key', placeholder: 'Enter the API key', secret: true }] },
  { name: 'Project44', mono: 'P4', fields: [{ key: 'apikey', label: 'API key', placeholder: 'Enter the API key', secret: true }] },
]

// A connected integration, tracked in App so the Manage → Integrations tab can
// list and manage them after the wizard finishes.
export interface Integration {
  type: 'eld' | 'tms'
  name: string
  mono: string
}

// Full Data → Trips table. One row per completed trip. Values are numeric so the
// table can sort exactly and format at render. Several fields are derived from a
// smaller base (see TRIP_BASE + buildTrip) to keep the data honest and compact.
export interface TripRow {
  // Weighted 0..100 quality score — the composite that ranks trips and drives
  // the best/worst classification (see computeScores).
  score: number
  truck: string
  driver: string // driver who ran the load
  cls: 'A' | 'B' | 'C' | 'D'
  startDate: string // pickup
  endDate: string // delivery
  lane: string
  loadRef: string // load reference id, e.g. "L40012007"
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

function buildTrip(b: TripBase, index: number): TripRow {
  const dhPct = round1(((b.totalMiles - b.loadedMiles) / b.totalMiles) * 100)
  const totalCost = Math.round(b.cost * 1.08)
  const totalExcessCost = totalCost - b.optimalCost
  return {
    ...b,
    score: 0, // filled in by computeScores once the full set is known
    driver: driverForIndex(index),
    loadRef: 'L' + (40012001 + index),
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
  { truck: '#1180', cls: 'A', startDate: 'May 10', endDate: 'May 11', lane: 'Los Angeles, CA → Phoenix, AZ', status: 'delivered', income: 1450, negotiatedRpm: 2.98, executedRpm: 2.85, effectiveRpm: 2.70, cost: 620, optimalCost: 580, totalMiles: 505, loadedMiles: 460, effectiveHours: 10.8, idleHours: 0.4, mpg: 6.4, missedFuelSavings: -28, actualSaving: 640, adherence: 93.0, planAdherence: 89.5, wastedRate: 4.0 },
  { truck: '#8823', cls: 'B', startDate: 'May 10', endDate: 'May 10', lane: 'Phoenix, AZ → Albuquerque, NM', status: 'invoiced', income: 780, negotiatedRpm: 2.80, executedRpm: 2.66, effectiveRpm: 2.50, cost: 340, optimalCost: 310, totalMiles: 260, loadedMiles: 230, effectiveHours: 5.5, idleHours: 0.6, mpg: 6.1, missedFuelSavings: -32, actualSaving: 470, adherence: 88.0, planAdherence: 84.0, wastedRate: 5.2 },
  { truck: '#6675', cls: 'A', startDate: 'May 9', endDate: 'May 10', lane: 'Denver, CO → Salt Lake City, UT', status: 'delivered', income: 1600, negotiatedRpm: 3.05, executedRpm: 2.92, effectiveRpm: 2.78, cost: 650, optimalCost: 610, totalMiles: 525, loadedMiles: 480, effectiveHours: 11.2, idleHours: 0.3, mpg: 6.6, missedFuelSavings: -25, actualSaving: 700, adherence: 94.5, planAdherence: 91.0, wastedRate: 3.6 },
  { truck: '#2299', cls: 'C', startDate: 'May 9', endDate: 'May 9', lane: 'Salt Lake City, UT → Boise, ID', status: 'paid', income: 640, negotiatedRpm: 2.60, executedRpm: 2.42, effectiveRpm: 2.25, cost: 340, optimalCost: 300, totalMiles: 235, loadedMiles: 195, effectiveHours: 5.0, idleHours: 1.0, mpg: 5.8, missedFuelSavings: -55, actualSaving: 380, adherence: 80.0, planAdherence: 75.5, wastedRate: 6.8 },
  { truck: '#9067', cls: 'B', startDate: 'May 8', endDate: 'May 9', lane: 'Seattle, WA → Portland, OR', status: 'invoiced', income: 900, negotiatedRpm: 2.88, executedRpm: 2.75, effectiveRpm: 2.60, cost: 400, optimalCost: 370, totalMiles: 300, loadedMiles: 270, effectiveHours: 6.4, idleHours: 0.5, mpg: 6.3, missedFuelSavings: -24, actualSaving: 500, adherence: 89.5, planAdherence: 85.8, wastedRate: 4.5 },
  { truck: '#4456', cls: 'D', startDate: 'May 8', endDate: 'May 8', lane: 'Portland, OR → Sacramento, CA', band: 'worst', status: 'paid', income: 2600, negotiatedRpm: 2.35, executedRpm: 2.10, effectiveRpm: 1.85, cost: 1750, optimalCost: 1420, totalMiles: 900, loadedMiles: 620, effectiveHours: 18.0, idleHours: 4.4, mpg: 5.5, missedFuelSavings: -290, actualSaving: 190, adherence: 64.8, planAdherence: 59.0, wastedRate: 10.6 },
  { truck: '#7701', cls: 'C', startDate: 'May 7', endDate: 'May 8', lane: 'Las Vegas, NV → Denver, CO', status: 'invoiced', income: 1100, negotiatedRpm: 2.62, executedRpm: 2.45, effectiveRpm: 2.28, cost: 620, optimalCost: 550, totalMiles: 420, loadedMiles: 355, effectiveHours: 9.0, idleHours: 1.4, mpg: 5.9, missedFuelSavings: -65, actualSaving: 360, adherence: 78.5, planAdherence: 73.0, wastedRate: 7.2 },
  { truck: '#3312', cls: 'A', startDate: 'May 7', endDate: 'May 7', lane: 'New York, NY → Newark, NJ', status: 'delivered', income: 560, negotiatedRpm: 3.10, executedRpm: 2.98, effectiveRpm: 2.84, cost: 220, optimalCost: 205, totalMiles: 165, loadedMiles: 150, effectiveHours: 3.6, idleHours: 0.2, mpg: 6.5, missedFuelSavings: -14, actualSaving: 520, adherence: 95.0, planAdherence: 92.2, wastedRate: 3.2 },
  { truck: '#5588', cls: 'B', startDate: 'May 6', endDate: 'May 7', lane: 'Philadelphia, PA → New York, NY', status: 'invoiced', income: 980, negotiatedRpm: 2.82, executedRpm: 2.68, effectiveRpm: 2.52, cost: 460, optimalCost: 420, totalMiles: 340, loadedMiles: 300, effectiveHours: 7.2, idleHours: 0.6, mpg: 6.2, missedFuelSavings: -26, actualSaving: 510, adherence: 87.6, planAdherence: 83.9, wastedRate: 4.8 },
  { truck: '#6634', cls: 'C', startDate: 'May 6', endDate: 'May 6', lane: 'Boston, MA → Hartford, CT', status: 'paid', income: 520, negotiatedRpm: 2.58, executedRpm: 2.40, effectiveRpm: 2.22, cost: 300, optimalCost: 265, totalMiles: 200, loadedMiles: 165, effectiveHours: 4.3, idleHours: 0.9, mpg: 5.9, missedFuelSavings: -42, actualSaving: 300, adherence: 79.8, planAdherence: 74.6, wastedRate: 6.9 },
  { truck: '#8890', cls: 'A', startDate: 'May 5', endDate: 'May 6', lane: 'Columbus, OH → Detroit, MI', status: 'delivered', income: 720, negotiatedRpm: 2.94, executedRpm: 2.80, effectiveRpm: 2.66, cost: 310, optimalCost: 288, totalMiles: 260, loadedMiles: 235, effectiveHours: 5.6, idleHours: 0.3, mpg: 6.5, missedFuelSavings: -18, actualSaving: 460, adherence: 92.4, planAdherence: 88.7, wastedRate: 3.9 },
  { truck: '#1023', cls: 'B', startDate: 'May 5', endDate: 'May 5', lane: 'Milwaukee, WI → Minneapolis, MN', status: 'invoiced', income: 640, negotiatedRpm: 2.76, executedRpm: 2.62, effectiveRpm: 2.46, cost: 310, optimalCost: 280, totalMiles: 250, loadedMiles: 220, effectiveHours: 5.3, idleHours: 0.7, mpg: 6.1, missedFuelSavings: -30, actualSaving: 420, adherence: 86.9, planAdherence: 82.4, wastedRate: 5.1 },
  { truck: '#4467', cls: 'D', startDate: 'May 4', endDate: 'May 5', lane: 'Des Moines, IA → Omaha, NE', band: 'worst', status: 'paid', income: 1900, negotiatedRpm: 2.28, executedRpm: 2.02, effectiveRpm: 1.76, cost: 1280, optimalCost: 1030, totalMiles: 640, loadedMiles: 440, effectiveHours: 13.4, idleHours: 3.3, mpg: 5.4, missedFuelSavings: -240, actualSaving: 160, adherence: 65.9, planAdherence: 60.1, wastedRate: 10.1 },
  { truck: '#9982', cls: 'C', startDate: 'May 4', endDate: 'May 4', lane: 'Wichita, KS → Oklahoma City, OK', status: 'invoiced', income: 800, negotiatedRpm: 2.60, executedRpm: 2.42, effectiveRpm: 2.24, cost: 460, optimalCost: 400, totalMiles: 310, loadedMiles: 260, effectiveHours: 6.7, idleHours: 1.2, mpg: 5.8, missedFuelSavings: -58, actualSaving: 340, adherence: 78.0, planAdherence: 72.6, wastedRate: 7.5 },
  { truck: '#3345', cls: 'B', startDate: 'May 3', endDate: 'May 4', lane: 'Fargo, ND → Sioux Falls, SD', status: 'delivered', income: 700, negotiatedRpm: 2.72, executedRpm: 2.58, effectiveRpm: 2.42, cost: 330, optimalCost: 300, totalMiles: 265, loadedMiles: 235, effectiveHours: 5.6, idleHours: 0.5, mpg: 6.2, missedFuelSavings: -22, actualSaving: 440, adherence: 88.2, planAdherence: 84.5, wastedRate: 4.6 },
  { truck: '#7123', cls: 'C', startDate: 'May 3', endDate: 'May 3', lane: 'New Orleans, LA → Jackson, MS', status: 'paid', income: 690, negotiatedRpm: 2.50, executedRpm: 2.32, effectiveRpm: 2.14, cost: 400, optimalCost: 350, totalMiles: 285, loadedMiles: 235, effectiveHours: 6.1, idleHours: 1.3, mpg: 5.7, missedFuelSavings: -62, actualSaving: 320, adherence: 77.2, planAdherence: 71.9, wastedRate: 7.8 },
  { truck: '#2567', cls: 'A', startDate: 'May 2', endDate: 'May 3', lane: 'Birmingham, AL → Columbia, SC', status: 'invoiced', income: 750, negotiatedRpm: 2.96, executedRpm: 2.83, effectiveRpm: 2.69, cost: 320, optimalCost: 298, totalMiles: 265, loadedMiles: 240, effectiveHours: 5.7, idleHours: 0.3, mpg: 6.4, missedFuelSavings: -19, actualSaving: 470, adherence: 91.8, planAdherence: 88.0, wastedRate: 4.1 },
  { truck: '#6098', cls: 'D', startDate: 'May 2', endDate: 'May 2', lane: 'Richmond, VA → Charleston, WV', band: 'worst', status: 'paid', income: 2050, negotiatedRpm: 2.40, executedRpm: 2.15, effectiveRpm: 1.90, cost: 1380, optimalCost: 1110, totalMiles: 690, loadedMiles: 470, effectiveHours: 14.2, idleHours: 3.6, mpg: 5.5, missedFuelSavings: -255, actualSaving: 175, adherence: 66.5, planAdherence: 61.0, wastedRate: 9.9 },
  { truck: '#4821', cls: 'B', startDate: 'May 1', endDate: 'May 2', lane: 'Louisville, KY → Little Rock, AR', status: 'invoiced', income: 860, negotiatedRpm: 2.78, executedRpm: 2.64, effectiveRpm: 2.48, cost: 400, optimalCost: 365, totalMiles: 300, loadedMiles: 265, effectiveHours: 6.3, idleHours: 0.6, mpg: 6.0, missedFuelSavings: -27, actualSaving: 480, adherence: 87.0, planAdherence: 83.2, wastedRate: 4.7 },
  { truck: '#5544', cls: 'D', startDate: 'May 15', endDate: 'May 16', lane: 'Billings, MT → Cheyenne, WY', band: 'worst', status: 'paid', income: 480, negotiatedRpm: 2.10, executedRpm: 1.82, effectiveRpm: 1.55, cost: 620, optimalCost: 520, totalMiles: 470, loadedMiles: 260, effectiveHours: 10.5, idleHours: 3.8, mpg: 5.1, missedFuelSavings: -195, actualSaving: 60, adherence: 52.0, planAdherence: 46.5, wastedRate: 13.4 },
  { truck: '#6289', cls: 'D', startDate: 'May 15', endDate: 'May 15', lane: 'Portland, ME → Manchester, NH', band: 'worst', status: 'invoiced', income: 350, negotiatedRpm: 2.05, executedRpm: 1.78, effectiveRpm: 1.50, cost: 430, optimalCost: 380, totalMiles: 340, loadedMiles: 175, effectiveHours: 7.6, idleHours: 2.9, mpg: 5.0, missedFuelSavings: -140, actualSaving: 45, adherence: 50.5, planAdherence: 45.0, wastedRate: 14.2 },
  { truck: '#7788', cls: 'C', startDate: 'May 14', endDate: 'May 15', lane: 'Burlington, VT → Albany, NY', band: 'worst', status: 'paid', income: 500, negotiatedRpm: 2.20, executedRpm: 1.95, effectiveRpm: 1.68, cost: 560, optimalCost: 500, totalMiles: 300, loadedMiles: 170, effectiveHours: 6.4, idleHours: 2.2, mpg: 5.3, missedFuelSavings: -100, actualSaving: 65, adherence: 55.8, planAdherence: 50.2, wastedRate: 11.8 },
]

export const tripRows: TripRow[] = computeScores(TRIP_BASE.map((b, i) => buildTrip(b, i)))

// ── By-driver rankings (analysis dimension = drivers) ────────────────────────
// Same RankRow shape as the truck rankings, keyed by driver name, so Potential
// Savings and the market benchmark can be read per driver instead of per truck.
// The number of distinct drivers actually running loads, for the per-driver
// leakage figure (mirrors FLEET_TRUCKS in MoneyLeakage).
export const FLEET_DRIVERS = new Set(tripRows.map((r) => r.driver)).size

const DRIVER_ROSTER = DRIVER_POOL.map((d) => d.name)
export const bottomDrivers: RankRow[] = DRIVER_ROSTER.slice(0, 15).map((name, i) => {
  const cause = WORST_CAUSES[i % 4]
  return {
    rank: String(i + 1).padStart(2, '0'),
    name,
    cause,
    metric: worstMetric(cause, i),
    weekly: -Math.max(70, 305 - i * 17),
    tone: 'red' as Tone,
  }
})
export const topDrivers: RankRow[] = [...DRIVER_ROSTER].reverse().slice(0, 15).map((name, i) => {
  const cause = WORST_CAUSES[(i + 2) % 4]
  return {
    rank: String(i + 1).padStart(2, '0'),
    name,
    cause,
    metric: cause === 'idle' ? 4 + (i % 5) : cause === 'deviation' ? 1 + (i % 3) : cause === 'empty' ? 6 + i : 2 + i,
    weekly: Math.max(120, 460 - i * 18),
    tone: 'green' as Tone,
  }
})
export const driverLeaders: RankRow[] = DRIVER_ROSTER.slice(0, 15).map((name, i) => ({
  rank: String(i + 1).padStart(2, '0'),
  name,
  weekly: Math.max(300, 470 - i * 12),
  tone: 'green' as Tone,
  you: i === 1,
}))

// Operative repositioning — empty (deadhead) moves the truck makes on dispatch
// instructions that are NOT tied to any load. Example: a truck sitting in
// Wolcott, IN is told to reposition empty to Louisville, KY, and only from
// there deadheads toward its next load's pickup. These are pure cost with no
// revenue and no adherence/wasted metrics, so they carry operational fields
// only. `reposition: true` is what tells the Trips table a row is a move, not
// a load.
export interface RepositionRow {
  reposition: true
  id: string
  // A "gap" is one long empty stretch between two loads, split into consecutive
  // legs (leg[i].endDate == leg[i+1].startDate, dest == next origin). All legs
  // of a gap share gapId and are ordered by seq. Only consecutive legs of the
  // same gap can be merged or assigned to the neighbouring load's deadhead.
  gapId: string
  seq: number
  truck: string
  driver: string
  cls: TripRow['cls']
  startDate: string
  endDate: string
  lane: string // "Wolcott, IN → Louisville, KY"
  reason: string // why the move happened — shown on hover
  totalMiles: number // 100% deadhead
  effectiveHours: number
  cost: number
  // Even an empty operational move is graded: did it follow the optimal route
  // (adherence), and how much of its cost was avoidable excess (leakage)?
  adherence: number // %
  leakage: number // $ excess cost vs the optimal empty move
  // The load this gap's deadhead leads into (the next pickup on the truck's
  // timeline) — target for "assign to load's deadhead".
  nextLoadId: string
  nextLoadLane: string
}

// Dates chain backward so each gap ENDS exactly on the start date of the load
// it leads into (DH end = LD start), keeping every truck's timeline continuous
// — an operative trip can never overlap the load it precedes.
export const repositionRows: RepositionRow[] = [
  // Gap A — #7834: 3 consecutive legs ending May 11, when load L40012007 (May 11→12) picks up.
  { reposition: true, id: 'op-7834-1', gapId: 'g-7834-a', seq: 1, truck: '#7834', cls: 'D', driver: driverForIndex(0), startDate: 'May 9', endDate: 'May 10', lane: 'Wolcott, IN → Louisville, KY', reason: 'Moved empty on dispatch instruction to stage for the next pickup', totalMiles: 176, effectiveHours: 3.1, cost: 208, adherence: 91.5, leakage: 14, nextLoadId: '#6100', nextLoadLane: 'Memphis, TN → Atlanta, GA' },
  { reposition: true, id: 'op-7834-2', gapId: 'g-7834-a', seq: 2, truck: '#7834', cls: 'D', driver: driverForIndex(0), startDate: 'May 10', endDate: 'May 11', lane: 'Louisville, KY → Nashville, TN', reason: 'Continued empty toward the staged pickup market', totalMiles: 172, effectiveHours: 3.0, cost: 198, adherence: 88.0, leakage: 20, nextLoadId: '#6100', nextLoadLane: 'Memphis, TN → Atlanta, GA' },
  { reposition: true, id: 'op-7834-3', gapId: 'g-7834-a', seq: 3, truck: '#7834', cls: 'D', driver: driverForIndex(0), startDate: 'May 11', endDate: 'May 11', lane: 'Nashville, TN → Memphis, TN', reason: 'Final empty leg to the load pickup', totalMiles: 210, effectiveHours: 3.6, cost: 236, adherence: 90.2, leakage: 12, nextLoadId: '#6100', nextLoadLane: 'Memphis, TN → Atlanta, GA' },
  // Gap B — #4467: 2 consecutive legs ending May 4, when load L40012023 (May 4→5) picks up.
  { reposition: true, id: 'op-4467-1', gapId: 'g-4467-a', seq: 1, truck: '#4467', cls: 'D', driver: driverForIndex(6), startDate: 'May 2', endDate: 'May 3', lane: 'Omaha, NE → Kansas City, MO', reason: 'Repositioned empty per dispatch after a long dwell', totalMiles: 199, effectiveHours: 3.5, cost: 234, adherence: 82.3, leakage: 31, nextLoadId: '#6243', nextLoadLane: 'St. Louis, MO → Chicago, IL' },
  { reposition: true, id: 'op-4467-2', gapId: 'g-4467-a', seq: 2, truck: '#4467', cls: 'D', driver: driverForIndex(6), startDate: 'May 3', endDate: 'May 4', lane: 'Kansas City, MO → St. Louis, MO', reason: 'Continued empty to reach the booked pickup', totalMiles: 250, effectiveHours: 4.3, cost: 286, adherence: 85.0, leakage: 22, nextLoadId: '#6243', nextLoadLane: 'St. Louis, MO → Chicago, IL' },
  // Single-leg gaps — each ends the day its load picks up.
  { reposition: true, id: 'op-2210-1', gapId: 'g-2210-a', seq: 1, truck: '#2210', cls: 'D', driver: driverForIndex(2), startDate: 'May 10', endDate: 'May 11', lane: 'Houston, TX → San Antonio, TX', reason: 'Repositioned empty to a higher-demand market per dispatch', totalMiles: 197, effectiveHours: 3.4, cost: 231, adherence: 87.2, leakage: 24, nextLoadId: '#6310', nextLoadLane: 'San Antonio, TX → Dallas, TX' },
  { reposition: true, id: 'op-5012-1', gapId: 'g-5012-a', seq: 1, truck: '#5012', cls: 'A', driver: driverForIndex(1), startDate: 'May 13', endDate: 'May 14', lane: 'Houston, TX → Austin, TX', reason: 'Repositioned empty to pre-stage near a booked pickup', totalMiles: 162, effectiveHours: 2.7, cost: 184, adherence: 95.6, leakage: 6, nextLoadId: '#6355', nextLoadLane: 'Austin, TX → Dallas, TX' },
  { reposition: true, id: 'op-4456-1', gapId: 'g-4456-a', seq: 1, truck: '#4456', cls: 'D', driver: driverForIndex(4), startDate: 'May 7', endDate: 'May 8', lane: 'Sacramento, CA → Stockton, CA', reason: 'Moved empty off a slow lane on dispatch instruction', totalMiles: 49, effectiveHours: 1.0, cost: 72, adherence: 89.0, leakage: 11, nextLoadId: '#6402', nextLoadLane: 'Stockton, CA → Fresno, CA' },
  { reposition: true, id: 'op-8823-1', gapId: 'g-8823-a', seq: 1, truck: '#8823', cls: 'B', driver: driverForIndex(7), startDate: 'May 9', endDate: 'May 10', lane: 'Albuquerque, NM → Santa Fe, NM', reason: 'Short empty move to stage for the morning pickup', totalMiles: 64, effectiveHours: 1.2, cost: 88, adherence: 96.1, leakage: 4, nextLoadId: '#6440', nextLoadLane: 'Santa Fe, NM → Denver, CO' },
]

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

// Which costSegments categories happen while the truck is running deadhead
// vs. loaded — lets a view collapse the 7-category breakdown into the
// simpler % deadhead / % loaded split without redefining the percentages.
const DEADHEAD_COST_LABELS = new Set([
  'Reposition deadhead',
  'Operative center return',
  'PC while unloaded',
  'Deadhead Deviation Excess',
])
export const costGroupPct = {
  deadhead: costSegments.filter((s) => DEADHEAD_COST_LABELS.has(s.label)).reduce((sum, s) => sum + s.pct, 0),
  loaded: costSegments.filter((s) => !DEADHEAD_COST_LABELS.has(s.label)).reduce((sum, s) => sum + s.pct, 0),
}

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
