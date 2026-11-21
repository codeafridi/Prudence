import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { DecisionNode } from '../model/derive'
import { NODE_W } from './layout'

const dot: Record<string, string> = {
  open: 'bg-ink-3',
  asked: 'bg-amber-400',
  decided: 'bg-accent',
  parked: 'bg-slate-500',
}

/** A card, not a panel: a state dot, the question, the call, and the tally. */
export function DecisionNodeView({ data, selected }: NodeProps<DecisionNode>) {
  const { decision, flags, explored, recommended, stale, onPath } = data
  const count = decision.options.length
  const decided = decision.state === 'decided'

  return (
    <div
      style={{ width: NODE_W }}
      className={[
        'rounded-[10px] border bg-card px-3 py-2.5 text-left transition-shadow',
        'shadow-[0_2px_10px_rgba(0,0,0,0.45)]',
        selected
          ? 'border-accent/60 shadow-[0_0_0_1px_rgba(52,211,153,0.35),0_8px_24px_rgba(0,0,0,0.5)]'
          : onPath
            ? 'border-line-hi'
            : 'border-line',
        flags.premature ? 'border-dashed' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${dot[decision.state]}`} />
        <p className="line-clamp-2 text-pretty text-[13px] font-medium leading-[1.35] text-ink">
          {decision.question}
        </p>
        {stale && (
          <span
            className="ml-auto shrink-0 text-[9px] text-amber-400"
            title="answered against a different tree"
          >
            stale
          </span>
        )}
      </div>

      {decided && decision.choice && (
        <p className="mt-1.5 truncate pl-[14px] text-[11px] text-accent/90" title={decision.choice}>
          → {decision.choice}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between pl-[14px] text-[10px] tabular-nums text-ink-3">
        <span>{explored}</span>
        <span className="flex items-center gap-1.5">
          {flags.atRisk && <span className="text-red-400">at risk</span>}
          <span className="uppercase tracking-[0.08em] text-ink-2">
            {flags.abandoned ? 'not taken' : flags.terminal ? 'settled' : decision.state}
          </span>
        </span>
      </div>

      {/* one source handle per option — the fork IS the decision (§6) */}
      {decision.options.map((option, i) => {
        const picked = recommended === option
        return (
          <Handle
            key={option}
            id={String(i)}
            type="source"
            position={Position.Bottom}
            title={picked ? `AI pick: ${option}` : option}
            className={[
              '!h-1.5 !w-1.5 !border-0',
              picked ? '!bg-accent !shadow-[0_0_6px_rgba(52,211,153,0.8)]' : '!bg-white/25',
            ].join(' ')}
            style={{ left: `${((i + 1) / (count + 1)) * 100}%` }}
          />
        )
      })}

      {/* assumption children hang off the left, so they read differently from requirements (§6) */}
      <Handle
        id="assumption"
        type="source"
        position={Position.Left}
        className="!h-1.5 !w-1.5 !border-0 !bg-sky-400/50"
      />

      <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !border-0 !bg-white/20" />
    </div>
  )
}
