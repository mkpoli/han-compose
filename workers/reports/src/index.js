// @ts-check
// The intake endpoint. `POST /` takes a report as multipart form data and answers with the GitHub
// issue it became; `GET /health` answers that the Worker is up. Reporters have no account anywhere,
// so the only thing standing between the endpoint and abuse is the origin check, the rate limits
// and the optional Turnstile challenge.
//
// The issue is filed by the workshop's own GitHub Action rather than by a personal token, so it is
// the action that opens it and the report names the reporter; the Worker dispatches the report to
// that Action and looks on GitHub for the issue it files.
import { duplicateComment, fromRare, labelsFor, reportMarker } from './issue.js'
import { GitHubError, commentOnIssue, dispatch, ensureLabels, findIssue, rawUrl, uploadAttachments } from './github.js'
import { MAX_BODY, byteLength, checkBodySize, checkMediaType, meterBody, parseReport } from './validate.js'
import { checkRate, dedupeKey, findDuplicate, rememberIssue } from './limit.js'

const TURNSTILE_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** @typedef {import('./validate.js').Report} Report */
/**
 * @typedef {object} Env
 * @property {KVNamespace} REPORTS
 * @property {string} REPO
 * @property {string} SITE_ORIGINS comma-separated origins of the sites that send reports
 * @property {string} GITHUB_TOKEN the token the dispatch and the dedupe use
 * @property {string} [TURNSTILE_SECRET]
 */

/**
 * When the Worker looks for the issue the Action files: the first look, the gap between looks, and
 * the look after which the reporter is told to try again. A run files about ten seconds after its
 * dispatch.
 * @typedef {{ first: number, every: number, total: number }} Wait
 */
/** @type {Wait} */
const WAIT = { first: 6_000, every: 4_000, total: 80_000 }
/** How far back a look reaches, so a report sent again after its answer came too late finds the
 *  issue its first run filed. */
const LOOK_BACK = 15 * 60_000
/** GitHub takes a dispatch payload under 64 KB; a report that carries more than half of that is
 *  turned away with a `413` rather than sent to fail at GitHub. */
const MAX_DISPATCH = 30_000

/** A report too large for the dispatch, which is a `413` for the reporter rather than a `502`. */
class DispatchTooLarge extends Error {}

/** A preview version of the workshop, on the alias its pull request deploys to. */
const PREVIEW = /^https:\/\/(?:[a-z0-9-]+-)?ids-input-workshop\.mkpoli\.workers\.dev$/

/** The desktop app's page: `tauri://localhost` in WebKit (macOS, Linux), `http://tauri.localhost`
 *  in WebView2 (Windows). */
const DESKTOP = new Set(['tauri://localhost', 'http://tauri.localhost'])

/** The origins in a comma-separated list. @param {string} siteOrigins @returns {string[]} */
export const originsOf = siteOrigins => siteOrigins.split(',').map(origin => origin.trim()).filter(Boolean)

/**
 * Whether an origin may talk to the endpoint: one of the sites, a preview of the workshop, the
 * desktop app, or any port of localhost for a developer running a site. A request without an
 * `Origin` header is not a browser's and is left alone.
 * @param {string | null} origin @param {string} siteOrigins comma-separated @returns {boolean}
 */
export function originAllowed(origin, siteOrigins) {
  if (origin === null) return true
  return originsOf(siteOrigins).includes(origin) || PREVIEW.test(origin) || DESKTOP.has(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin)
}

/** @param {string | null} origin @returns {Record<string, string>} */
const corsHeaders = origin => ({
  vary: 'Origin',
  ...(origin ? { 'access-control-allow-origin': origin } : {}),
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'Content-Type',
  'access-control-max-age': '86400',
})

/** @param {unknown} body @param {number} status @param {string | null} origin @returns {Response} */
const json = (body, status, origin) =>
  new Response(`${JSON.stringify(body)}\n`, { status, headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(origin) } })

/** @param {number} status @param {string} error @param {string} message @param {string | null} origin */
const fail = (status, error, message, origin) => json({ error, message }, status, origin)

/**
 * Whether the submitted Turnstile token is good. With no secret configured there is no challenge
 * and every report passes.
 * @param {Env} env @param {string} token @param {string} ip @returns {Promise<boolean>}
 */
async function passesTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true
  if (!token) return false
  const body = new FormData()
  body.set('secret', env.TURNSTILE_SECRET)
  body.set('response', token)
  if (ip) body.set('remoteip', ip)
  const response = await fetch(TURNSTILE_VERIFY, { method: 'POST', body })
  if (!response.ok) return false
  const verdict = /** @type {{ success?: boolean }} */ (await response.json())
  return verdict.success === true
}

/**
 * Ask the workshop's Action to file the report, and hand back the issue it filed. The Action marks
 * the issue with the report's key, and the Worker looks for that mark among the issues labelled
 * `report`, a label only the repository's own tokens can set.
 * @param {Env} env @param {FormData} form @param {Report} report @param {string} key @param {Wait} wait
 * @returns {Promise<{ number: number, url: string }>}
 */
