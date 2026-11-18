import { create } from 'zustand'
import { demoProject } from '../demo'
import type { Project } from '../model/types'

/**
 * In-memory tree store. Every mutation goes through here so undo stays store-level (spec §12).
 * TODO(M1): actions (add/rename/delete/decide), undo stack 50 deep, IndexedDB autosave.
 */
type Store = {
  project: Project
  setProject: (project: Project) => void
}

export const useStore = create<Store>((set) => ({
  project: demoProject,
  setProject: (project) => set({ project }),
}))
