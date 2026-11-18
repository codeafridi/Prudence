import type { Project } from '../model/types'

/**
 * DECISIONS.md — spec §8, milestone M4.
 * The JSON path must strip keys before writing (§7.2): keys never enter project records to begin with.
 */
export function exportMarkdown(_project: Project): string {
  throw new Error('exportMarkdown — spec §8, milestone M4')
}