async function fileByAction(env, form, report, key, wait) {
  // What the action reads: the fields the issue is written from. The drawing it takes for itself
  // from the page the share link names, so the dispatch only says whether there is one to take.
  /** @type {Record<string, string>} */
  const carried = {}
  for (const [name, value] of form) if (typeof value === 'string') carried[name] = value
  if (byteLength(JSON.stringify(carried)) > MAX_DISPATCH) throw new DispatchTooLarge()

  const since = new Date(Date.now() - LOOK_BACK)
  const look = () => findIssue(env, { label: 'report', since, ending: reportMarker(key) })
  const filed = await look()
  if (filed) return filed

  // A report from the rare compendium brings its own drawing, which is stored here for the run to
  // show; the workshop's reports are photographed by the `draw` job from their share link.
  const rare = fromRare(report.context)
  /** @type {{ image: string | null, imageFailed: boolean }} */
  const stored = { image: null, imageFailed: false }
  if (rare && report.image) {
    try {
      const path = `reports/${new Date().toISOString().slice(0, 7).replace('-', '/')}/${crypto.randomUUID()}.${report.image.ext}`
      await uploadAttachments(env, [{ path, bytes: report.image.bytes }], `report: ${key.slice(0, 12)}`)
      stored.image = rawUrl(env, path)
    } catch (error) {
      console.error('storing the report image failed', error)
      stored.imageFailed = true
    }
  }
  await dispatch(env, {
    event_type: 'report',
    client_payload: { key, drawing: !rare && Boolean(report.image && report.link), ...stored, report: carried },
  })
  const until = Date.now() + wait.total
  for (let pause = wait.first; ; pause = wait.every) {
    await new Promise(done => setTimeout(done, pause))
    // One look that fails is not the run failing; the next look asks again.
    const issue = await look().catch(error => {
      console.error('looking for the filed issue failed', error)
      return null
    })
    if (issue) return issue
    if (Date.now() >= until) throw new Error('the Action filed no issue in time')
  }
}

/**
 * The endpoint. Anything thrown below becomes a `502` rather than an empty 500, so a reporter
 * always gets an answer shaped like the rest of them.
 * @param {Request} request @param {Env} env @param {Wait} [wait] @returns {Promise<Response>}
 */
export async function handle(request, env, wait = WAIT) {
  try {
    return await route(request, env, wait)
  } catch (error) {
    console.error('the report endpoint threw', error)
    const origin = request.headers.get('origin')
    return fail(502, 'upstream_error', 'The report could not be handled. Try again later.', originAllowed(origin, env.SITE_ORIGINS) ? origin : null)
  }
}

/**
 * Comment on the issue an identical report became, and say whether it did.
 * @param {Env} env @param {{ number: number, url: string }} known @returns {Promise<boolean>}
 */
async function commentDuplicate(env, known) {
  try {
    await commentOnIssue(env, known.number, duplicateComment(new Date().toISOString()))
    return true
  } catch (error) {
    if (!(error instanceof GitHubError)) throw error
    // The record has outlived its issue when the issue was deleted or moved, which the reporter
    // should not be told is a success; the filing below writes over the record. Another failure
    // costs only the comment, and the report did reach its issue.
    return ![404, 410].includes(error.status)
  }
}

/** @param {Request} request @param {Env} env @param {Wait} wait @returns {Promise<Response>} */
async function route(request, env, wait) {
  const origin = request.headers.get('origin')
  if (!originAllowed(origin, env.SITE_ORIGINS)) {
    return fail(403, 'forbidden_origin', 'Reports are only accepted from the workshop.', null)
  }
  const url = new URL(request.url)

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) })
  if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true }, 200, origin)
  if (url.pathname === '/health') return fail(405, 'method_not_allowed', 'The health check answers GET.', origin)
  if (url.pathname !== '/') return fail(404, 'not_found', 'A report is posted to the root of this service.', origin)
  if (request.method !== 'POST') return fail(405, 'method_not_allowed', 'A report is sent with POST.', origin)

  const tooBig = checkBodySize(request.headers)
  if (tooBig) return fail(tooBig.status, tooBig.error, tooBig.message, origin)
  const wrongType = checkMediaType(request.headers)
  if (wrongType) return fail(wrongType.status, wrongType.error, wrongType.message, origin)

  const ip = request.headers.get('cf-connecting-ip') ?? ''
  const rate = await checkRate(env, ip || 'unknown')
  if (!rate.ok) return fail(429, 'rate_limited', 'Too many reports have come from here. Try again later.', origin)

  const metered = meterBody(request)
  /** @type {FormData} */
  let form
  try {
    form = await metered.request.formData()
  } catch {
    if (metered.overrun.exceeded) return fail(413, 'too_large', `A report may be at most ${MAX_BODY} bytes in total.`, origin)
    return fail(400, 'invalid_request', 'The report could not be read as a multipart form.', origin)
  }

  const parsed = await parseReport(form, { siteOrigins: originsOf(env.SITE_ORIGINS) })
  if (!parsed.ok) return fail(parsed.status, parsed.error, parsed.message, origin)
  const report = parsed.report

  if (!(await passesTurnstile(env, report.turnstile, ip))) {
    return fail(403, 'captcha_failed', 'The challenge did not pass. Reload the workshop and try again.', origin)
  }

  const key = await dedupeKey(report.sequence, report.symptom)
  const known = await findDuplicate(env, key)
  if (known && (await commentDuplicate(env, known))) {
    return json({ number: known.number, url: known.url, duplicate: true }, 200, origin)
  }

  /** @type {{ number: number, url: string }} */
  let issue
  try {
    await ensureLabels(env, labelsFor(report.context))
    issue = await fileByAction(env, form, report, key, wait)
  } catch (error) {
    if (error instanceof DispatchTooLarge) return fail(413, 'too_large', 'This report is too large to send. Leave the document out and try again.', origin)
    console.error('filing the report failed', error)
    return fail(502, 'upstream_error', 'The report could not be filed. Try again in a minute.', origin)
  }
  // The issue exists from here on. A failed write only costs the next identical report its dedupe.
  try {
    await rememberIssue(env, key, issue)
  } catch (error) {
    console.error('remembering the report failed', error)
  }
  return json({ number: issue.number, url: issue.url, duplicate: false }, 201, origin)
}

export default {
  /** @param {Request} request @param {Env} env @returns {Promise<Response>} */
  fetch(request, env) {
    return handle(request, env)
  },
}
