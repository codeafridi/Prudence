import { create } from 'zustand'
import { demoProject } from '../demo'
import { loadProject, scheduleSave } from '../lib/storage'
import {
  addChild,
  canRemoveOption,
  clearPositions,
  findNode,
  newDecision,
  removeNode,
  updateNode,
} from '../model/ops'
import type { Decision, Project, Via } from '../model/types'

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

  hydrate: () => Promise<void>
  select: (id: string | null) => void

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
  /** All writes go through here: snapshot, save, then swap the root. */
  const commit = (root: Decision, select?: string | null): void => {
    const s = get()
    const project: Project = { ...s.project, root, updatedAt: Date.now() }
    if (s.hydrated) scheduleSave(project)

    set({
      project,
      past: [...s.past, s.project].slice(-UNDO_DEPTH),
      future: [],
      ...(select === undefined ? {} : { selectedId: select }),
    })
  }

  return {
    project: demoProject,
    selectedId: demoProject.root.id,
    past: [],
    future: [],
    hydrated: false,

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
  }
})
