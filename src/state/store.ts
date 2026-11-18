import { create } from 'zustand'
import { askVerdict } from '../ai/client'
import { buildAsk } from '../ai/prompts'
import { demoProject } from '../demo'
import { getKey, setKey } from '../lib/keys'
import { loadProject, scheduleSave } from '../lib/storage'
import { contextHash } from '../model/hash'
import {
  addChild,
  canRemoveOption,
  clearPositions,
  findNode,
  newDecision,
  removeNode,
  updateNode,
} from '../model/ops'
import type { Decision, Project, Provider, Verdict, Via } from '../model/types'

/**
 * The only writer of the tree. Every mutation snapshots the previous project so undo stays
 * store-level (spec §12) — cheap, because ops.ts only copies the changed path.
 * Nothing outside this file may hold a copy of tree data.
 */

const UNDO_DEPTH = 50

type Store = {
  project: Project
  selectedId: string | null
  past: Project[]
  future: Project[]
  hydrated: boolean

  activeProviderId: string | null
  settingsOpen: boolean
  askingId: string | null
  askError: string | null

  hydrate: () => Promise<void>
  select: (id: string | null) => void
  openSettings: () => void
  closeSettings: () => void
  saveProvider: (provider: Provider, apiKey?: string) => void
  removeProvider: (id: string) => void
  setActiveProvider: (id: string) => void
  ask: (nodeId: string) => Promise<void>

  rename: (id: string, question: string) => void
  addOption: (id: string, option: string) => void
  removeOption: (id: string, option: string) => void
  createChild: (parentId: string, via: Via) => string
  remove: (id: string) => void
  setPos: (id: string, pos: { x: number; y: number }) => void
  tidy: () => void

  undo: () => void
  redo: () => void
}

export const useStore = create<Store>((set, get) => {
  /** All writes go through here: snapshot, save, then swap the project. */
  const commitProject = (next: Project, select?: string | null): void => {
    const s = get()
    const project: Project = { ...next, updatedAt: Date.now() }
    if (s.hydrated) scheduleSave(project)

    set({
      project,
      past: [...s.past, s.project].slice(-UNDO_DEPTH),
      future: [],
      ...(select === undefined ? {} : { selectedId: select }),
    })
  }

  const commit = (root: Decision, select?: string | null): void =>
    commitProject({ ...get().project, root }, select)

  return {
    project: demoProject,
    selectedId: demoProject.root.id,
    past: [],
    future: [],
    hydrated: false,
    activeProviderId: null,
    settingsOpen: false,
    askingId: null,
    askError: null,

    hydrate: async () => {
      const stored = await loadProject()
      if (stored) set({ project: stored, selectedId: stored.root.id, past: [], future: [] })
      set({ hydrated: true })
    },

    select: (id) => set({ selectedId: id }),

    rename: (id, question) => {
      const trimmed = question.trim()
      if (!trimmed) return
      commit(updateNode(get().project.root, id, (n) => ({ ...n, question: trimmed })))
    },

    addOption: (id, option) => {
      const trimmed = option.trim()
      if (!trimmed) return
      commit(
        updateNode(get().project.root, id, (n) =>
          n.options.includes(trimmed) ? n : { ...n, options: [...n.options, trimmed] },
        ),
      )
    },

    removeOption: (id, option) => {
      const node = findNode(get().project.root, id)
      if (!node || !canRemoveOption(node, option)) return
      commit(
        updateNode(get().project.root, id, (n) => ({
          ...n,
          options: n.options.filter((o) => o !== option),
        })),
      )
    },

    createChild: (parentId, via) => {
      const child = newDecision(via)
      commit(addChild(get().project.root, parentId, child), child.id)
      return child.id
    },

    remove: (id) => {
      const s = get()
      if (s.project.root.id === id) return
      const root = removeNode(s.project.root, id)
      const survives = s.selectedId !== null && findNode(root, s.selectedId) !== undefined
      commit(root, survives ? undefined : null)
    },

    setPos: (id, pos) => {
      commit(updateNode(get().project.root, id, (n) => ({ ...n, pos })))
    },

    tidy: () => commit(clearPositions(get().project.root)),

    undo: () => {
      const s = get()
      const previous = s.past.at(-1)
      if (!previous) return
      if (s.hydrated) scheduleSave(previous)
      set({
        project: previous,
        past: s.past.slice(0, -1),
        future: [s.project, ...s.future].slice(0, UNDO_DEPTH),
      })
    },

    redo: () => {
      const s = get()
      const next = s.future[0]
      if (!next) return
      if (s.hydrated) scheduleSave(next)
      set({
        project: next,
        past: [...s.past, s.project].slice(-UNDO_DEPTH),
        future: s.future.slice(1),
      })
    },

    openSettings: () => set({ settingsOpen: true }),
    closeSettings: () => set({ settingsOpen: false }),

    saveProvider: (provider, apiKey) => {
      if (apiKey !== undefined) setKey(provider.id, apiKey)

      const s = get()
      const exists = s.project.providers.some((p) => p.id === provider.id)
      const providers = exists
        ? s.project.providers.map((p) => (p.id === provider.id ? provider : p))
        : [...s.project.providers, provider]

      commitProject({ ...s.project, providers })
      if (!get().activeProviderId) set({ activeProviderId: provider.id })
    },

    removeProvider: (id) => {
      const s = get()
      setKey(id, '')
      set({
        project: { ...s.project, providers: s.project.providers.filter((p) => p.id !== id) },
        activeProviderId: s.activeProviderId === id ? null : s.activeProviderId,
      })
    },

    setActiveProvider: (id) => set({ activeProviderId: id }),

    ask: async (nodeId) => {
      const s = get()
      const node = findNode(s.project.root, nodeId)
      if (!node) return

      const provider =
        s.project.providers.find((p) => p.id === s.activeProviderId) ?? s.project.providers[0]

      if (!provider) {
        set({ askError: 'No model configured — open Settings.' })
        return
      }

      const apiKey = getKey(provider.id)
      if (!apiKey) {
        set({ askError: `No API key saved for ${provider.label || provider.model}.` })
        return
      }

      set({ askingId: nodeId, askError: null })

      try {
        const result = await askVerdict({
          provider: { baseUrl: provider.baseUrl, model: provider.model, apiKey },
          messages: buildAsk(s.project, node),
          options: node.options,
        })

        // The tree may have changed while the request was in flight: re-read before writing.
        const current = get().project
        if (!findNode(current.root, nodeId)) return

        const verdict: Verdict = {
          ...result.verdict,
          contextHash: contextHash(current, nodeId),
          model: result.model,
          tokens: result.tokens,
          at: Date.now(),
        }

        commit(
          updateNode(current.root, nodeId, (n) => ({
            ...n,
            state: n.state === 'open' ? 'asked' : n.state,
            verdicts: [verdict, ...n.verdicts],
          })),
        )
      } catch (error) {
        set({ askError: error instanceof Error ? error.message : String(error) })
      } finally {
        set({ askingId: null })
      }
    },
  }
})
