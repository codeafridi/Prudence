import type { Project } from '../model/types'

/** IndexedDB via idb, store `projects`, one record per project — spec §7.1, milestone M1. */
export async function loadProject(_id: string): Promise<Project | undefined> {
  throw new Error('loadProject — spec §7.1, milestone M1')
}

export async function saveProject(_project: Project): Promise<void> {
  throw new Error('saveProject — spec §7.1, milestone M1')
}
