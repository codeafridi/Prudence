import { useEffect } from 'react'
import { Canvas } from './canvas/Canvas'
import { countNodes } from './model/ops'
import { Inspector } from './panels/Inspector'
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
  const openSettings = useStore((s) => s.openSettings)
  const activeProvider =
    useStore((s) => s.project.providers.find((p) => p.id === s.activeProviderId)) ??
    useStore((s) => s.project.providers[0])

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

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <span className="text-sm font-semibold tracking-wide text-white">Prudence</span>
        <span className="truncate text-xs text-white/40">{project.goal}</span>
        <span className="ml-auto text-[11px] text-white/30">
          {countNodes(project.root)} nodes
        </span>
        <button
          onClick={openSettings}
          className="max-w-48 truncate rounded border border-white/10 px-2 py-1 text-[11px] text-white/60 hover:border-white/25 hover:text-white"
          title="Model settings"
        >
          {activeProvider ? activeProvider.label : 'no model'}
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
        <Inspector />
      </main>
      <Settings />
    </div>
  )
}
