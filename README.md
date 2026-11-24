# Prudence

A decision canvas for building things. You are the director; the AI is a worker you summon per
question. It never decides, never structures your project, and never runs when you're not looking.

**Try it: https://codeafridi.github.io/Prudence/** — no account, no key needed to use the canvas.

![Prudence decision canvas](docs/screenshot.png)


Most AI planning tools generate a plan for you. Prudence interrogates the one you're already
holding: write down the decision, ask for a short verdict on the options, then make the call
yourself and write down why. The questions that choice creates become children of it, so the tree
grows from decisions you actually made instead of a plan you hope to follow.

It is also a record. You schedule a review when you decide, come back when the date arrives, and
say what happened. Over time that turns into evidence about your judgment rather than another
document of intentions.

## Why it is built this way

- **Short by force.** Verdicts are capped at 25 words, consequences at 20. Judgment is short;
  essays are why people stop reading advice.
- **You keep the pen.** `choice` and `rationale` are the only fields the AI cannot write. Asking
  is optional; deciding is the product.
- **The win is the question you didn't ask.** Decide before expanding — the log tracks *closure
  rate*, not node count or tokens.
- **Advice you can argue with.** Every option comes with `p` (probability it works out) and the
  impact if it works or fails. You can override `p`. The export records both numbers.
- **A scoreboard for your judgment.** Record what happened and the Review panel scores your
  forecasts against the outcomes.
- **Your keys, your browser.** Local-first: IndexedDB for projects, `localStorage` for API keys.
  No account, no server, no telemetry.

## The loop

```
goal ──► decision ──► option ──► requirement ──► decision ...
              │
              └──► assumption (a fact the model had to guess)
```

- **Ask** — one pick, one line why, a consequence and probability per option, and the single fact
  that would flip the pick. Assumptions come back as `unknowns[]`, one click from becoming a node.
- **Grill** — the strongest case against the pick. It never rewrites the verdict.
- **Expand** — "what must be true for this choice to work?" Requirements, not brainstorming.
- **Decide** — pick an option and write one line. Both are required; there is no one-click accept.
- **Premortem** — "it's a year later and this failed — why?" Three likeliest reasons, each one
  click from becoming a node.
- **Park / Reopen** — park is "not now"; reopen archives the old choice into `history`.

Flags are computed from the tree, never stored: `premature` (parent undecided), `stale` (answered
against a different tree), `abandoned` (a branch you did not take), `at risk` (backward induction
says the choice rests on unlikely assumptions).

Two views of the same tree: the canvas, and an **outline** that stays usable past one screen.
On a phone the outline is the default, the inspector becomes a bottom sheet, and the canvas keeps
a minimum zoom so cards stay readable. `Cmd/Ctrl+K` jumps to any node by question or by the option
you chose.

## Review and calibration

When you decide, you can schedule the retrospective for 1, 3 or 6 months. When it comes due, the
Review panel flags it. Record what happened — worked, mixed or failed — plus a line of context.

If the decision had a probability on it, that outcome also scores the forecast:

- **said vs happened** — e.g. said 76%, happened 69%, so overconfident by 7 points.
- **Brier score** — one number for the probabilities: 0 is perfect, 0.25 is a coin flip.
- **a calibration plot and table** — for each range you called (50–60, 70–80, …), how many calls,
  what you said, what actually happened.

The probability is frozen when you record the review, so editing it later cannot rewrite a settled
call. Reviews in branches you did not take are not counted. Mixed counts as half, and the panel
says so when the sample is too small to read as anything more than a note. The same numbers go
into the markdown log.

## Quick start

Requires Node 22+.

```sh
npm install
npm run dev          # http://localhost:5173
```

It works with **no API key**: build the tree, decide, review, export. On first run you get three
half-decided starter trees — including a parked branch and one you didn't take — so the shape is
visible before you type anything.

### Adding a model

Any OpenAI-compatible endpoint works: OpenRouter, OpenAI, Groq, vLLM, Ollama, LM Studio. Click the
model button in the header, then fill in base URL, model id and key. For a local model:

```
base URL  http://localhost:11434/v1
model     llama3.1
key       ollama            (anything — it isn't checked)
```

The key stays in this browser. It is never written into a project, exported, or sent anywhere
except the endpoint you configured.

## Privacy and data

**What leaves this machine:** one HTTPS request to the endpoint you configure, when you press Ask,
Grill, Expand or Premortem. Nothing else — no analytics, no error reporting, no fonts or scripts
from a CDN, no server of ours. The browser test fails if any request goes off-origin on load.

**What stays local:** the project (IndexedDB), the API key (`localStorage`), the goal and every
rationale. Share links put the tree in the URL *fragment*, which browsers never send to a server.

Stated plainly, because "secure" is not a checkbox:

- `localStorage` is **not encrypted**. Any script running on this origin, or anyone with access to
  your browser profile, can read the key. Use a scoped key with a spend limit, and revoke it when
  you're done.
- The production build ships a Content-Security-Policy with `script-src 'self'`, so an injected
  third-party script cannot run and exfiltrate the key. `connect-src` stays open because the model
  endpoint is whatever you configure; that is the one place the policy must trust you.
- A share link contains the whole tree, unencrypted. Anyone holding the link can read it. Keys are
  never part of a project, so they cannot be part of a link.
- Self-host the static bundle if you don't want to trust ours; serve the same CSP header at the
  host level if you can.

## Share and export

**Share** compresses the tree into the URL hash. No server, no account, and the fragment is never
sent over the network. The recipient gets the same log, with history intact, and can fork it into
their own browser.

**Export** writes a markdown decision log: the path you took, each fork, what you rejected, where
the model's probability disagreed with yours, and the calibration line once outcomes exist. There
is also a JSON copy of the project and a printable record — one self-contained HTML file with the
same printed-form layout, fonts inlined, no network, and A4 page rules — so a record can be handed
to someone who does not have the app. The branch you did not take stays labelled.

## Status

Early, but the loop works end to end: canvas, outline, tree editing, undo, autosave, ask and
verdicts, grill, expand, premortem, decide/park/reopen, probability override, scheduled reviews,
calibration, markdown/JSON export, the printable record, share links and the phone layout.

Not yet: real-time collaboration. That needs a server, which is a different product decision.

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

Drives the real app: renders the canvas, decides a node, sets a probability, records a review,
checks the calibration panel and the exported log, reloads to prove persistence, and fails on
console errors or clipped nodes. Set `CHROMIUM_PATH` to use a chromium you already have;
`SHOT=/tmp/shot.png` saves a screenshot of the final state.

Static output in `dist/` — deploy to any static host. No env vars, no server, no database.

GitHub Pages: push to `main` with `.github/workflows/pages.yml`, then enable
*Settings → Pages → Source: GitHub Actions* once. Asset paths are relative, so it also works from
a subpath, Netlify, Vercel or `python -m http.server dist`.

## Notes

What broke and why, when it did: https://codeafridi.github.io/blog/

## License

MIT
