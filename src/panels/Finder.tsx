import { useEffect, useMemo, useRef, useState } from 'react'
import { searchNodes } from '../model/search'
import type { Decision } from '../model/types'
import { useStore } from '../state/store'

/** Cmd/Ctrl+K — jump to a clause by its question or by the option you chose. */
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
      className="fixed inset-0 z-50 flex items-start justify-center bg-[#1b1a1740] pt-[12vh]"
      onClick={() => setFinder(false)}
    >
      <div
        className="w-full max-w-lg border border-ink bg-sheet shadow-[0_18px_50px_#1b1a1733]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="label border-b border-ink px-3 py-2">Find a clause</div>
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
          className="w-full border-b border-rule bg-transparent px-3 py-2.5 font-serif text-[15px] text-ink outline-none placeholder:text-ink-3/70"
        />

        <ul className="max-h-72 overflow-y-auto py-1">
          {results.length === 0 && (
            <li className="px-3 py-3 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-3">
              nothing matches
            </li>
          )}
          {results.map((node, i) => (
            <li key={node.id}>
              <button
                onClick={() => choose(node)}
                onMouseEnter={() => setIndex(i)}
                className={[
                  'flex w-full items-baseline gap-2 px-3 py-1.5 text-left',
                  i === index ? 'bg-[#efe9da]' : '',
                ].join(' ')}
              >
                <StateMark state={node.state} />
                <span className="min-w-0 flex-1 truncate font-serif text-[13px] text-ink">
                  {node.question}
                </span>
                {node.choice && (
                  <span className="shrink-0 truncate font-mono text-[9px] uppercase tracking-[0.1em] text-stamp">
                    {node.choice}
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

function StateMark({ state }: { state: Decision['state'] }) {
  const mark: Record<string, string> = {
    open: '○',
    asked: '◔',
    decided: '◉',
    parked: '—',
  }
  return (
    <span className={['shrink-0 font-mono text-[10px]', state === 'decided' ? 'text-stamp' : 'text-ink-3'].join(' ')}>
      {mark[state]}
    </span>
  )
}
