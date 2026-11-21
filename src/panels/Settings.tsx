import { useEffect, useState } from 'react'
import type { Provider } from '../model/types'
import { useStore } from '../state/store'

type Draft = {
  id: string
  label: string
  baseUrl: string
  model: string
  tier: 'cheap' | 'deep'
  apiKey: string
}

/** Endpoints that answer browser requests and speak /chat/completions. Model ids are editable. */
const PRESETS: { label: string; baseUrl: string; model: string }[] = [
  { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openrouter/auto' },
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  { label: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-large-latest' },
  {
    label: 'Together',
    baseUrl: 'https://api.together.xyz/v1',
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  },
  {
    label: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.0-flash',
  },
]

const BLANK: Draft = {
  id: '',
  label: '',
  baseUrl: 'https://openrouter.ai/api/v1',
  model: '',
  tier: 'cheap',
  apiKey: '',
}

export function Settings() {
  const open = useStore((s) => s.settingsOpen)
  const close = useStore((s) => s.closeSettings)
  const providers = useStore((s) => s.project.providers)
  const activeProviderId = useStore((s) => s.activeProviderId)
  const projectName = useStore((s) => s.project.name)
  const setName = useStore((s) => s.setName)
  const newProject = useStore((s) => s.newProject)
  const saveProvider = useStore((s) => s.saveProvider)
  const removeProvider = useStore((s) => s.removeProvider)
  const setActiveProvider = useStore((s) => s.setActiveProvider)

  const [draft, setDraft] = useState<Draft>(BLANK)

  useEffect(() => {
    if (!open) return
    const current = providers.find((p) => p.id === activeProviderId) ?? providers[0]
    setDraft(current ? { ...current, apiKey: '' } : { ...BLANK })
  }, [open, providers, activeProviderId])

  if (!open) return null

  const editing = draft.id !== ''

  const save = () => {
    if (!draft.baseUrl.trim() || !draft.model.trim()) return
    const provider: Provider = {
      id: draft.id || crypto.randomUUID(),
      label: draft.label.trim() || draft.model.trim(),
      baseUrl: draft.baseUrl.trim(),
      model: draft.model.trim(),
      tier: draft.tier,
    }
    saveProvider(provider, draft.apiKey.trim() || undefined)
    setDraft({ ...BLANK })
    close()
  }

  const field = 'field'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b1a1740] p-4">
      <div className="w-full max-w-md border border-ink bg-sheet shadow-[0_18px_50px_#1b1a1733]">
        <div className="flex items-baseline justify-between border-b-[1.5px] border-ink px-4 py-3">
          <h2 className="font-serif text-[18px] italic text-ink">The model</h2>
          <button
            onClick={close}
            className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-3 transition-colors hover:text-ink"
          >
            close
          </button>
        </div>
        <p className="border-b border-rule px-4 py-2.5 font-serif text-[12px] leading-[1.55] text-ink-3">
          Any OpenAI-compatible endpoint. The key stays in this browser — it is never written to the
          project or an export. Leave it blank to keep a saved key.
        </p>

        <div className="flex items-end gap-2 px-4 pt-3">
          <label className="block min-w-0 flex-1">
            <span className="label">Project</span>
            <input
              className="rule-field mt-1 font-serif"
              defaultValue={projectName}
              key={projectName}
              onBlur={(e) => setName(e.target.value)}
            />
          </label>
          <button
            onClick={() => {
              if (confirm('Start over? This project stays in no backup — export it first.')) newProject()
            }}
            className="mb-0.5 font-mono text-[8.5px] uppercase tracking-[0.14em] text-stamp/70 transition-colors hover:text-stamp"
          >
            Start over
          </button>
        </div>

        {providers.length > 0 && (
          <ul className="mt-3 border-t border-rule px-4">
            {providers.map((p) => (
              <li key={p.id} className="flex items-baseline gap-2 border-b border-rule-soft py-1.5 last:border-0">
                <input
                  type="radio"
                  checked={(activeProviderId ?? providers[0].id) === p.id}
                  onChange={() => setActiveProvider(p.id)}
                  title="Use this provider"
                />
                <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{p.label}</span>
                <span className="shrink-0 rounded bg-white/5 px-1 text-[9px] uppercase tracking-wider text-ink-3">
                  {p.tier}
                </span>
                <button
                  onClick={() => setDraft({ ...p, apiKey: '' })}
                  className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-ink-3 transition-colors hover:text-ink"
                >
                  edit
                </button>
                <button
                  onClick={() => removeProvider(p.id)}
                  className="font-mono text-[10px] text-ink-3 transition-colors hover:text-stamp"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2.5 px-4 pb-4 pt-4">
          <label className="block">
            <span className="label">Known endpoint</span>
            <select
              className={field}
              value=""
              onChange={(e) => {
                const preset = PRESETS.find((p) => p.label === e.target.value)
                if (!preset) return
                setDraft({
                  ...draft,
                  label: preset.label,
                  baseUrl: preset.baseUrl,
                  model: preset.model,
                })
              }}
            >
              <option value="">choose one, then paste a key…</option>
              {PRESETS.map((p) => (
                <option key={p.label} value={p.label}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="label">Label</span>
              <input
                className={field}
                value={draft.label}
                placeholder="OpenRouter · sonnet"
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="label">Tier</span>
              <select
                className={field}
                value={draft.tier}
                onChange={(e) => setDraft({ ...draft, tier: e.target.value as 'cheap' | 'deep' })}
              >
                <option value="cheap">cheap</option>
                <option value="deep">deep</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="label">Base URL</span>
            <input
              className={field}
              value={draft.baseUrl}
              onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
            />
          </label>

          <label className="block">
            <span className="label">Model</span>
            <input
              className={field}
              value={draft.model}
              placeholder="provider/model-id"
              onChange={(e) => setDraft({ ...draft, model: e.target.value })}
            />
          </label>

          <label className="block">
            <span className="label">
              API key {editing ? '(leave blank to keep)' : ''}
            </span>
            <input
              className={field}
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={draft.apiKey}
              onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
            />
          </label>
        </div>

        <div className="flex items-center gap-3 border-t border-rule px-4 py-3">
          <button
            onClick={save}
            disabled={!draft.baseUrl.trim() || !draft.model.trim()}
            className="border border-ink bg-ink px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-sheet transition-colors hover:bg-ink/90 disabled:opacity-30"
          >
            {editing ? 'Save' : 'Add model'}
          </button>
          {editing && (
            <button
              onClick={() => setDraft({ ...BLANK })}
              className="px-2 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3 transition-colors hover:text-ink"
            >
              New
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
