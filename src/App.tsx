import { Canvas } from './canvas/Canvas'
import { useStore } from './state/store'

export function App() {
  const goal = useStore((s) => s.project.goal)

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-baseline gap-3 border-b border-white/10 px-4 py-3">
        <span className="text-sm font-semibold tracking-wide text-white">Prudence</span>
        <span className="truncate text-xs text-white/50">{goal}</span>
        <span className="ml-auto rounded border border-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/40">
          scaffold
        </span>
      </header>
      <main className="min-h-0 flex-1">
        <Canvas />
      </main>
    </div>
  )
}
