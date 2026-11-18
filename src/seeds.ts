import type { Decision, Project } from './model/types.ts'

/**
 * Starting points. Cold start is the adoption bottleneck: a blank "What is the first decision?"
 * loses people, while a small, half-decided tree teaches the shape in ten seconds — including the
 * parked branch and the abandoned one, which are the parts people don't discover on their own.
 */

export type Seed = {
  id: string
  name: string
  goal: string
  blurb: string
  root: Decision
}

type NodeSpec = Partial<Decision> & { id: string; question: string; options: string[] }

function node(spec: NodeSpec): Decision {
  return {
    state: 'open',
    verdicts: [],
    history: [],
    children: [],
    ...spec,
  }
}

const DAYS = 86_400_000
const now = Date.now()

const shipMvp: Seed = {
  id: 'ship-mvp',
  name: 'Ship an MVP',
  goal: 'ship a working v1 that ten people will use',
  blurb: 'Cut scope where it is reversible; keep the decisions you cannot undo.',
  root: node({
    id: 'mvp-accounts',
    question: 'Do we need user accounts for v1?',
    options: ['no — local only', 'yes — real accounts'],
    state: 'decided',
    choice: 'no — local only',
    rationale: 'local data removes auth, privacy and support work from a v1 nobody uses yet',
    decidedAt: now - 20 * DAYS,
    reviewAt: now + 70 * DAYS,
    children: [
      node({
        id: 'mvp-data-home',
        question: 'Where does the data actually live?',
        options: ['browser only', 'cloud sync'],
        via: { kind: 'option', option: 'no — local only' },
      }),
      node({
        id: 'mvp-landing',
        question: 'Do we need a landing page before the app exists?',
        options: ['yes', 'no'],
        via: { kind: 'option', option: 'no — local only' },
        state: 'parked',
      }),
      node({
        id: 'mvp-auth',
        question: 'Which auth provider, if we ever add accounts?',
        options: ['Supabase', 'Auth0', 'roll our own'],
        via: { kind: 'option', option: 'yes — real accounts' },
      }),
    ],
  }),
}

const database: Seed = {
  id: 'choose-database',
  name: 'Choose a database',
  goal: 'pick a database for a product with a year of runway',
  blurb: 'The schema is the part you cannot undo. Start boring.',
  root: node({
    id: 'db-engine',
    question: 'SQL or document store?',
    options: ['Postgres', 'MongoDB', 'SQLite first'],
    state: 'decided',
    choice: 'SQLite first',
    rationale: 'one file, zero ops; the schema is the part you cannot undo later',
    decidedAt: now - 40 * DAYS,
    reviewAt: now + 50 * DAYS,
    children: [
      node({
        id: 'db-managed',
        question: 'Do we need a managed database before launch?',
        options: ['no', 'yes'],
        via: { kind: 'option', option: 'SQLite first' },
        state: 'decided',
        choice: 'no',
        rationale: 'a single box with file backups covers the first year of traffic',
        decidedAt: now - 30 * DAYS,
      }),
      node({
        id: 'db-replicas',
        question: 'Do we need read replicas in year one?',
        options: ['yes', 'no'],
        via: { kind: 'option', option: 'SQLite first' },
        state: 'parked',
      }),
      node({
        id: 'db-postgres-host',
        question: 'Which Postgres host?',
        options: ['Supabase', 'Neon', 'self-hosted'],
        via: { kind: 'option', option: 'Postgres' },
      }),
    ],
  }),
}

const hire: Seed = {
  id: 'hire-or-contract',
  name: 'Hire or contract',
  goal: 'get a second pair of hands without betting the company',
  blurb: 'A contract is a reversible way to buy evidence about a permanent decision.',
  root: node({
    id: 'hire-shape',
    question: 'Contract or full-time hire?',
    options: ['contract', 'full-time'],
    state: 'decided',
    choice: 'contract',
    rationale: 'three months of evidence beats a permanent headcount bet made on a hunch',
    decidedAt: now - 12 * DAYS,
    children: [
      node({
        id: 'hire-designer',
        question: 'Do we need a designer at the same time?',
        options: ['yes', 'no'],
        via: { kind: 'option', option: 'contract' },
      }),
      node({
        id: 'hire-ip',
        question: 'Who owns the IP in the contract?',
        options: ['we do, assigned on payment', 'contractor retains it'],
        via: { kind: 'option', option: 'contract' },
      }),
      node({
        id: 'hire-onboarding',
        question: 'What does full-time onboarding look like?',
        options: ['30 days', '60 days'],
        via: { kind: 'option', option: 'full-time' },
      }),
    ],
  }),
}

export const SEEDS: Seed[] = [shipMvp, database, hire]

export function seedToProject(seed: Seed): Project {
  return {
    id: `seed-${seed.id}-${Date.now()}`,
    name: seed.name,
    goal: seed.goal,
    root: structuredClone(seed.root),
    providers: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}
