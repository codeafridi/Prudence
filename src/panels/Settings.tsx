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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-line bg-panel p-4 text-[13px] shadow-[0_24px_64px_rgba(0,0,0,0.7)]">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[13px] font-semibold tracking-tight text-ink">Model</h2>
          <button onClick={close} className="text-[11px] text-ink-3 transition-colors hover:text-ink">
            close
          </button>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-3">
          Any OpenAI-compatible endpoint. The key stays in this browser — it is never written to the
          project or an export. Leave it blank to keep a saved key.
        </p>

        <div className="mt-3 flex items-end gap-2">
          <label className="block min-w-0 flex-1">
            <span className="label">Project</span>
            <input
              className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs outline-none focus:border-white/30"
              defaultValue={projectName}
              key={projectName}
              onBlur={(e) => setName(e.target.value)}
            />
          </label>
          <button
            onClick={() => {
              if (confirm('Start over? This project stays in no backup — export it first.')) newProject()
            }}
            className="h-7 rounded-md px-2 text-[11px] text-red-400/60 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            Start over
          </button>
        </div>

        {providers.length > 0 && (
          <ul className="mt-3 space-y-1">
            {providers.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-white/[0.03]">
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
                  className="text-[11px] text-ink-3 transition-colors hover:text-ink"
                >
                  edit
                </button>
                <button
                  onClick={() => removeProvider(p.id)}
                  className="text-[11px] text-ink-3/60 transition-colors hover:text-red-400"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 space-y-2">
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

        <div className="mt-4 flex gap-2">
          <button
            onClick={save}
            disabled={!draft.baseUrl.trim() || !draft.model.trim()}
            className="h-7 rounded-md bg-accent px-3 text-[11px] font-medium text-[#06231a] transition-colors hover:bg-accent/90 disabled:opacity-30"
          >
            {editing ? 'Save' : 'Add model'}
          </button>
          {editing && (
            <button
              onClick={() => setDraft({ ...BLANK })}
              className="h-7 rounded-md px-3 text-[11px] text-ink-2 transition-colors hover:bg-white/5 hover:text-ink"
            >
              New
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
