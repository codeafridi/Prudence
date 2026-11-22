import { useMemo } from 'react'
import { calibration, type Calibration as CalibrationData } from '../model/calibration'
import type { Project } from '../model/types'

/**
 * The review panel's scoreboard: what you said would happen against what happened.
 * Derived only — nothing here is stored, and nothing is sent anywhere.
 */
export function Calibration({ project }: { project: Project }) {
  const cal = useMemo(() => calibration(project.root), [project])

  return (
    <div className="border-t border-ink px-4 py-3 md:px-5">
      <div className="flex items-baseline justify-between">
        <span className="label">Calibration</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] tabular-nums text-ink-3">
          {cal.n === 0 ? 'no calls' : `${cal.n} ${cal.n === 1 ? 'call' : 'calls'}`}
        </span>
      </div>

      {cal.n === 0 ? (
        <p className="mt-1 font-serif text-[11.5px] leading-[1.5] text-ink-3">
          {cal.unscored > 0
            ? 'Outcomes are recorded, but those questions had no probability set. Put a number on the next one before you review it.'
            : 'No outcomes yet. Record a review on a decided question — the forecast locks there and starts scoring here.'}
        </p>
      ) : (
        <Body cal={cal} />
      )}
    </div>
  )
}

function Body({ cal }: { cal: CalibrationData }) {
  const points = Math.round(cal.bias * 100)
  const direction =
    Math.abs(cal.bias) < 0.05
      ? 'called it about right'
      : cal.bias > 0
        ? `overconfident by ${points} points`
        : `underconfident by ${Math.abs(points)} points`

  return (
    <>
      <p className="mt-1 font-serif text-[12.5px] leading-[1.45] text-ink-2">
        said {pct(cal.meanP)} · happened {pct(cal.hitRate)}
      </p>
      <p className="mt-0.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-ink-3">
        {direction} · brier {cal.brier === null ? '—' : cal.brier.toFixed(2)}
      </p>

      <Plot cal={cal} />

      <table className="mt-1 w-full border-collapse font-mono text-[9px] tabular-nums text-ink-2">
        <thead>
          <tr className="text-ink-3">
            <th className="border-b border-rule-soft py-1 text-left font-normal uppercase tracking-[0.1em]">
              called
            </th>
            <th className="border-b border-rule-soft py-1 text-right font-normal uppercase tracking-[0.1em]">
              n
            </th>
            <th className="border-b border-rule-soft py-1 text-right font-normal uppercase tracking-[0.1em]">
              said
            </th>
            <th className="border-b border-rule-soft py-1 text-right font-normal uppercase tracking-[0.1em]">
              happened
            </th>
          </tr>
        </thead>
        <tbody>
          {cal.buckets.map((bucket) => (
            <tr key={bucket.label}>
              <td className="border-b border-rule-soft py-1 pr-2">{bucket.label}</td>
              <td className="border-b border-rule-soft py-1 text-right">{bucket.n}</td>
              <td className="border-b border-rule-soft py-1 text-right">{pct(bucket.said)}</td>
              <td className="border-b border-rule-soft py-1 text-right">{pct(bucket.happened)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-1 font-serif text-[10px] leading-[1.45] text-ink-3">
        {cal.n < 5 ? 'Small sample — a note, not a verdict. ' : ''}
        Mixed counts as half. Brier 0.25 is a coin flip; outcomes are your own calls.
      </p>
    </>
  )
}

/** Identity line: a perfectly calibrated call sits on it. */
function Plot({ cal }: { cal: CalibrationData }) {
  const x = (p: number) => 10 + p * 86
  const y = (outcome: number) => 34 - outcome * 26

  return (
    <svg
      viewBox="0 0 100 42"
      className="mt-2 w-full"
      style={{ height: 'auto', aspectRatio: '100 / 42' }}
      role="img"
      aria-label={`Calibration plot: ${cal.n} calls, said ${pct(cal.meanP)} percent, happened ${pct(cal.hitRate)} percent`}
    >
      <line x1="10" y1="34" x2="96" y2="34" stroke="var(--color-rule)" strokeWidth="0.4" />
      <line x1="10" y1="8" x2="10" y2="34" stroke="var(--color-rule)" strokeWidth="0.4" />
      <line
        x1="10"
        y1="34"
        x2="96"
        y2="8"
        stroke="var(--color-ink-3)"
        strokeWidth="0.35"
        strokeDasharray="1.6 1.6"
        opacity="0.55"
      />
      <text
        x="3.4"
        y="21"
        transform="rotate(-90 3.4 21)"
        textAnchor="middle"
        fontSize="3.2"
        fill="var(--color-ink-2)"
        fontFamily="var(--font-mono)"
      >
        happened
      </text>
      <text x="10" y="39" fontSize="2.6" fill="var(--color-ink-3)" fontFamily="var(--font-mono)">
        0
      </text>
      <text
        x="53"
        y="39"
        textAnchor="middle"
        fontSize="3.2"
        fill="var(--color-ink-2)"
        fontFamily="var(--font-mono)"
      >
        said
      </text>
      <text
        x="96"
        y="39"
        textAnchor="end"
        fontSize="2.6"
        fill="var(--color-ink-3)"
        fontFamily="var(--font-mono)"
      >
        100%
      </text>
      {cal.buckets.map((bucket) => (
        <circle
          key={bucket.label}
          cx={x(bucket.said)}
          cy={y(bucket.happened)}
          r={2 + Math.min(1, bucket.n * 0.2)}
          fill="var(--color-stamp)"
          opacity="0.85"
        >
          <title>
            {bucket.label}: {bucket.n} called, said {pct(bucket.said)}, happened {pct(bucket.happened)}
          </title>
        </circle>
      ))}
    </svg>
  )
}

function pct(p: number): string {
  return `${Math.round(p * 100)}%`
}
