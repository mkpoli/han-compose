// Adds the drawing to a filed report: the page the share link names is opened in a browser of this
// run, in the face the reporter drew in, and its output panel photographed; the picture is committed
// to `bug-attachments`, and the issue's body is rewritten to show it.

import { rawUrl, rewriteIssue, uploadAttachments } from '../src/github.js'
import { filedBody } from '../src/issue.js'
import { reportOf, runGiven } from './dispatch.js'

/** The faces the workshop's font switch offers, as it keeps the choice (`face` in `demo/App.svelte`)
 *  and as a report's context names it. */
const FACES = ['sans', 'serif', 'regular', 'fangsong', 'pen-writing']

/**
 * @param {Record<string, unknown>} payload the dispatch's `client_payload`
 * @param {import('../src/github.js').GitHubEnv} env
 * @param {number} number the issue the report was filed as
 * @param {(page: URL, face: string | null) => Promise<Uint8Array>} [capture]
 * @returns {Promise<string>} the address the drawing is served from
 */
export async function drawReport(payload, env, number, capture = photograph) {
  const { key, report } = await reportOf(payload, env.REPO)
  /** @type {string | null} */
  let image = null
  /** @type {unknown} */
  let failure = null
  try {
    if (!report.link) throw new Error('the report has no share link to open')
    // A share link names the sequence alone: the face is the reporter's setting, and a drawing in
    // another face can lack the very fault the report is about.
    const face = typeof report.context.face === 'string' && FACES.includes(report.context.face) ? report.context.face : null
    const bytes = await capture(new URL(report.link), face)
    const path = `reports/${new Date().toISOString().slice(0, 7).replace('-', '/')}/${crypto.randomUUID()}.png`
    await uploadAttachments(env, [{ path, bytes }], `report: #${number}`)
    image = rawUrl(env, path)
  } catch (error) {
    failure = error
  }
  // A drawing that could not be taken leaves the issue saying so, and the run fails on why.
  try {
    await rewriteIssue(env, number, filedBody(report, key, { image, document: null, failed: !image }))
  } catch (error) {
    if (!failure) throw error
    console.error('the issue could not be rewritten', error)
  }
  if (failure || !image) throw failure
  return image
}

/**
 * Open the reported page and photograph the drawing on it, at 2x, in `face` when the report names
 * one and in the workshop's own choice otherwise.
 * @param {URL} page @param {string | null} face @returns {Promise<Uint8Array>}
 */
async function photograph(page, face) {
  // The in-process API of `playwright-core`, which is how its own CLI reaches the browser; the
  // package exports only the client.
  const { inprocess } = await import('playwright-core/lib/coreBundle')
  const chromium = /** @type {any} */ (/** @type {any} */ (inprocess).playwright).chromium
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
    // The workshop reads its settings from localStorage under `ids-input:<name>`, as JSON
    // (`demo/lib/storage.js`), before it draws.
    if (face) await context.addInitScript(chosen => { try { localStorage.setItem('ids-input:font', JSON.stringify(chosen)) } catch { /* a page without storage draws its default */ } }, face)
    const tab = await context.newPage()
    await tab.goto(page.href, { waitUntil: 'domcontentloaded' })
    // The preview is photographed once it stops drawing, whatever it settled on: a sequence that
    // cannot be composed is what many reports are about. Then the faces get time to arrive.
    const preview = tab.locator('#output-panel .ids-preview').first()
    await preview.waitFor({ state: 'attached', timeout: 90_000 })
    await tab.locator('#output-panel .ids-preview:not([data-step="loading"], [data-step="idle"])').first().waitFor({ state: 'attached', timeout: 90_000 })
    await tab.waitForTimeout(2_000)
    return new Uint8Array(await preview.screenshot())
  } finally {
    await browser.close()
  }
}

if (import.meta.main) {
  const { payload, env } = await runGiven()
  const number = Number(process.env.ISSUE)
  if (!Number.isInteger(number) || number < 1) throw new Error('the run names no issue to add the drawing to')
  console.log(`added ${await drawReport(payload, env, number)}`)
}
