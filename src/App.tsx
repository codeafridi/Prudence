import { useEffect, useMemo, useState } from 'react'
import { Canvas } from './canvas/Canvas'
import { lint } from './model/lint'
import { countNodes } from './model/ops'
import { Inspector } from './panels/Inspector'
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

  const provider =
    useStore((s) => s.project.providers.find((p) => p.id === s.activeProviderId)) ??
    useStore((s) => s.project.providers[0])

  const findings = useMemo(() => lint(project), [project])

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

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
        <span className="ml-auto text-[11px] text-white/30">{countNodes(project.root)} nodes</span>
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

      <main className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <Canvas />
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
