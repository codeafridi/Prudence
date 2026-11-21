import { SEEDS } from '../seeds'
import { useStore } from '../state/store'

/** First-run chooser. A blank sheet is the most expensive thing you can show a new user. */
export function Examples() {
  const open = useStore((s) => s.examplesOpen)
  const setExamples = useStore((s) => s.setExamples)
  const loadSeed = useStore((s) => s.loadSeed)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b1a1740] p-4">
      <div className="w-full max-w-xl border border-ink bg-sheet shadow-[0_18px_50px_#1b1a1733]">
        <div className="flex items-baseline justify-between border-b-[1.5px] border-ink px-5 py-3">
          <h2 className="font-serif text-[19px] italic text-ink">
            Start from a decision you recognise
          </h2>
          <button
            onClick={() => setExamples(false)}
            className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-3 transition-colors hover:text-ink"
          >
            keep what's here
          </button>
        </div>

        <p className="border-b border-rule px-5 py-2.5 font-serif text-[12.5px] leading-[1.55] text-ink-3">
          Each one is already half-decided, including a parked branch and one you didn't take. Edit,
          delete, or ignore it — nothing is sent anywhere.
        </p>

        <ul className="px-5 py-3">
          {SEEDS.map((seed) => (
            <li key={seed.id}>
              <button
                onClick={() => loadSeed(seed)}
                className="w-full border-b border-rule-soft py-2.5 text-left transition-colors last:border-0 hover:text-stamp"
              >
                <span className="block font-serif text-[15px] text-ink">{seed.name}</span>
                <span className="block truncate font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">
                  {seed.goal}
                </span>
                <span className="mt-1 block font-serif text-[12px] leading-[1.5] text-ink-2">
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
