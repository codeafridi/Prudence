import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { DecisionNode } from '../model/derive'
import { NODE_W } from './layout'

/**
 * A clause in the record, not a card: a clause number, a rule, the question in the serif,
 * the options as marks, and the state as a stamp. No boxes — the rule is the structure.
 */
export function DecisionNodeView({ data, selected }: NodeProps<DecisionNode>) {
  const { decision, flags, explored, clause, stale } = data
  const count = decision.options.length
  const decided = decision.state === 'decided' && Boolean(decision.choice)

  return (
    <div style={{ width: NODE_W }} className="relative text-left">
      {selected && (
        <span
          aria-hidden
          className="absolute -left-4 -top-1 -bottom-1 w-2 border-y-2 border-l-2 border-stamp/70"
        />
      )}

      <div className="flex items-baseline gap-2 border-t border-rule pt-1.5">
        <span className={['entry-no', selected ? '!text-stamp' : ''].join(' ')}>{clause}</span>
        <span className="h-px flex-1 bg-rule" />
        {stale && <span className="label !text-stamp">stale</span>}
        {flags.abandoned && <span className="label">not taken</span>}
      </div>

      <p
        className={[
          'mt-1.5 text-pretty font-serif leading-[1.25] tracking-[-0.004em]',
          decision.question.length > 46 ? 'text-[17px]' : 'text-[19px]',
          flags.abandoned ? 'text-ink-3 line-through decoration-1' : 'text-ink',
        ].join(' ')}
      >
        {decision.question}
      </p>

      <ul className="mt-2 space-y-[3px]">
        {decision.options.map((option) => {
          const chosen = decided && option === decision.choice
          return (
            <li
              key={option}
              className={[
                'flex items-baseline gap-2 font-mono text-[10px] leading-[1.5]',
                chosen ? 'text-ink' : 'text-ink-2',
              ].join(' ')}
              title={option}
            >
              <span className={chosen ? 'text-stamp' : 'text-ink-3'}>{chosen ? '◉' : '○'}</span>
              <span className="min-w-0 flex-1 truncate">
                {chosen ? `→ ${option}` : option}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="mt-2 flex items-end justify-between gap-2">
        {decided ? (
          <span className="stamp">filed · {decision.choice}</span>
        ) : (
          <span className="stamp-open">
            {flags.abandoned
              ? 'not taken'
              : decision.state === 'parked'
                ? 'parked'
                : decision.state === 'asked'
                  ? 'open · asked'
                  : 'open · undecided'}
          </span>
        )}
        <span className="label shrink-0 pb-0.5 text-right">
          {explored}
          {flags.atRisk && <span className="text-stamp"> · at risk</span>}
        </span>
      </div>

      {/* one source handle per option — the fork IS the decision (§6) */}
      {decision.options.map((option, i) => (
        <Handle
          key={option}
          id={String(i)}
          type="source"
          position={Position.Bottom}
          title={option}
          className="!h-2 !w-2 !border-0 !bg-pencil"
          style={{ left: `${((i + 1) / (count + 1)) * 100}%` }}
        />
      ))}

      {/* assumption children hang off the left, so they read differently from requirements (§6) */}
      <Handle
        id="assumption"
        type="source"
        position={Position.Left}
        className="!h-2 !w-2 !border-0 !bg-ink-3"
      />

      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-ink-3" />
    </div>
  )
}
