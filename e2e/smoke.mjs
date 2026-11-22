/**
 * Browser smoke test — the one check that proves the app actually works, not just compiles.
 *
 *   npm run build
 *   npm run preview -- --port 4173     # in another shell
 *   npx playwright install chromium    # once
 *   npm run e2e
 *
 * CHROMIUM_PATH points at a specific binary if the default Playwright download is missing.
 * SHOT=/path.png saves a screenshot of the final state.
 */
import fs from 'node:fs'
import { chromium } from 'playwright'

const APP_URL = process.env.APP_URL ?? 'http://127.0.0.1:4173/'
const CHROMIUM_PATH = process.env.CHROMIUM_PATH
const SHOT = process.env.SHOT

const step = (message) => console.log(`\n== ${message}`)
const ok = (message) => console.log(`   ok  ${message}`)
const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL: ${message}`)
}

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox'],
  ...(CHROMIUM_PATH ? { executablePath: CHROMIUM_PATH } : {}),
})
const context = await browser.newContext({
  viewport: { width: 1500, height: 900 },
  acceptDownloads: true,
})
const page = await context.newPage()

// Privacy guard: the app must not talk to anyone but its own origin on load.
const appOrigin = new URL(APP_URL).origin
const offOrigin = []
page.on('request', (request) => {
  const target = new URL(request.url())
  if (target.protocol === 'data:' || target.protocol === 'blob:') return
  if (target.origin !== appOrigin) offOrigin.push(request.url())
})

await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:4173' })

const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

try {
  step('load')
  await page.goto(APP_URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('text=Prudence')
  // A fresh browser has no stored project, so the starter chooser opens first.
  await page.getByRole('button', { name: "keep what's here" }).click()
  await page.waitForTimeout(200)
  const body = await page.textContent('body')
  assert(body.includes('multi-server'), 'demo tree renders')
  ok('shell + demo tree rendered')

  step('privacy')
  assert(offOrigin.length === 0, `third-party requests: ${offOrigin.join(', ')}`)
  const csp = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content')
  assert(csp?.includes("script-src 'self'"), 'production build ships a CSP')
  ok('no third-party requests, CSP present')

  step('nodes on canvas')
  const nodes = page.locator('.react-flow__node')
  const initial = await nodes.count()
  assert(initial === 3, `expected 3 nodes, saw ${initial}`)
  ok(`${initial} nodes`)

  step('select a node')
  await page.locator('.react-flow__node', { hasText: 'managed database' }).click()
  await page.waitForSelector('text=Options')
  ok('inspector opens')

  step('decide it')
  await page.locator('input[type="radio"]').first().check()
  await page.getByPlaceholder('Why — one line. Required.').fill('postgres on one box covers launch easily')
  await page.getByRole('button', { name: 'Decide', exact: true }).click()
  await page.waitForTimeout(300)
  const decided = await page.textContent('.react-flow__node:has-text("managed database")')
  assert(decided.includes('→ do'), `node should show the choice, saw: ${decided}`)
  ok('decision renders on the node')

  step('undo / redo')
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(300)
  const undone = await page.textContent('.react-flow__node:has-text("managed database")')
  assert(!undone.includes('→ do'), 'undo removes the choice')
  await page.keyboard.press('Control+Shift+z')
  await page.waitForTimeout(300)
  const redone = await page.textContent('.react-flow__node:has-text("managed database")')
  assert(redone.includes('→ do'), 'redo restores the choice')
  ok('undo and redo work')

  step('put a probability on the record')
  await page.locator('input[type=range]').evaluate((el) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(el, '0.7')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.waitForTimeout(200)
  assert((await page.textContent('body')).includes('0.70'), 'probability slider writes p')
  ok('p set to 0.70')

  step('schedule and record a review')
  await page.getByRole('button', { name: '3m', exact: true }).click()
  await page.waitForTimeout(200)
  await page.getByPlaceholder('what happened? (optional)').fill('held up for the first month')
  await page.getByRole('button', { name: 'worked', exact: true }).click()
  await page.waitForTimeout(200)
  assert((await page.textContent('body')).includes('checked'), 'review outcome is stored')
  ok('review scheduled then recorded')

  step('grow the tree')
  await page.locator('button[title="Add a decision this option requires"]').first().click()
  await page.waitForTimeout(500)
  const grown = await nodes.count()
  assert(grown === initial + 1, `expected ${initial + 1} nodes, saw ${grown}`)
  await page.locator('textarea').first().fill('Do we need a background job runner?')
  await page.locator('textarea').first().blur()
  await page.waitForTimeout(400)
  assert((await page.textContent('body')).includes('background job runner'), 'rename applied')
  ok(`${initial} → ${grown} nodes, renamed`)

  step('review tab')
  await page.getByRole('button', { name: /^Review/ }).click()
  await page.waitForTimeout(300)
  const review = await page.textContent('body')
  assert(review.includes('Nothing to flag') || review.includes('Export'), 'review panel renders')
  assert(review.includes('Calibration') && review.includes('1 call'), 'calibration counts the call')
  assert(review.includes('said 70%') && review.includes('happened 100%'), 'calibration scores p')
  ok('review panel renders, calibration scores the call')

  // Regression: the provider selector used to call useStore twice behind a `??`, so saving the
  // first provider changed the hook count mid-render and React blanked the whole app.
  step('add a model provider')
  await page.getByRole('button', { name: 'no model', exact: true }).click()
  await page.waitForSelector('text=Base URL')
  await page.getByLabel('Base URL', { exact: true }).fill('http://127.0.0.1:9/v1')
  await page.getByLabel('Model', { exact: true }).fill('smoke-model')
  await page.getByLabel(/API key/i).fill('smoke-key')
  await page.getByRole('button', { name: 'Add model', exact: true }).click()
  await page.waitForTimeout(500)
  assert((await page.locator('button').count()) > 0, 'saving the first provider must not blank the app')
  assert((await page.textContent('body')).includes('Prudence'), 'shell survives saving a provider')
  assert(errors.length === 0, errors.join('\n'))
  ok('first provider saved, app still renders')

  // Regression: removeProvider wrote state directly, so the removal was never autosaved and the
  // provider came back on the next reload.
  step('remove the provider and reload')
  await page.getByRole('button', { name: 'smoke-model', exact: true }).click()
  await page.waitForSelector('text=Base URL')
  await page.locator('li', { hasText: 'smoke-model' }).getByRole('button', { name: '×', exact: true }).click()
  await page.getByRole('button', { name: 'close', exact: true }).click()
  await page.waitForTimeout(400)
  assert((await page.textContent('body')).includes('no model'), 'provider is gone from the UI')
  await page.waitForTimeout(700) // past the 500 ms autosave debounce
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  assert((await page.textContent('body')).includes('no model'), 'removal survives a reload')
  assert(!(await page.textContent('body')).includes('smoke-model'), 'provider did not come back')
  ok('removed provider stays removed')

  // The reload reset the panel, so the export below needs the review tab again.
  await page.getByRole('button', { name: /^Review/ }).click()
  await page.waitForTimeout(300)

  step('export the decision log')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Decision log (.md)' }).click(),
  ])
  const file = await download.path()
  const markdown = fs.readFileSync(file, 'utf8')
  assert(markdown.includes('decision log'), 'export has a title')
  assert(markdown.includes('postgres on one box'), 'export carries the rationale')
  assert(markdown.includes('**Outcome:** worked'), 'export carries the review')
  assert(markdown.includes('Calibration: 1 call · said 70% · happened 100%'), 'export scores the call')
  ok(`${download.suggestedFilename()} (${markdown.length} bytes)`)

  step('reload persists')
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const persisted = await page.textContent('.react-flow__node:has-text("managed database")')
  assert(persisted.includes('→ do'), 'decision survived reload')
  assert((await nodes.count()) === grown, 'tree survived reload')
  ok('IndexedDB persistence works')

  step('cmd+k finder')
  await page.keyboard.press('Control+k')
  await page.waitForTimeout(250)
  await page.getByPlaceholder(/Jump to a decision/).fill('azure')
  await page.waitForTimeout(200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(600)
  const found = await page.locator('textarea').first().inputValue()
  assert(found.includes('AWS or Azure'), `finder should open that node, saw: ${found}`)
  ok('finder jumps to a node by its chosen option')

  step('outline view')
  await page.getByRole('button', { name: 'outline', exact: true }).click()
  await page.waitForTimeout(300)
  const row = page.getByRole('button', { name: /background job runner/ })
  assert((await row.count()) > 0, 'outline lists the tree')
  await row.first().click()
  await page.waitForTimeout(250)
  const fromOutline = await page.locator('textarea').first().inputValue()
  assert(fromOutline.includes('background job runner'), 'outline row selects the node')
  ok('outline lists and selects')

  await page.getByRole('button', { name: 'canvas', exact: true }).click()
  await page.waitForTimeout(700)

  step('nothing is clipped')
  const boxes = await page
    .locator('.react-flow__node')
    .evaluateAll((elements) => elements.map((el) => el.getBoundingClientRect().toJSON()))
  const viewportHeight = await page.evaluate(() => window.innerHeight)
  const clipped = boxes.filter((box) => box.bottom > viewportHeight - 4 || box.top < 4)
  assert(clipped.length === 0, `${clipped.length} node(s) outside the viewport`)
  ok(`all ${boxes.length} nodes inside the viewport`)

  if (SHOT) await page.screenshot({ path: SHOT })

  step('starter examples')
  await page.getByRole('button', { name: 'examples', exact: true }).click()
  await page.getByRole('button', { name: /Hire or contract/ }).click()
  await page.waitForTimeout(600)
  const seededGoal = await page.locator('header input').inputValue()
  assert(seededGoal.includes('get a second pair of hands'), `seed loads its goal, saw: ${seededGoal}`)
  assert((await page.locator('.react-flow__node').count()) === 4, 'seed renders its tree')
  ok('example loads a half-decided tree')

  step('share link')
  await page.getByRole('button', { name: /^Review/ }).click()
  await page.getByRole('button', { name: 'Copy share link' }).click()
  await page.waitForTimeout(400)
  const sharedUrl = await page.evaluate(() => navigator.clipboard.readText())
  assert(sharedUrl.includes('#p='), `clipboard should hold a share link, saw: ${sharedUrl.slice(0, 60)}`)

  // Fresh context: no stored project, so the shared tree must load without prompting.
  const sharedContext = await browser.newContext({ viewport: { width: 1200, height: 800 } })
  const sharedPage = await sharedContext.newPage()
  const sharedErrors = []
  sharedPage.on('pageerror', (e) => sharedErrors.push(e.message))
  await sharedPage.goto(sharedUrl, { waitUntil: 'networkidle' })
  await sharedPage.waitForTimeout(900)
  const sharedGoal = await sharedPage.locator('header input').inputValue()
  assert(sharedGoal.includes('get a second pair of hands'), `shared link carries the tree, saw: ${sharedGoal}`)
  assert((await sharedPage.textContent('body')).includes('Opened from a shared link'), 'shared banner is shown')
  assert(sharedErrors.length === 0, sharedErrors.join('\n'))
  await sharedContext.close()
  ok('share link opens the same tree with no server')

  step('phone layout')
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  })
  const phonePage = await phone.newPage()
  const phoneErrors = []
  phonePage.on('pageerror', (e) => phoneErrors.push(e.message))
  phonePage.on('console', (m) => {
    if (m.type() === 'error') phoneErrors.push(`console: ${m.text()}`)
  })
  await phonePage.goto(APP_URL, { waitUntil: 'networkidle' })
  await phonePage.getByRole('button', { name: /Ship an MVP/ }).click()
  await phonePage.waitForTimeout(900)

  const noSideScroll = await phonePage.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  )
  assert(noSideScroll, 'phone layout must not scroll sideways')

  // Phones default to the outline: readable without pinching.
  const rows = phonePage.getByRole('button', { name: /Where does the data actually live/ })
  assert((await rows.count()) > 0, 'outline is the phone default')

  await phonePage.locator('.react-flow').count()
  const rowCount = await phonePage.locator('div[style*="padding-left"]').count()
  assert(rowCount > 0, 'outline rows render')

  // Tapping a row opens the bottom sheet with the inspector.
  await rows.first().click()
  await phonePage.waitForTimeout(600)
  assert((await phonePage.locator('text=Options').count()) > 0, 'bottom sheet opens on tap')

  const sheetTop = await phonePage
    .locator('text=Options')
    .first()
    .evaluate((el) => el.getBoundingClientRect().top)
  assert(sheetTop > 844 * 0.35, `sheet should sit in the lower half, top at ${sheetTop}`)

  const rowAboveSheet = await phonePage
    .locator('div[style*="padding-left"]')
    .evaluateAll((els, limit) => els.some((el) => el.getBoundingClientRect().bottom < limit - 10), sheetTop)
  assert(rowAboveSheet, 'the tree stays visible above the sheet')

  // The canvas is still reachable, and its nodes stay legible rather than shrinking to nothing.
  await phonePage.getByRole('button', { name: 'canvas', exact: true }).click()
  await phonePage.waitForTimeout(900)
  const nodeWidth = await phonePage
    .locator('.react-flow__node')
    .first()
    .evaluate((el) => el.getBoundingClientRect().width)
  assert(nodeWidth > 150, `nodes should stay readable on a phone, width ${nodeWidth}`)

  if (process.env.MOBILE_SHOT) await phonePage.screenshot({ path: process.env.MOBILE_SHOT })
  assert(phoneErrors.length === 0, phoneErrors.join('\n'))
  await phone.close()
  ok('phone: no sideways scroll, outline default, sheet opens, canvas stays legible')

  step('console')
  assert(errors.length === 0, errors.join('\n'))
  ok('no console errors')

  console.log('\nALL CHECKS PASSED')
} finally {
  await browser.close()
}
