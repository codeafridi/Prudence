import { useEffect, useMemo, useRef, useState } from 'react'
import { searchNodes } from '../model/search'
import type { Decision } from '../model/types'
import { useStore } from '../state/store'

/** Cmd/Ctrl+K — jump to a node by question or by the option you chose. */
export function Finder() {
  const open = useStore((s) => s.finderOpen)
  const setFinder = useStore((s) => s.setFinder)
  const root = useStore((s) => s.project.root)
  const focus = useStore((s) => s.requestFocus)

  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => searchNodes(root, query), [root, query])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setIndex(0)
    // focus after the overlay mounts
    const timer = setTimeout(() => inputRef.current?.focus(), 10)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => setIndex(0), [query])

  if (!open) return null

  const choose = (node: Decision | undefined) => {
    if (!node) return
    focus(node.id)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[12vh]"
      onClick={() => setFinder(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-line bg-panel shadow-[0_24px_64px_rgba(0,0,0,0.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setFinder(false)
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setIndex((i) => Math.min(i + 1, results.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setIndex((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              choose(results[index])
            }
          }}
          placeholder="Jump to a decision…  (↑↓ to move, Enter to open)"
          className="w-full border-b border-line bg-transparent px-3 py-2.5 text-[13px] text-ink outline-none placeholder:text-ink-3/70"
        />

        <ul className="max-h-72 overflow-y-auto p-1">
          {results.length === 0 && (
            <li className="px-2 py-3 text-[11px] text-ink-3">nothing matches</li>
          )}
          {results.map((node, i) => (
            <li key={node.id}>
              <button
                onClick={() => choose(node)}
                onMouseEnter={() => setIndex(i)}
                className={[
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px]',
                  i === index ? 'bg-accent/10 text-ink' : 'text-ink-2',
                ].join(' ')}
              >
                <StateDot state={node.state} />
                <span className="min-w-0 flex-1 truncate">{node.question}</span>
                {node.choice && (
                  <span className="shrink-0 truncate text-[10px] text-accent/70">
                    → {node.choice}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function StateDot({ state }: { state: Decision['state'] }) {
  const colour: Record<string, string> = {
    open: 'bg-ink-3',
    asked: 'bg-amber-400',
    decided: 'bg-accent',
    parked: 'bg-slate-500',
  }
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${colour[state]}`} />
}
