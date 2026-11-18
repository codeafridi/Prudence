import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { DecisionNode } from '../model/derive'
import { NODE_W } from './layout'

const dot: Record<string, string> = {
  open: 'bg-white/25',
  asked: 'bg-amber-400',
  decided: 'bg-emerald-400',
  parked: 'bg-slate-500',
}

export function DecisionNodeView({ data, selected }: NodeProps<DecisionNode>) {
  const { decision, flags, explored } = data
  const n = decision.options.length

  return (
    <div
      style={{ width: NODE_W }}
      className={[
        'rounded-lg border bg-[#131317] px-3 py-2 text-left shadow-lg',
        selected ? 'border-white/40' : 'border-white/10',
        flags.premature ? 'border-dashed' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot[decision.state]}`} />
        <p className="line-clamp-2 text-[13px] leading-snug text-white/90">{decision.question}</p>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-white/35">
        <span>{explored}</span>
        <span>{flags.terminal ? '✓' : decision.state}</span>
      </div>

      {/* one source handle per option — the fork IS the decision (§6) */}
      {decision.options.map((option, i) => (
        <Handle
          key={option}
          id={String(i)}
          type="source"
          position={Position.Bottom}
          title={option}
          className="!h-2 !w-2 !border-0 !bg-white/30"
          style={{ left: `${((i + 1) / (n + 1)) * 100}%` }}
        />
      ))}

      {/* assumption children hang off the left, so they read differently from requirements (§6) */}
      <Handle
        id="assumption"
        type="source"
        position={Position.Left}
        className="!h-2 !w-2 !border-0 !bg-sky-400/40"
      />

      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-white/20" />
    </div>
  )
}
