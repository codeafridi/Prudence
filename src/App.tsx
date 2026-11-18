import { useEffect, useMemo, useState } from 'react'
import { Canvas } from './canvas/Canvas'
import { lint } from './model/lint'
import { countNodes } from './model/ops'
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

  const provider =
    useStore((s) => s.project.providers.find((p) => p.id === s.activeProviderId)) ??
    useStore((s) => s.project.providers[0])

  const findings = useMemo(() => lint(project), [project])

  // On a phone the inspector is a bottom sheet: visible when there is something to show,
  // never eating the canvas otherwise. Desktop keeps the fixed column (`md:` overrides).
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

  const chip =
    'shrink-0 rounded border border-white/10 px-2 py-1 text-[11px] text-white/55 hover:border-white/25 hover:text-white disabled:opacity-25'

  const viewToggle = (
    <div className="flex shrink-0 overflow-hidden rounded border border-white/10 text-[11px]">
      {(['canvas', 'outline'] as const).map((option) => (
        <button
          key={option}
          onClick={() => setView(option)}
          className={
            view === option ? 'bg-white/10 px-2 py-1 text-white' : 'px-2 py-1 text-white/40 hover:text-white/70'
          }
        >
          {option}
        </button>
      ))}
    </div>
  )

  const actions = (
    <>
      {viewToggle}
      <button onClick={() => setPanel('review')} className={chip}>
        review
        {findings.length > 0 && <span className="ml-1 text-amber-300">{findings.length}</span>}
      </button>
      <button onClick={() => setFinder(true)} className={chip} title="Find a decision (Ctrl/Cmd+K)">
        find
      </button>
      <button onClick={() => setExamples(true)} className={chip} title="Load a starting tree">
        examples
      </button>
      <button onClick={undo} disabled={!canUndo} className={chip}>
        undo
      </button>
      <button onClick={redo} disabled={!canRedo} className={chip}>
        redo
      </button>
      <button onClick={tidy} className={chip}>
        tidy
      </button>
    </>
  )

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-white/10">
        <div className="flex items-center gap-2 px-3 py-2 md:gap-3 md:px-4 md:py-2.5">
          <span className="shrink-0 text-sm font-semibold tracking-wide text-white">Prudence</span>
          <GoalField />
          <button
            onClick={openSettings}
            className="max-w-24 shrink-0 truncate rounded border border-white/10 px-2 py-1 text-[11px] text-white/60 hover:border-white/25 hover:text-white md:max-w-48"
            title="Model settings"
          >
            {provider ? provider.label : 'no model'}
          </button>
          <div className="hidden items-center gap-2 md:flex">
            {actions}
            <span className="text-[11px] text-white/30">{countNodes(project.root)} nodes</span>
          </div>
        </div>

        {/* phone: one scrollable row of chips instead of a wrapped header */}
        <div className="flex gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:none] md:hidden">
          {actions}
        </div>
      </header>

      {fromShared && (
        <div className="flex items-center gap-2 border-b border-sky-400/20 bg-sky-400/5 px-3 py-1.5 text-[11px] text-sky-200/70">
          <span className="min-w-0">Opened from a shared link. Edits stay in this browser.</span>
          <button onClick={dismissShared} className="ml-auto shrink-0 text-sky-200/40 hover:text-sky-100">
            dismiss
          </button>
        </div>
      )}

      <main className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="relative min-w-0 flex-1">
          {view === 'canvas' ? <Canvas /> : <Outline />}
          {!hydrated && (
            <div className="absolute inset-x-0 bottom-3 text-center text-[11px] text-white/30">
              loading…
            </div>
          )}
        </div>

        <div
          className={[
            sheetOpen ? 'flex' : 'hidden md:flex',
            // phone: a real sibling of the canvas, so the canvas shrinks and refits instead of
            // hiding nodes behind an overlay. Desktop: the usual fixed column.
            'h-[58vh] shrink-0 flex-col overflow-hidden rounded-t-xl border-t border-white/10 bg-[#0e0e11]',
            'md:h-auto md:w-80 md:rounded-none md:border-t-0 md:border-l',
          ].join(' ')}
        >
          <div className="flex items-center border-b border-white/10 px-1">
            <button
              className={[
                'px-3 py-2 text-[11px]',
                panel === 'node' ? 'border-b border-white/40 text-white' : 'text-white/40',
              ].join(' ')}
              onClick={() => setPanel('node')}
            >
              Node
            </button>
            <button
              className={[
                'px-3 py-2 text-[11px]',
                panel === 'review' ? 'border-b border-white/40 text-white' : 'text-white/40',
              ].join(' ')}
              onClick={() => setPanel('review')}
            >
              Review
              {findings.length > 0 && (
                <span className="ml-1 rounded bg-amber-400/15 px-1 text-[10px] text-amber-300">
                  {findings.length}
                </span>
              )}
            </button>
            <span className="mx-auto h-1 w-10 rounded-full bg-white/15 md:hidden" />
            <button
              onClick={() => {
                select(null)
                setSheet(false)
                setPanel('node')
              }}
              className="px-3 py-2 text-[13px] text-white/40 hover:text-white md:hidden"
              title="Hide panel"
            >
              ×
            </button>
          </div>
          {panel === 'node' ? <Inspector /> : <Review />}
        </div>
      </main>

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
      className="min-w-0 flex-1 truncate border-0 bg-transparent text-xs text-white/50 outline-none placeholder:text-white/20 focus:text-white/80"
    />
  )
}
