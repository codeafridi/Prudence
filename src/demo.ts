import type { Project } from './model/types'

/** Throwaway tree so the shell renders a real projection. Replaced by the store in M1. */
export const demoProject: Project = {
  id: 'demo',
  name: 'Notes app',
  goal: 'ship a notes app for 1k users',
  providers: [],
  createdAt: 0,
  updatedAt: 0,
  root: {
    id: 'root',
    question: 'Do we need multi-server before 1k users?',
    options: ['no (single box)', 'yes (managed multi-region)'],
    state: 'decided',
    choice: 'no (single box)',
    rationale: '1k users fit one $6 VPS; scaling is reversible, so this is cheap to be wrong about.',
    verdicts: [],
    history: [],
    children: [
      {
        id: 'db',
        question: 'Do we need a managed database?',
        options: ['do', "don't"],
        via: { kind: 'option', option: 'no (single box)' },
        state: 'open',
        verdicts: [],
        history: [],
        children: [],
      },
      {
        id: 'cloud',
        question: 'AWS or Azure?',
        options: ['AWS', 'Azure', 'none'],
        via: { kind: 'option', option: 'yes (managed multi-region)' },
        state: 'open',
        verdicts: [],
        history: [],
        children: [],
      },
    ],
  },
}
