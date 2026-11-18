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

  const provider =
    useStore((s) => s.project.providers.find((p) => p.id === s.activeProviderId)) ??
    useStore((s) => s.project.providers[0])

  const findings = useMemo(() => lint(project), [project])

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

  const tab = (active: boolean) =>
    [
      'px-3 py-1.5 text-[11px]',
      active ? 'border-b border-white/40 text-white' : 'text-white/40 hover:text-white/70',
    ].join(' ')

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <span className="text-sm font-semibold tracking-wide text-white">Prudence</span>
        <GoalField />
        <div className="ml-auto flex overflow-hidden rounded border border-white/10 text-[11px]">
          {(['canvas', 'outline'] as const).map((option) => (
            <button
              key={option}
              onClick={() => setView(option)}
              className={view === option ? 'bg-white/10 px-2 py-1 text-white' : 'px-2 py-1 text-white/40 hover:text-white/70'}
            >
              {option}
            </button>
          ))}
        </div>
        <button
          onClick={() => setExamples(true)}
          className="rounded border border-white/10 px-2 py-1 text-[11px] text-white/50 hover:border-white/25 hover:text-white"
          title="Load a starting tree"
        >
          examples
        </button>
        <button
          onClick={() => setFinder(true)}
          className="rounded border border-white/10 px-2 py-1 text-[11px] text-white/50 hover:border-white/25 hover:text-white"
          title="Find a decision (Ctrl/Cmd+K)"
        >
          find
        </button>
        <span className="text-[11px] text-white/30">{countNodes(project.root)} nodes</span>
        <button
          onClick={openSettings}
          className="max-w-48 truncate rounded border border-white/10 px-2 py-1 text-[11px] text-white/60 hover:border-white/25 hover:text-white"
          title="Model settings"
        >
          {provider ? provider.label : 'no model'}
        </button>
        <button
          onClick={undo}
          disabled={!canUndo}
          className="rounded border border-white/10 px-2 py-1 text-[11px] text-white/60 hover:border-white/25 hover:text-white disabled:opacity-25"
        >
          Undo
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="rounded border border-white/10 px-2 py-1 text-[11px] text-white/60 hover:border-white/25 hover:text-white disabled:opacity-25"
        >
          Redo
        </button>
        <button
          onClick={tidy}
          className="rounded border border-white/10 px-2 py-1 text-[11px] text-white/60 hover:border-white/25 hover:text-white"
        >
          Tidy
        </button>
      </header>

      {fromShared && (
        <div className="flex items-center gap-2 border-b border-sky-400/20 bg-sky-400/5 px-4 py-1.5 text-[11px] text-sky-200/70">
          <span>Opened from a shared link. Edits stay in this browser — nothing is uploaded.</span>
          <button onClick={dismissShared} className="ml-auto text-sky-200/40 hover:text-sky-100">
            dismiss
          </button>
        </div>
      )}

      <main className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          {view === 'canvas' ? <Canvas /> : <Outline />}
          {!hydrated && (
            <div className="absolute inset-x-0 bottom-3 text-center text-[11px] text-white/30">
              loading…
            </div>
          )}
        </div>

        <div className="flex w-80 shrink-0 flex-col border-l border-white/10 bg-[#0e0e11]">
          <div className="flex border-b border-white/10">
            <button className={tab(panel === 'node')} onClick={() => setPanel('node')}>
              Node
            </button>
            <button className={tab(panel === 'review')} onClick={() => setPanel('review')}>
              Review
              {findings.length > 0 && (
                <span className="ml-1 rounded bg-amber-400/15 px-1 text-[10px] text-amber-300">
                  {findings.length}
                </span>
              )}
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
      placeholder="what are you deciding about?  (sent with every AI call)"
      className="min-w-0 flex-1 truncate border-0 bg-transparent text-xs text-white/50 outline-none placeholder:text-white/20 focus:text-white/80"
    />
  )
}
