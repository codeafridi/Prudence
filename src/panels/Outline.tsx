import { useMemo, useState } from 'react'
import { derive } from '../model/derive'
import { clauseNumbers } from '../model/numbering'
import type { Decision } from '../model/types'
import { useStore } from '../state/store'

/**
 * The list view. The canvas stops scaling before the data does, so the same record gets a second
 * reading mode: indentation and clause numbers instead of space, keyboard-friendly, no panning.
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

  const clauses = useMemo(() => clauseNumbers(project.root), [project])

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const rows: { node: Decision; depth: number }[] = []
  const walk = (node: Decision, depth: number) => {
    rows.push({ node, depth })
    if (collapsed.has(node.id)) return
    for (const child of node.children) walk(child, depth + 1)
  }
  walk(project.root, 0)

  return (
    <div className="h-full overflow-y-auto px-4 py-3 md:px-9 md:py-5">
      {rows.map(({ node, depth }) => {
        const nodeData = data.get(node.id)
        const nodeFlags = nodeData?.flags
        const abandoned = nodeFlags?.abandoned ?? false
        const hasChildren = node.children.length > 0
        const isCollapsed = collapsed.has(node.id)
        const selected = node.id === selectedId

        return (
          <div
            key={node.id}
            className={[
              'group flex items-baseline gap-2 border-b border-rule-soft py-1.5 last:border-0',
              selected ? 'bg-[#efe9da]' : '',
              abandoned ? 'opacity-55' : '',
            ].join(' ')}
            style={{ paddingLeft: `${depth * 22}px` }}
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
              className="w-3 shrink-0 text-[9px] text-ink-3 hover:text-ink disabled:opacity-0"
              title={isCollapsed ? 'Expand' : 'Collapse'}
            >
              {isCollapsed ? '▸' : '▾'}
            </button>

            <span className={['w-10 shrink-0 text-right font-mono text-[10px]', selected ? 'text-stamp' : 'text-ink-3'].join(' ')}>
              {clauses.get(node.id)}
            </span>

            <button
              onClick={() => requestFocus(node.id)}
              className={[
                'min-w-0 flex-1 text-left font-serif text-[14px] leading-snug line-clamp-2 md:line-clamp-1',
                node.state === 'decided' ? 'text-ink' : 'text-ink-2',
                abandoned ? 'line-through decoration-1' : '',
              ].join(' ')}
            >
              {node.question}
            </button>

            {nodeFlags?.atRisk && (
              <span className="shrink-0 font-mono text-[8px] uppercase tracking-[0.12em] text-stamp">
                at risk
              </span>
            )}
            {nodeData?.stale && (
              <span className="shrink-0 font-mono text-[8px] uppercase tracking-[0.12em] text-stamp">
                stale
              </span>
            )}
            {nodeFlags?.premature && (
              <span className="shrink-0 font-mono text-[8px] uppercase tracking-[0.12em] text-ink-3">
                premature
              </span>
            )}

            {node.choice && (
              <span className="max-w-44 shrink-0 truncate font-mono text-[9px] uppercase tracking-[0.08em] text-stamp">
                {node.choice}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
