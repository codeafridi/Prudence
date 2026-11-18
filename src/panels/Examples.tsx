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
      <div className="w-full max-w-xl rounded-lg border border-white/10 bg-[#131317] p-5 shadow-2xl">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-white">Start from a decision you recognise</h2>
          <button
            onClick={() => setExamples(false)}
            className="text-xs text-white/40 hover:text-white"
          >
            keep what's here
          </button>
        </div>
        <p className="mt-1 text-[12px] leading-snug text-white/40">
          Each one is already half-decided, including a parked branch and one you didn't take. Edit,
          delete, or ignore it — nothing is sent anywhere.
        </p>

        <ul className="mt-4 space-y-2">
          {SEEDS.map((seed) => (
            <li key={seed.id}>
              <button
                onClick={() => loadSeed(seed)}
                className="w-full rounded border border-white/10 bg-black/20 px-3 py-2 text-left hover:border-white/30"
              >
                <span className="block text-[13px] text-white/85">{seed.name}</span>
                <span className="block truncate text-[11px] text-white/40">{seed.goal}</span>
                <span className="mt-1 block text-[11px] text-white/30">{seed.blurb}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
