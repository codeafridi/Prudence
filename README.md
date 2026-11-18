# Prudence

A decision canvas for building things. You are the director; the AI is a worker you summon per
question. It never decides, never structures your project, and never runs when you're not looking.

**Try it: https://codeafridi.github.io/Prudence/** — no account, no key needed to use the canvas.

![Prudence decision canvas](docs/screenshot.png)

Most AI planning tools generate a plan for you. Prudence interrogates the one you're already
holding: ask a question, get a yes/no/conditional with the consequence of each option, then make
the call yourself and write down why.

## Why

- **Short by force.** Verdicts are capped at 25 words, consequences at 20. Judgment is short;
  essays are why people stop reading advice.
- **You keep the pen.** `choice` and `rationale` are the only fields the AI cannot write. Asking
  is optional; deciding is the product.
- **The win is the question you didn't ask.** Decide before expanding — the log tracks *closure
  rate*, not node count or tokens.
- **Advice you can argue with.** Every option comes with `p` (probability it works out) and impact
  if it works or fails. You can override `p`. The export records both numbers.
- **Your keys, your browser.** Local-first: IndexedDB for projects, `localStorage` for API keys.
  No account, no server, no telemetry.

## Quick start

```sh
npm install
npm run dev          # http://localhost:5173
```

It works with **no API key**: build the tree, decide, review, export. Add a model when you want
advice.

### Adding a model

Any OpenAI-compatible endpoint: OpenRouter, OpenAI, Groq, vLLM, Ollama, LM Studio.

Click the model button in the header → base URL, model id, key. For a local model:

```
base URL  http://localhost:11434/v1
model     llama3.1
key       ollama            (anything — it isn't checked)
```

The key stays in this browser. It is never written into a project, exported, or sent anywhere
except the endpoint you configured.

## How it works

```
goal ──► decision ──► option ──► requirement ──► decision ...
              │
              └──► assumption (a fact the model had to guess)
```

- **Ask** — verdict: one pick, one line why, per-option consequence + probability, and the single
  fact that would flip it. Assumptions come back as `unknowns[]`, one click from becoming a node.
- **Grill** — the strongest case against the pick.
- **Expand** — "what must be true for this choice to work?" Not brainstorming: requirements.
- **Decide** — pick an option and write one line. Required. No one-click accept, by design.
- **Premortem** — "it's a year later and this failed — why?" Three likeliest reasons, each one
  click from becoming a node.
- **Review** — schedule a retrospective (1/3/6 months) when you decide, then record what actually
  happened. The log becomes evidence instead of intention.
- **Park / Reopen** — park is "not now"; reopen archives the old choice into `history`.

Flags are computed, never stored: `premature` (parent undecided), `stale` (answered against a
different tree), `abandoned` (a branch you didn't take), `at risk` (backward induction says the
choice rests on unlikely assumptions).

Two ways to read the same tree: the canvas, and an **outline** list that survives trees larger than
one screen. `Cmd/Ctrl+K` jumps to any node by question or by the option you chose.

Export produces `DECISIONS.md`: the path you took, each fork, what you rejected, and where the
model's probability disagreed with yours.

## Status

Early, but the whole loop works: canvas, tree editing, undo, autosave, ask + verdicts, grill,
expand, premortem, decide/park/reopen, probability override, scheduled retrospectives,
deterministic review, markdown/JSON export.
Not yet: collaboration, sync, mobile layout.

Build in progress is documented in `AGENTS.md` (local) and the spec outside this repo.

## Develop

```sh
npm run dev         # vite
npm test            # node --test, no test runner dependency
npm run typecheck   # tsc --noEmit
npm run build       # typecheck + production bundle
```

### Browser test

```sh
npm run build
npm run preview -- --port 4173     # in another shell
npx playwright install chromium    # once
npm run e2e
```

Drives the real app: renders the canvas, decides a node, undoes and redoes, grows the tree,
exports the log, reloads to prove persistence, and fails on console errors or clipped nodes.
Set `CHROMIUM_PATH` to use a chromium you already have; `SHOT=/tmp/shot.png` for a screenshot.

Static output in `dist/` — deploy to any static host. No env vars, no server, no database.

GitHub Pages: push to `main` with `.github/workflows/pages.yml`, then enable
*Settings → Pages → Source: GitHub Actions* once. Asset paths are relative, so it also works from
a subpath, Netlify, Vercel or `python -m http.server dist`.

## License

MIT
