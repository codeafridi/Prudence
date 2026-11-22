import { hasForecast, pOf } from './ev.ts'
import type { Decision, ReviewVerdict } from './types.ts'

/**
 * Scores the probabilities you put on the record, once outcomes exist.
 *
 * A call is one decided question with a review and a forecast. `worked` counts as 1, `failed` as
 * 0, `mixed` as 0.5 — the outcome of a mixed review is genuinely halfway. Brier is the mean
 * squared distance between the forecast and that outcome: 0 is perfect, 0.25 is a coin flip.
 *
 * Small samples are noise. Nothing here hides that: the panel states n before it states a bias.
 */

const OUTCOME: Record<ReviewVerdict, number> = { worked: 1, mixed: 0.5, failed: 0 }

export type CalibrationCall = {
  id: string
  question: string
  /** The forecast that was scored — the review's locked p, or the current one on older records. */
  p: number
  outcome: number
  at: number
}

export type CalibrationBucket = {
  lo: number
  hi: number
  label: string
  n: number
  said: number
  happened: number
}

export type Calibration = {
  calls: CalibrationCall[]
  n: number
  /** Reviews that exist but have no forecast to score. */
  unscored: number
  /** null until there is at least one call. */
  brier: number | null
  meanP: number
  hitRate: number
  /** meanP - hitRate. Positive means you claimed more than happened. */
  bias: number
  buckets: CalibrationBucket[]
}

const EDGES = [0, 0.5, 0.6, 0.7, 0.8, 0.9, 1] as const
const LABELS = ['under 50', '50–60', '60–70', '70–80', '80–90', '90+'] as const

export function calibration(root: Decision): Calibration {
  const calls: CalibrationCall[] = []
  let unscored = 0

  // A review under an option you did not pick is counterfactual: the outcome never happened,
  // so it must not score the forecast.
  const walk = (node: Decision, dead: boolean) => {
    if (node.state === 'decided' && node.review && !dead) {
      const p = node.review.p ?? (hasForecast(node) ? pOf(node) : undefined)
      if (p !== undefined && Number.isFinite(p)) {
        calls.push({
          id: node.id,
          question: node.question,
          p: clamp01(p),
          outcome: OUTCOME[node.review.verdict],
          at: node.review.at,
        })
      } else {
        unscored++
      }
    }
    for (const child of node.children) {
      const childDead =
        dead ||
        (node.state === 'decided' &&
          node.choice !== undefined &&
          child.via?.kind === 'option' &&
          child.via.option !== node.choice)
      walk(child, childDead)
    }
  }
  walk(root, false)

  const n = calls.length
  const meanP = n === 0 ? 0 : calls.reduce((sum, call) => sum + call.p, 0) / n
  const hitRate = n === 0 ? 0 : calls.reduce((sum, call) => sum + call.outcome, 0) / n
  const brier =
    n === 0
      ? null
      : calls.reduce((sum, call) => sum + (call.p - call.outcome) ** 2, 0) / n

  const buckets: CalibrationBucket[] = []
  for (let i = 0; i < LABELS.length; i++) {
    const lo = EDGES[i]
    const hi = EDGES[i + 1]
    const inBucket = calls.filter((call) => inRange(call.p, lo, hi, i === LABELS.length - 1))
    if (inBucket.length === 0) continue
    buckets.push({
      lo,
      hi,
      label: LABELS[i],
      n: inBucket.length,
      said: inBucket.reduce((sum, call) => sum + call.p, 0) / inBucket.length,
      happened: inBucket.reduce((sum, call) => sum + call.outcome, 0) / inBucket.length,
    })
  }

  return { calls, n, unscored, brier, meanP, hitRate, bias: meanP - hitRate, buckets }
}

function inRange(p: number, lo: number, hi: number, last: boolean): boolean {
  if (last) return p >= lo && p <= hi
  return p >= lo && p < hi
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
