import { useEffect, useMemo, useState } from 'react'
import { Canvas } from './canvas/Canvas'
import { lint } from './model/lint'
import { clauseNumbers } from './model/numbering'
import type { Decision } from './model/types'
import { downloadRecord } from './export/export.ts'
import { Examples } from './panels/Examples'
import { Finder } from './panels/Finder'
import { Inspector } from './panels/Inspector'
import { Outline } from './panels/Outline'
import { Review } from './panels/Review'
import { Settings } from './panels/Settings'
import { useStore } from './state/store'

export function App() {
  const project = useStore((s) => s.project)
  const hydrated = useStore((s) => s.hydrated)
  const hydrate = useStore((s) => s.hydrate)
  const tidy = useStore((s) => s.tidy)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const panel = useStore((s) => s.panel)
  const setPanel = useStore((s) => s.setPanel)
  const openSettings = useStore((s) => s.openSettings)
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const setFinder = useStore((s) => s.setFinder)
  const setExamples = useStore((s) => s.setExamples)
  const fromShared = useStore((s) => s.fromShared)
  const dismissShared = useStore((s) => s.dismissShared)
  const sheetRequested = useStore((s) => s.sheetOpen)
  const setSheet = useStore((s) => s.setSheet)
  const select = useStore((s) => s.select)
  const selectedId = useStore((s) => s.selectedId)

  // One selector, one hook: `?? useStore(...)` made the second call conditional, so adding the
  // first provider changed the hook count mid-render and blanked the app.
  const provider = useStore(
    (s) => s.project.providers.find((p) => p.id === s.activeProviderId) ?? s.project.providers[0],
  )

  const findings = useMemo(() => lint(project), [project])
  const clauses = useMemo(() => clauseNumbers(project.root), [project])
  const clause = selectedId ? clauses.get(selectedId) : undefined
  const stats = useMemo(() => {
    let entries = 0
    let filed = 0
    const walk = (node: Decision) => {
      entries += 1
      if (node.state === 'decided') filed += 1
      node.children.forEach(walk)
    }
    walk(project.root)
    return { entries, filed }
  }, [project])

  // On a phone the marginalia is a bottom sheet: visible when there is something to show, never
  // eating the canvas otherwise. Desktop keeps the fixed column (`md:` overrides).
  const sheetOpen = panel === 'review' || sheetRequested

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setFinder(true)
        return
      }
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, setFinder])

  // Toolbar entries are text commands on a form, not buttons in a chrome bar.
  const cmd =
    'shrink-0 px-1 text-[9px] uppercase tracking-[0.16em] text-ink-3 transition-colors hover:text-ink disabled:opacity-30 disabled:hover:text-ink-3'

  const actions = (
    <>
      {(['canvas', 'outline'] as const).map((option) => (
        <button
          key={option}
          onClick={() => setView(option)}
          className={[cmd, view === option ? '!text-ink underline underline-offset-4' : ''].join(' ')}
        >
          {option}
        </button>
      ))}
      <span className="mx-1 h-3 w-px shrink-0 bg-rule" />
      <button onClick={() => setPanel('review')} className={cmd}>
        review
        {findings.length > 0 && <span className="ml-1 text-stamp">{findings.length}</span>}
      </button>
      <button onClick={() => setFinder(true)} className={cmd} title="Find a clause (Ctrl/Cmd+K)">
        find
      </button>
      <button onClick={() => setExamples(true)} className={cmd} title="Load a starting record">
        examples
      </button>
      <span className="mx-1 h-3 w-px shrink-0 bg-rule" />
      <button onClick={undo} disabled={!canUndo} className={cmd} title="Undo (Ctrl/Cmd+Z)">
        undo
      </button>
      <button onClick={redo} disabled={!canRedo} className={cmd} title="Redo (Ctrl/Cmd+Shift+Z)">
        redo
      </button>
      <button onClick={tidy} className={cmd} title="Lay the record out again">
        tidy
      </button>
      <button
        onClick={() => void downloadRecord(project)}
        className={cmd}
        title="Save a standalone, printable copy of this record"
      >
        export
      </button>
    </>
  )

  return (
    <div className="flex h-full flex-col bg-desk md:p-6">
      <div className="relative flex min-h-0 flex-1 flex-col bg-sheet shadow-[0_1px_0_#1b1a1714,0_18px_50px_#1b1a1712]">
        <header className="flex shrink-0 flex-col gap-1.5 border-b-[1.5px] border-ink px-4 pb-2.5 pt-3 md:grid md:grid-cols-[210px_1fr_260px] md:items-end md:gap-3 md:px-9 md:pb-3">
          {/* phone: wordmark and model share the first line, the subject gets its own */}
          <div className="flex items-baseline justify-between gap-3 md:block">
            <div className="min-w-0">
              <div className="font-mono text-[12px] font-semibold uppercase tracking-[0.3em] text-ink md:text-[13px]">
                Prudence
              </div>
              <div className="label mt-1.5 hidden md:block">Decision record · form 1</div>
            </div>
            <button
              onClick={openSettings}
              className="flex shrink-0 items-baseline gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3 transition-colors hover:text-ink md:hidden"
              title="Model settings"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${provider ? 'bg-stamp' : 'bg-ink-3'}`} />
              <span className="max-w-24 truncate">{provider ? provider.label : 'no model'}</span>
            </button>
          </div>

          <div className="min-w-0 text-center md:pb-0.5">
            <div className="label mb-1 hidden md:block">Subject of record</div>
            <GoalField />
          </div>

          <div className="hidden items-end justify-end gap-3 text-right md:flex">
            <div>
              <div className="label">
                {project.createdAt
                  ? `Opened ${new Date(project.createdAt).toISOString().slice(0, 10)}`
                  : 'Specimen · demo tree'}
              </div>
              <div className="label mt-1.5 !text-ink-2">
                Entries {stats.entries} · Filed {stats.filed}
              </div>
            </div>
          </div>
        </header>

        <div className="no-scrollbar flex shrink-0 items-center gap-1 overflow-x-auto border-b border-rule px-4 py-1.5 md:px-9">
          {actions}
          <button
            onClick={openSettings}
            className="ml-auto hidden shrink-0 items-center gap-1.5 text-[9px] uppercase tracking-[0.14em] text-ink-3 transition-colors hover:text-ink md:flex"
            title="Model settings"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${provider ? 'bg-stamp' : 'bg-ink-3'}`} />
            <span className="max-w-40 truncate">{provider ? provider.label : 'no model'}</span>
          </button>
        </div>

        {fromShared && (
          <div className="flex shrink-0 items-center gap-2 border-b border-rule bg-[#efe9da] px-4 py-1.5 text-[11px] text-ink-2 md:px-9">
            <span className="min-w-0">Opened from a shared link. Edits stay in this browser.</span>
            <button
              onClick={dismissShared}
              className="ml-auto shrink-0 text-[9px] uppercase tracking-[0.14em] text-ink-3 hover:text-ink"
            >
              dismiss
            </button>
          </div>
        )}

        <main className="relative flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="relative min-w-0 flex-1">
            {view === 'canvas' ? <Canvas /> : <Outline />}
            {!hydrated && (
              <div className="absolute inset-x-0 bottom-3 text-center text-[11px] italic text-ink-3">
                loading…
              </div>
            )}
          </div>

          <aside
            className={[
              sheetOpen ? 'flex' : 'hidden md:flex',
              // phone: a real sibling of the canvas, so the canvas shrinks and refits instead of
              // hiding clauses behind an overlay. Desktop: the annotated margin.
              'h-[58vh] shrink-0 flex-col overflow-hidden border-t border-rule bg-sheet',
              'md:h-auto md:w-[344px] md:border-t-0 md:border-l',
            ].join(' ')}
          >
            <div className="flex shrink-0 items-center gap-3 border-b border-ink px-4 pb-1.5 pt-3 md:px-5">
              {(
                [
                  ['node', `Notes${clause ? ` on ${clause}` : ''}`],
                  ['review', 'Review'],
                ] as const
              ).flatMap(([key, text], i) => [
                ...(i > 0
                  ? [
                      <span
                        key={`sep-${key}`}
                        aria-hidden
                        className="px-1 text-[8px] text-ink-3/60"
                      >
                        ·
                      </span>,
                    ]
                  : []),
                <button
                  key={key}
                  className={[
                    'text-[9px] uppercase tracking-[0.16em] transition-colors',
                    panel === key ? 'text-stamp' : 'text-ink-3 hover:text-ink',
                  ].join(' ')}
                  onClick={() => setPanel(key)}
                >
                  {text}
                  {key === 'review' && findings.length > 0 && (
                    <span className="ml-1">({findings.length})</span>
                  )}
                </button>,
              ])}
              <span className="mx-auto h-px w-8 bg-rule md:hidden" />
              <button
                onClick={() => {
                  select(null)
                  setSheet(false)
                  setPanel('node')
                }}
                className="ml-auto text-[12px] text-ink-3 hover:text-ink md:hidden"
                title="Hide panel"
              >
                ×
              </button>
            </div>
            {panel === 'node' ? <Inspector /> : <Review />}
          </aside>
        </main>

        <footer className="hidden shrink-0 items-center justify-between border-t border-rule px-9 py-1.5 md:flex">
          <span className="label">No account · no server · keys stay in this browser</span>
          <span className="label">Sheet 1 of 1</span>
        </footer>
      </div>

      <Settings />
      <Examples />
      <Finder />
    </div>
  )
}

function GoalField() {
  const goal = useStore((s) => s.project.goal)
  const setGoal = useStore((s) => s.setGoal)
  const [value, setValue] = useState(goal)

  useEffect(() => setValue(goal), [goal])

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => setGoal(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      placeholder="what are you deciding about?"
      className="w-full min-w-0 truncate border-0 bg-transparent text-center font-serif text-[15px] italic text-ink outline-none placeholder:not-italic placeholder:text-ink-3 md:text-[21px]"
    />
  )
}
