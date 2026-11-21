import { SEEDS } from '../seeds'
import { useStore } from '../state/store'

/** First-run chooser. A blank canvas is the most expensive thing you can show a new user. */
export function Examples() {
  const open = useStore((s) => s.examplesOpen)
  const setExamples = useStore((s) => s.setExamples)
  const loadSeed = useStore((s) => s.loadSeed)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xl rounded-xl border border-line bg-panel p-5 shadow-[0_24px_64px_rgba(0,0,0,0.7)]">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[13px] font-semibold tracking-tight text-ink">
            Start from a decision you recognise
          </h2>
          <button
            onClick={() => setExamples(false)}
            className="text-[11px] text-ink-3 transition-colors hover:text-ink"
          >
            keep what's here
          </button>
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-3">
          Each one is already half-decided, including a parked branch and one you didn't take. Edit,
          delete, or ignore it — nothing is sent anywhere.
        </p>

        <ul className="mt-4 space-y-2">
          {SEEDS.map((seed) => (
            <li key={seed.id}>
              <button
                onClick={() => loadSeed(seed)}
                className="w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
              >
                <span className="block text-[13px] text-ink">{seed.name}</span>
                <span className="block truncate text-[11px] text-ink-3">{seed.goal}</span>
                <span className="mt-1 block text-[11px] leading-relaxed text-ink-3/80">
                  {seed.blurb}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
