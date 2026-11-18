import { useMemo, useState } from 'react'
import { derive } from '../model/derive'
import type { Decision } from '../model/types'
import { useStore } from '../state/store'

/**
 * The list view. The canvas stops scaling before the data does, so the same tree gets a second
 * reading mode: indentation instead of space, keyboard-friendly, no panning.
 */
export function Outline() {
  const project = useStore((s) => s.project)
  const selectedId = useStore((s) => s.selectedId)
  const requestFocus = useStore((s) => s.requestFocus)

  // derive() already computes premature/abandoned/atRisk/stale — reuse it instead of re-deriving.
  const data = useMemo(() => {
    const map = new Map<string, ReturnType<typeof derive>['nodes'][number]['data']>()
    for (const node of derive(project).nodes) map.set(node.id, node.data)
    return map
  }, [project])

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const rows: { node: Decision; depth: number }[] = []
  const walk = (node: Decision, depth: number) => {
    rows.push({ node, depth })
    if (collapsed.has(node.id)) return
    for (const child of node.children) walk(child, depth + 1)
  }
  walk(project.root, 0)

  return (
    <div className="h-full overflow-y-auto p-3 text-[13px]">
      {rows.map(({ node, depth }) => {
        const nodeData = data.get(node.id)
        const nodeFlags = nodeData?.flags
        const abandoned = nodeFlags?.abandoned ?? false
        const hasChildren = node.children.length > 0
        const isCollapsed = collapsed.has(node.id)

        return (
          <div
            key={node.id}
            className={[
              'group flex items-center gap-1.5 rounded px-1 py-1',
              node.id === selectedId ? 'bg-white/10' : 'hover:bg-white/[0.04]',
              abandoned ? 'opacity-45' : '',
            ].join(' ')}
            style={{ paddingLeft: `${depth * 18 + 4}px` }}
          >
            <button
              onClick={() =>
                setCollapsed((previous) => {
                  const next = new Set(previous)
                  if (next.has(node.id)) next.delete(node.id)
                  else next.add(node.id)
                  return next
                })
              }
              disabled={!hasChildren}
              className="w-4 shrink-0 text-[10px] text-white/25 hover:text-white disabled:opacity-0"
              title={isCollapsed ? 'Expand' : 'Collapse'}
            >
              {isCollapsed ? '▸' : '▾'}
            </button>

            <span
              className={[
                'h-1.5 w-1.5 shrink-0 rounded-full',
                node.state === 'decided'
                  ? 'bg-emerald-400'
                  : node.state === 'asked'
                    ? 'bg-amber-400'
                    : node.state === 'parked'
                      ? 'bg-slate-500'
                      : 'bg-white/25',
              ].join(' ')}
            />

            <button
              onClick={() => requestFocus(node.id)}
              className="min-w-0 flex-1 truncate text-left text-white/80"
            >
              {node.question}
            </button>

            {nodeFlags?.atRisk && <span className="shrink-0 text-[10px] text-red-400">risk</span>}
            {nodeData?.stale && <span className="shrink-0 text-[10px] text-amber-400">stale</span>}
            {nodeFlags?.premature && (
              <span className="shrink-0 text-[10px] text-white/25">premature</span>
            )}

            {node.choice && (
              <span className="max-w-40 shrink-0 truncate text-[11px] text-emerald-300/70">
                → {node.choice}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
