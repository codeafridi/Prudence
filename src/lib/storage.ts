import { openDB, type IDBPDatabase } from 'idb'
import type { Project } from '../model/types'

/** IndexedDB, one store, one project — spec §7.1. Multi-project is a later store change, not a schema one. */

const DB_NAME = 'prudence'
const STORE = 'projects'
const KEY = 'current'

let handle: Promise<IDBPDatabase> | null = null

function db(): Promise<IDBPDatabase> {
  handle ??= openDB(DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore(STORE)
    },
  })
  return handle
}

export async function loadProject(): Promise<Project | undefined> {
  return (await db()).get(STORE, KEY)
}

export async function saveProject(project: Project): Promise<void> {
  await (await db()).put(STORE, project, KEY)
}

let timer: ReturnType<typeof setTimeout> | undefined

/** Autosave, debounced 500 ms — spec §7.1. */
export function scheduleSave(project: Project): void {
  clearTimeout(timer)
  timer = setTimeout(() => {
    void saveProject(project)
  }, 500)
}
