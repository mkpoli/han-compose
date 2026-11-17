import { afterEach, describe, expect, it } from 'bun:test'
import { MAX_BODY_CHARS, asText, autolink, cell, duplicateComment, elide, escapeMarkdown, fenceFor, issueBody, issueTitle, labelsFor, reportMarker } from '../../workers/reports/src/issue.js'
import { MAX_BODY, byteLength, checkBodySize, checkMediaType, cleanText, meterBody, parseReport, sniffImage } from '../../workers/reports/src/validate.js'
import { PER_DAY, PER_HOUR, TOTAL_PER_DAY, checkRate, dedupeKey, findDuplicate, rememberIssue } from '../../workers/reports/src/limit.js'
import { toBase64 } from '../../workers/reports/src/github.js'
import { handle as handleReport, originAllowed } from '../../workers/reports/src/index.js'
import { fileReport } from '../../workers/reports/intake/file.js'
import { drawReport } from '../../workers/reports/intake/draw.js'

/** The endpoint with its looks for the filed issue a millisecond apart. */
const handle = (request, env, total = 1000) => handleReport(request, env, { first: 1, every: 1, total })

const SITE = 'https://ids.mkpo.li'
const RARE = 'https://rare.glyphatlas.org'
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03])
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])

/** An in-memory stand-in for the KV namespace, without the expiry. */
const fakeKv = () => {
  const store = new Map()
  return {
    store,
    async get(key, type) {
      const value = store.get(key)
      if (value === undefined) return null
      return type === 'json' ? JSON.parse(value) : value
    },
    async put(key, value) {
      store.set(key, value)
    },
    async delete(key) {
      store.delete(key)
    },
  }
}

const fakeEnv = (overrides = {}) => ({ REPORTS: fakeKv(), REPO: 'mkpoli/han-compose', SITE_ORIGINS: `${SITE},${RARE}`, GITHUB_TOKEN: 'token', ...overrides })

const reportForm = (fields = {}, files = {}) => {
  const form = new FormData()
  const all = { symptom: 'The preview is blank.', sequence: '⿰亻哥', ...fields }
  for (const [name, value] of Object.entries(all)) if (value !== undefined) form.set(name, value)
  for (const [name, file] of Object.entries(files)) form.set(name, file)
  return form
}

const postReport = (form, headers = {}) =>
  new Request('https://reports.example/', { method: 'POST', body: form, headers: { origin: SITE, 'cf-connecting-ip': '198.51.100.7', ...headers } })

const emptyReport = overrides => ({
  symptom: 'The preview is blank.',
  sequence: '',
  link: '',
  document: '',
  context: {},
  contact: '',
  turnstile: '',
  image: null,
  documentFile: null,
  ...overrides,
})

const noAttachments = { image: null, document: null, failed: false }

const ISSUES = '/repos/mkpoli/han-compose/issues'

/**
 * A stubbed global `fetch` that answers the GitHub calls a report makes. `calls` records every
 * request, `routes` overrides one path's answer, and `issues` is what the repository holds: an
 * issue opened through the stub joins it.
 */
const stubGitHub = ({ routes = {}, issueNumber = 123, issues = [] } = {}) => {
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input)
    const path = new URL(url).pathname
    const key = `${init.method ?? 'GET'} ${path}`
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : null
    calls.push({ key, url, body })
    if (routes[key]) return routes[key](body)
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    if (key.endsWith('/git/ref/heads/bug-attachments')) return reply(404, { message: 'Not Found' })
    if (key === 'POST /repos/mkpoli/han-compose/git/blobs') return reply(201, { sha: 'blob-sha' })
    if (key === 'POST /repos/mkpoli/han-compose/git/trees') return reply(201, { sha: 'tree-sha' })
    if (key === 'POST /repos/mkpoli/han-compose/git/commits') return reply(201, { sha: 'commit-sha' })
    if (key === 'POST /repos/mkpoli/han-compose/git/refs') return reply(201, { ref: 'refs/heads/bug-attachments' })
    if (key === 'POST /repos/mkpoli/han-compose/labels') return reply(422, { message: 'already_exists' })
    if (key === `GET ${ISSUES}`) return reply(200, issues)
    if (key === `POST ${ISSUES}`) {
      const issue = { number: issueNumber, html_url: `https://github.com/mkpoli/han-compose/issues/${issueNumber}`, body: body.body }
      issues.unshift(issue)
      return reply(201, issue)
    }
    if (new RegExp(`^PATCH ${ISSUES}/\\d+$`).test(key)) return reply(200, { number: Number(path.split('/').at(-1)) })
    if (new RegExp(`^POST ${ISSUES}/\\d+/comments$`).test(key)) return reply(201, { id: 1 })
    if (key === 'POST /repos/mkpoli/han-compose/dispatches') return reply(204, null)
    throw new Error(`the stub has no answer for ${key}`)
  }
  return { calls, issues, restore: () => { globalThis.fetch = original } }
}

let stub = null
afterEach(() => {
  stub?.restore()
  stub = null
})

/**
 * GitHub with the workshop's Action behind it: a dispatched report is filed by the run's own step,
 * so the endpoint finds the issue the way it does on the site.
 * @param {{ routes?: Record<string, (body: any) => Response | Promise<Response>>, asked?: (body: any) => void, files?: boolean, issues?: object[] }} [options]
 */
const stubAction = ({ asked, routes = {}, files = true, issues = [] } = {}) =>
  stubGitHub({
    issues,
    routes: {
      ...routes,
      'POST /repos/mkpoli/han-compose/dispatches': async body => {
        if (asked) asked(body)
        if (files) await fileReport(body.client_payload, { REPO: 'mkpoli/han-compose', GITHUB_TOKEN: 'run-token' })
        return new Response(null, { status: 204 })
      },
    },
  })

describe('report text escaping', () => {
  it('leaves Markdown in the reporter’s words inert', () => {
    expect(escapeMarkdown('**bold** <img src=x> [a](b) | pipe')).toBe('\\*\\*bold\\*\\* \\<img src=x\\> \\[a\\]\\(b\\) \\| pipe')
  })
  it('defuses a line that would open a list or a heading', () => {
    expect(escapeMarkdown('- one\n1. two\n# three')).toBe('\\- one\n1\\. two\n\\# three')
  })
  it('stops a mention notifying someone, and leaves an address whole', () => {
    expect(escapeMarkdown('ping @someone about it')).toBe('ping @\u200bsomeone about it')
    expect(escapeMarkdown('@someone')).toBe('@\u200bsomeone')
    expect(escapeMarkdown('write to me@example.com')).toBe('write to me@example.com')
  })
  it('leaves a version number alone', () => {
    expect(escapeMarkdown('0.1.0')).toBe('0.1.0')
    expect(cell('0.1.0')).toBe('0.1.0')
  })
  it('makes a share link clickable without letting it break out', () => {
    expect(autolink('https://ids.mkpo.li/#s=W10')).toBe('<https://ids.mkpo.li/#s=W10>')
    expect(autolink('https://ids.mkpo.li/#<script>')).toBe('<https://ids.mkpo.li/#%3Cscript%3E>')
    expect(autolink('not a url')).toBe('not a url')
  })
  it('defuses a setext heading and a thematic break', () => {
    expect(escapeMarkdown('heading\n---')).toBe('heading\n\\---')
    expect(escapeMarkdown('***')).toBe('\\*\\*\\*')
    expect(escapeMarkdown('===')).toBe('\\===')
  })
  it('renders a value whose toString throws', () => {
    expect(asText({ toString: null })).toBe('{"toString":null}')
    expect(cell({ toString: null })).toBe('\\{"toString":null\\}')
    expect(cell([{ toString: null }])).toBe('\\{"toString":null\\}')
  })
  it('opens a fence longer than any backtick run inside', () => {
    expect(fenceFor('plain')).toBe('```')
    expect(fenceFor('a ``` b')).toBe('````')
    expect(fenceFor('`````')).toBe('``````')
  })
  it('puts a missing fact and a list in one cell', () => {
    expect(cell(undefined)).toBe('—')
    expect(cell(['Noto', 'Source Han'])).toBe('Noto, Source Han')
    expect(cell('a|b\nc')).toBe('a\\|b c')
  })
  it('cuts overlong text with an ellipsis', () => {
    expect(elide('abcdef', 10)).toBe('abcdef')
    expect(elide('abcdef', 4)).toBe('abc…')
  })
})

describe('report titles', () => {
  it('names the sequence and the first line of the symptom', () => {
    expect(issueTitle({ sequence: '⿰亻哥', symptom: 'The preview is blank.\nSteps: open it.' })).toBe('report: ⿰亻哥 — The preview is blank.')
  })
  it('drops the dash when nothing was being edited', () => {
    expect(issueTitle({ sequence: '', symptom: 'Nothing loads' })).toBe('report: Nothing loads')
  })
  it('stays within a hundred and twenty characters', () => {
    const title = issueTitle({ sequence: '⿰'.repeat(200), symptom: 'x'.repeat(300) })
    expect(title.length).toBe(120)
    expect(title.endsWith('…')).toBe(true)
  })
})

describe('report labels', () => {
  it('always triages a report', () => {
    expect(labelsFor({})).toEqual(['report', 'needs-triage', 'from: ids-input'])
  })
  it('adds the reporter’s language when the project triages it', () => {
    expect(labelsFor({ locale: 'zh-Hant' })).toEqual(['report', 'needs-triage', 'from: ids-input', 'lang:zh-Hant'])
    expect(labelsFor({ locale: 'de' })).toEqual(['report', 'needs-triage', 'from: ids-input'])
  })
})

describe('report bodies', () => {
  const report = emptyReport({
    symptom: 'The preview is blank.',
    sequence: '⿰亻哥',
    link: `${SITE}/#s=abc`,
    document: '{"root":{}}',
    contact: '@someone',
    context: {
      appVersion: '0.1.0',
      commit: 'deadbee',
      route: '/',
      viewport: '1280x720',
      devicePixelRatio: 2,
      locale: 'ja',
      theme: 'dark',
      userAgent: 'Mozilla/5.0',
      platform: 'Linux x86_64',
      fonts: ['Noto Serif CJK'],
      composerBase: 'https://ids.mkpo.li/composer/',
      preview: 'failed / failed',
      face: 'serif',
      local: false,
      previewVersion: true,
      historyLength: 2,
      console: ['TypeError: x is not a function'],
    },
  })

  it('keeps the sections in order', () => {
    const body = issueBody(report, { image: 'https://example/i.png', document: null, failed: false })
    const order = ['## Symptom', '## Sequence', '## Environment', 'Console output', '>Document<', '>Reporter<']
    let at = -1
    for (const marker of order) {
      const next = body.indexOf(marker)
      expect(next).toBeGreaterThan(at)
      at = next
    }
  })
  it('fences the sequence, links the share URL and embeds the drawing', () => {
    const body = issueBody(report, { image: 'https://github.com/mkpoli/han-compose/raw/bug-attachments/reports/2026/10/a.png', document: null, failed: false })
    expect(body).toContain('```\n⿰亻哥\n```')
    expect(body).toContain('<https://ids.mkpo.li/#s=abc>')
    expect(body).toContain('![the reported drawing](https://github.com/mkpoli/han-compose/raw/bug-attachments/reports/2026/10/a.png)')
  })
  it('tabulates the environment', () => {
    const body = issueBody(report, noAttachments)
    expect(body).toContain('| Fact | Value |')
    expect(body).toContain('| Device pixel ratio | 2 |')
    expect(body).toContain('| Loaded fonts | Noto Serif CJK |')
    expect(body).toContain('| Composer base URL | https://ids.mkpo.li/composer/ |')
    expect(body).toContain('| Preview state | failed / failed |')
    expect(body).toContain('| Han face | serif |')
    expect(body).toContain('| Preview version | true |')
    expect(body).toContain('| History entries | 2 |')
  })
  it('folds the console output and the document away', () => {
    const body = issueBody(report, noAttachments)
    expect(body).toContain('<details><summary>Console output</summary>')
    expect(body).toContain('TypeError: x is not a function')
    expect(body).toContain('```json\n{"root":{}}\n```')
  })
  it('names the reporter, or says there is none', () => {
    // Neutralised so the contact does not notify anyone.
    expect(issueBody(report, noAttachments)).toContain('@\u200bsomeone')
    expect(issueBody(emptyReport(), noAttachments)).toContain('Anonymous visitor')
  })
  it('says when an attachment could not be stored', () => {
    expect(issueBody(report, { image: null, document: null, failed: true })).toContain('could not be stored')
  })
  it('links the uploaded document file', () => {
    const body = issueBody(report, { image: null, document: 'https://example/d.json', failed: false })
    expect(body).toContain('[the reported document](https://example/d.json)')
  })
  it('cuts a document too big for an issue, and says so', () => {
    const big = emptyReport({ document: `{"pad":"${'x'.repeat(250_000)}"}` })
    const body = issueBody(big, { image: null, document: 'https://example/d.json', failed: false })
    expect(body.length).toBeLessThanOrEqual(MAX_BODY_CHARS)
    expect(body).toContain('The document was cut at 20000 characters. The whole document is attached below.')
    expect(body).toContain('[the reported document](https://example/d.json)')
  })
  it('cuts console output that runs long', () => {
    const noisy = emptyReport({ context: { console: Array.from({ length: 4000 }, (_, index) => `line ${index}`) } })
    const body = issueBody(noisy, noAttachments)
    expect(body.length).toBeLessThanOrEqual(MAX_BODY_CHARS)
    expect(body).toContain('The console output was cut at 8000 characters.')
  })
  it('keeps the body within what an issue takes even when every field is huge', () => {
    const huge = emptyReport({
      symptom: 'x'.repeat(4000),
      sequence: '⿰'.repeat(2000),
      document: `{"pad":"${'x'.repeat(250_000)}"}`,
      context: Object.fromEntries([
        ['console', Array.from({ length: 5000 }, () => 'a noisy line of console output')],
        ...['appVersion', 'commit', 'route', 'viewport', 'locale', 'theme', 'userAgent', 'platform', 'composerBase'].map(key => [key, 'y'.repeat(3000)]),
        ['fonts', Array.from({ length: 200 }, (_, index) => `Font ${index}`)],
      ]),
    })
    expect(issueBody(huge, noAttachments).length).toBeLessThanOrEqual(MAX_BODY_CHARS)
  })
  it('shortens a single overlong table cell', () => {
    expect(cell('z'.repeat(900))).toBe(`${'z'.repeat(500)}…`)
  })
  it('writes a one-line comment for a repeat', () => {
    expect(duplicateComment('2026-10-31T00:00:00.000Z')).toBe('Reported again at 2026-10-31T00:00:00.000Z.')
  })
})

describe('submitted fields', () => {
  it('drops control characters and normalises newlines', () => {
    expect(cleanText('a\u0000b\u001Bc\u007Fd\r\ne\tf')).toBe('abcd\ne\tf')
  })
  it('measures text in UTF-8 bytes', () => {
    expect(byteLength('亻')).toBe(3)
  })
  it('judges the body from Content-Length before reading it', () => {
    expect(checkBodySize(new Headers({ 'content-length': '12' }))).toBeNull()
    expect(checkBodySize(new Headers())).toBeNull()
    expect(checkBodySize(new Headers({ 'content-length': String(9 * 1024 * 1024) }))?.status).toBe(413)
  })
  it('takes only a multipart form', () => {
    expect(checkMediaType(new Headers({ 'content-type': 'multipart/form-data; boundary=x' }))).toBeNull()
    expect(checkMediaType(new Headers({ 'content-type': 'application/json' }))?.error).toBe('unsupported_media_type')
  })
  it('names the image type from its magic bytes', () => {
    expect(sniffImage(PNG)).toEqual({ mime: 'image/png', ext: 'png' })
    expect(sniffImage(JPEG)).toEqual({ mime: 'image/jpeg', ext: 'jpg' })
    expect(sniffImage(WEBP)).toEqual({ mime: 'image/webp', ext: 'webp' })
    expect(sniffImage(new Uint8Array([0x3c, 0x73, 0x76, 0x67]))).toBeNull()
  })
})

describe('parsing a report', () => {
  const parse = (fields, files) => parseReport(reportForm(fields, files), { siteOrigins: [SITE] })

  it('reads the fields it was given', async () => {
    const parsed = await parse({ link: `${SITE}/#s=abc`, context: '{"locale":"ja"}', contact: '@someone', document: '{"a":1}' })
    expect(parsed.ok).toBe(true)
    expect(parsed.report.symptom).toBe('The preview is blank.')
    expect(parsed.report.sequence).toBe('⿰亻哥')
    expect(parsed.report.context).toEqual({ locale: 'ja' })
  })
  it('insists on a symptom', async () => {
    const parsed = await parse({ symptom: '   ' })
    expect(parsed).toMatchObject({ ok: false, status: 400, error: 'invalid_request' })
  })
  it('refuses an overlong symptom', async () => {
    expect((await parse({ symptom: 'x'.repeat(4001) })).status).toBe(400)
  })
  it('refuses an overlong sequence', async () => {
    expect((await parse({ sequence: 'x'.repeat(2001) })).status).toBe(400)
  })
  it('refuses a share link pointing anywhere else', async () => {
    expect((await parse({ link: 'https://evil.example/#s=abc' })).status).toBe(400)
    expect((await parse({ link: `${SITE}/#s=abc` })).ok).toBe(true)
  })
  it('refuses a document or a context that is not JSON', async () => {
    expect((await parse({ document: 'not json' })).status).toBe(400)
    expect((await parse({ context: '[1,2]' })).status).toBe(400)
  })
  it('refuses a context over its limit', async () => {
    expect((await parse({ context: JSON.stringify({ pad: 'x'.repeat(33 * 1024) }) })).status).toBe(413)
  })
  it('ignores a fingerprint the client offers', async () => {
    const parsed = await parse({ fingerprint: 'whatever' })
    expect(parsed.ok).toBe(true)
    expect('fingerprint' in parsed.report).toBe(false)
  })
  it('takes the extension from the sniff, not from the name', async () => {
    const parsed = await parse({}, { image: new File([PNG], 'drawing.svg', { type: 'image/svg+xml' }) })
    expect(parsed.report.image).toMatchObject({ ext: 'png', mime: 'image/png' })
  })
  it('refuses an image that is not one of the three types', async () => {
    const parsed = await parse({}, { image: new File([new Uint8Array([0x3c, 0x73, 0x76, 0x67])], 'x.png', { type: 'image/png' }) })
    expect(parsed).toMatchObject({ ok: false, status: 415 })
  })
  it('refuses a document file that is not JSON', async () => {
    const parsed = await parse({}, { documentFile: new File(['nope'], 'd.json', { type: 'application/json' }) })
    expect(parsed).toMatchObject({ ok: false, status: 400 })
  })
})

describe('rate limits and dedupe', () => {
  it('collapses whitespace and case into one key', async () => {
    const a = await dedupeKey('⿰亻哥', 'The   preview\nis BLANK.')
    const b = await dedupeKey('⿰亻哥', 'the preview is blank.')
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })
  it('separates different reports', async () => {
    expect(await dedupeKey('⿰亻哥', 'one')).not.toBe(await dedupeKey('⿰亻哥', 'two'))
  })
  it('keeps the boundary between the sequence and the symptom', async () => {
    expect(await dedupeKey('a', 'b c')).not.toBe(await dedupeKey('a b', 'c'))
  })
  it('spends the day’s total across its shards', async () => {
    const env = fakeEnv()
    const now = Date.parse('2026-10-31T09:30:00Z')
    for (let shard = 0; shard < 10; shard += 1) await env.REPORTS.put(`rate:all:d:2026-10-31:${shard}`, '30')
    expect(await checkRate(env, '203.0.113.9', now)).toEqual({ ok: false, scope: 'total-day' })
    await env.REPORTS.put('rate:all:d:2026-10-31:3', '29')
    expect(await checkRate(env, '203.0.113.9', now)).toEqual({ ok: true })
  })
  it('spreads its writes over more than one key', async () => {
    const env = fakeEnv()
    const now = Date.parse('2026-10-31T09:30:00Z')
    for (let count = 0; count < 60; count += 1) await checkRate(env, `203.0.113.${count}`, now)
    const shards = [...env.REPORTS.store.keys()].filter(key => key.startsWith('rate:all:d:'))
    expect(shards.length).toBeGreaterThan(1)
    expect([...env.REPORTS.store.entries()].filter(([key]) => key.startsWith('rate:all:d:')).reduce((sum, [, value]) => sum + Number(value), 0)).toBe(60)
  })
  it('files the report even when a counter cannot be written', async () => {
    const env = fakeEnv()
    env.REPORTS.put = async key => {
      if (key.startsWith('rate:')) throw new Error('KV write limit')
    }
    expect(await checkRate(env, '203.0.113.8', Date.now())).toEqual({ ok: true })
  })
  it('stops everyone once the day’s total is spent', async () => {
    const env = fakeEnv()
    const now = Date.parse('2026-10-31T09:30:00Z')
    await env.REPORTS.put('rate:all:d:2026-10-31:0', String(TOTAL_PER_DAY))
    expect(await checkRate(env, '203.0.113.3', now)).toEqual({ ok: false, scope: 'total-day' })
  })
  it('lets five reports an hour through and stops the sixth', async () => {
    const env = fakeEnv()
    const now = Date.parse('2026-10-31T09:30:00Z')
    for (let count = 0; count < PER_HOUR; count += 1) expect(await checkRate(env, '203.0.113.1', now)).toEqual({ ok: true })
    expect(await checkRate(env, '203.0.113.1', now)).toEqual({ ok: false, scope: 'ip-hour' })
  })
  it('stops an address once its day is spent, across hours', async () => {
    const env = fakeEnv()
    const start = Date.parse('2026-10-31T00:30:00Z')
    for (let count = 0; count < PER_DAY; count += 1) {
      expect(await checkRate(env, '203.0.113.2', start + Math.floor(count / 4) * 3600_000)).toEqual({ ok: true })
    }
    expect(await checkRate(env, '203.0.113.2', start + 20 * 3600_000)).toEqual({ ok: false, scope: 'ip-day' })
  })
  it('remembers the issue a report opened', async () => {
    const env = fakeEnv()
    expect(await findDuplicate(env, 'key')).toBeNull()
    await rememberIssue(env, 'key', { number: 7, url: 'https://github.com/mkpoli/han-compose/issues/7' })
    expect(await findDuplicate(env, 'key')).toEqual({ number: 7, url: 'https://github.com/mkpoli/han-compose/issues/7' })
  })
})

describe('blob encoding', () => {
  it('encodes bytes GitHub’s way', () => {
    expect(toBase64(PNG)).toBe(Buffer.from(PNG).toString('base64'))
  })
  it('encodes more bytes than one call to String.fromCharCode takes', () => {
    const big = new Uint8Array(100_000).map((_, index) => index % 251)
    expect(toBase64(big)).toBe(Buffer.from(big).toString('base64'))
  })
})

describe('the endpoint', () => {
  it('answers the health check', async () => {
    const response = await handle(new Request('https://reports.example/health'), fakeEnv())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })
  it('answers a preflight with the methods it takes', async () => {
    const response = await handle(new Request('https://reports.example/', { method: 'OPTIONS', headers: { origin: SITE } }), fakeEnv())
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe(SITE)
    expect(response.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS')
    expect(response.headers.get('vary')).toBe('Origin')
  })
  it('allows the workshop, its previews, the desktop app and any port of localhost, and nothing else', () => {
    expect(originAllowed(SITE, SITE)).toBe(true)
    expect(originAllowed('http://localhost:5173', SITE)).toBe(true)
    expect(originAllowed('http://localhost', SITE)).toBe(true)
    expect(originAllowed(null, SITE)).toBe(true)
    expect(originAllowed('https://ids-input-workshop.mkpoli.workers.dev', SITE)).toBe(true)
    expect(originAllowed('https://feat-demo-abc123-ids-input-workshop.mkpoli.workers.dev', SITE)).toBe(true)
    expect(originAllowed('tauri://localhost', SITE)).toBe(true)
    expect(originAllowed('http://tauri.localhost', SITE)).toBe(true)
    expect(originAllowed('tauri://localhost.evil.example', SITE)).toBe(false)
    expect(originAllowed('https://tauri.localhost', SITE)).toBe(false)
    expect(originAllowed('https://evil.example', SITE)).toBe(false)
    expect(originAllowed(RARE, SITE)).toBe(false)
    expect(originAllowed('https://ids-input-workshop.mkpoli.workers.dev.evil.example', SITE)).toBe(false)
    expect(originAllowed('http://localhost.evil.example', SITE)).toBe(false)
  })
  it('turns a stranger away', async () => {
    const response = await handle(postReport(reportForm(), { origin: 'https://evil.example' }), fakeEnv())
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: 'forbidden_origin' })
  })
  it('takes no method but POST', async () => {
    const response = await handle(new Request('https://reports.example/', { method: 'PUT', headers: { origin: SITE } }), fakeEnv())
    expect(response.status).toBe(405)
    expect(await response.json()).toMatchObject({ error: 'method_not_allowed' })
  })
  it('refuses a body that is not a multipart form', async () => {
    const request = new Request('https://reports.example/', { method: 'POST', body: '{}', headers: { origin: SITE, 'content-type': 'application/json' } })
    const response = await handle(request, fakeEnv())
    expect(response.status).toBe(415)
  })
  it('refuses a body bigger than the cap before reading it', async () => {
    const request = new Request('https://reports.example/', {
      method: 'POST',
      body: reportForm(),
      headers: { origin: SITE },
    })
    const headers = new Headers(request.headers)
    headers.set('content-length', String(9 * 1024 * 1024))
    const response = await handle(new Request(request, { headers }), fakeEnv())
    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({ error: 'too_large' })
  })
  it('stops a body that runs past the cap with no Content-Length to warn of it', async () => {
    const chunk = new Uint8Array(1024 * 1024)
    let sent = 0
    const body = new ReadableStream({
      pull(controller) {
        if (sent >= 10) return controller.close()
        sent += 1
        controller.enqueue(chunk)
      },
    })
    const request = new Request('https://reports.example/', {
      method: 'POST',
      body,
      duplex: 'half',
      headers: { origin: SITE, 'content-type': 'multipart/form-data; boundary=x' },
    })
    expect(request.headers.get('content-length')).toBeNull()
    const response = await handle(request, fakeEnv())
    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({ error: 'too_large' })
  })
  it('lets a body under the cap through the meter', async () => {
    const metered = meterBody(postReport(reportForm()), MAX_BODY)
    const form = await metered.request.formData()
    expect(form.get('symptom')).toBe('The preview is blank.')
    expect(metered.overrun.exceeded).toBe(false)
  })
  it('hands the report to the workshop action, then answers with the issue it filed', async () => {
    const env = fakeEnv()
    /** @type {any} */
    let dispatch = null
    stub = stubAction({ asked: body => { dispatch = body } })
    const form = reportForm({ context: '{"locale":"ja"}', link: `${SITE}/#s=abc` }, { image: new File([PNG], 'drawing.png', { type: 'image/png' }) })
    const response = await handle(postReport(form), env)
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ number: 123, url: 'https://github.com/mkpoli/han-compose/issues/123', duplicate: false })
    const labels = stub.calls.filter(call => call.key === 'POST /repos/mkpoli/han-compose/labels').map(call => call.body.name)
    expect(labels).toEqual(['report', 'needs-triage', 'from: ids-input', 'lang:ja'])
    // The dispatch carries the fields as text, the key and the word that a drawing was sent, and
    // nothing of the image.
    const key = await dedupeKey('⿰亻哥', 'The preview is blank.')
    expect(dispatch.event_type).toBe('report')
    expect(dispatch.client_payload.key).toBe(key)
    expect(dispatch.client_payload.drawing).toBe(true)
    expect(dispatch.client_payload.report).toMatchObject({ symptom: 'The preview is blank.', sequence: '⿰亻哥', context: '{"locale":"ja"}' })
    expect('image' in dispatch.client_payload.report).toBe(false)
    // The run opened the issue, under the labels the endpoint looks among and with the report's mark.
    const filed = stub.calls.find(call => call.key === `POST ${ISSUES}`).body
    expect(filed.title).toBe('report: ⿰亻哥 — The preview is blank.')
    expect(filed.labels).toEqual(['report', 'needs-triage', 'from: ids-input', 'lang:ja'])
    expect(filed.body.endsWith(`${reportMarker(key)}\n`)).toBe(true)
    const looks = stub.calls.filter(call => call.key === `GET ${ISSUES}`)
    expect(new URL(looks[0].url).searchParams.get('labels')).toBe('report')
    expect(await env.REPORTS.get(`report:${key}`, 'json')).toEqual({
      number: 123,
      url: 'https://github.com/mkpoli/han-compose/issues/123',
    })
  })
  it('asks for no drawing without both the reporter’s picture and a link to open', async () => {
    const image = { image: new File([PNG], 'drawing.png', { type: 'image/png' }) }
    for (const form of [reportForm({ link: `${SITE}/#s=abc` }), reportForm({}, image)]) {
      /** @type {any} */
      let dispatch = null
      stub = stubAction({ asked: body => { dispatch = body } })
      const response = await handle(postReport(form), fakeEnv())
      expect(response.status).toBe(201)
      expect(dispatch.client_payload.drawing).toBe(false)
      stub.restore()
    }
  })
  it('passes over an issue that only quotes the report’s mark', async () => {
    const key = await dedupeKey('⿰亻哥', 'The preview is blank.')
    stub = stubAction({ issues: [
      { number: 7, html_url: 'https://github.com/mkpoli/han-compose/issues/7', body: `\`\`\`\n${reportMarker(key)}\n\`\`\`\n<!-- report:${'0'.repeat(64)} -->\n` },
    ] })
    const response = await handle(postReport(reportForm()), fakeEnv())
    expect(await response.json()).toMatchObject({ number: 123, duplicate: false })
    expect(stub.calls.some(call => call.key === 'POST /repos/mkpoli/han-compose/dispatches')).toBe(true)
  })
  it('answers a report sent again with the issue its first run filed', async () => {
    const key = await dedupeKey('⿰亻哥', 'The preview is blank.')
    stub = stubGitHub({ issues: [
      { number: 7, html_url: 'https://github.com/mkpoli/han-compose/issues/7', body: 'another report\n<!-- report:0000 -->\n' },
      { number: 8, html_url: 'https://github.com/mkpoli/han-compose/issues/8', body: `late\n${reportMarker(key)}\n` },
    ] })
    const response = await handle(postReport(reportForm()), fakeEnv())
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ number: 8, url: 'https://github.com/mkpoli/han-compose/issues/8', duplicate: false })
    expect(stub.calls.some(call => call.key === 'POST /repos/mkpoli/han-compose/dispatches')).toBe(false)
  })
  it('keeps looking when one look fails', async () => {
    let looks = 0
    stub = stubAction({
      routes: { [`GET ${ISSUES}`]: () => {
        looks += 1
        if (looks === 2) return new Response(JSON.stringify({ message: 'Server Error' }), { status: 500 })
        return new Response(JSON.stringify(looks < 3 ? [] : stub.issues), { status: 200 })
      } },
    })
    const response = await handle(postReport(reportForm()), fakeEnv())
    expect(response.status).toBe(201)
    expect(looks).toBe(3)
  })
  it('turns away a report whose fields cannot ride a dispatch', async () => {
    const env = fakeEnv()
    stub = stubAction()
    const document = JSON.stringify({ root: 'x'.repeat(40 * 1024) })
    const response = await handle(postReport(reportForm({ document })), env)
    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({ error: 'too_large' })
    expect(stub.calls.some(call => call.key === 'POST /repos/mkpoli/han-compose/dispatches')).toBe(false)
  })
  it('says so when the action files no issue in time', async () => {
    const env = fakeEnv()
    stub = stubAction({ files: false })
    const response = await handle(postReport(reportForm()), env, 3)
    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ error: 'upstream_error' })
    expect(await findDuplicate(env, await dedupeKey('⿰亻哥', 'The preview is blank.'))).toBeNull()
  })
  it('comments on the issue a repeat matches instead of filing another', async () => {
    stub = stubGitHub()
    const env = fakeEnv()
    await rememberIssue(env, await dedupeKey('⿰亻哥', 'The preview is blank.'), {
      number: 42,
      url: 'https://github.com/mkpoli/han-compose/issues/42',
    })
    const response = await handle(postReport(reportForm()), env)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ number: 42, url: 'https://github.com/mkpoli/han-compose/issues/42', duplicate: true })
    expect(stub.calls.map(call => call.key)).toEqual(['POST /repos/mkpoli/han-compose/issues/42/comments'])
  })
  it('files afresh when the issue a repeat matched has gone', async () => {
    stub = stubAction({
      routes: { 'POST /repos/mkpoli/han-compose/issues/42/comments': () => new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 }) },
    })
    const env = fakeEnv()
    const key = await dedupeKey('⿰亻哥', 'The preview is blank.')
    await rememberIssue(env, key, { number: 42, url: 'https://github.com/mkpoli/han-compose/issues/42' })
    const response = await handle(postReport(reportForm()), env)
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ number: 123, duplicate: false })
    expect(await findDuplicate(env, key)).toMatchObject({ number: 123 })
  })
  it('still answers duplicate when only the comment fails', async () => {
    stub = stubGitHub({
      routes: { 'POST /repos/mkpoli/han-compose/issues/42/comments': () => new Response(JSON.stringify({ message: 'Server Error' }), { status: 500 }) },
    })
    const env = fakeEnv()
    await rememberIssue(env, await dedupeKey('⿰亻哥', 'The preview is blank.'), { number: 42, url: 'https://github.com/mkpoli/han-compose/issues/42' })
    const response = await handle(postReport(reportForm()), env)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ number: 42, duplicate: true })
  })
  it('turns away an address that has filed too many', async () => {
    const env = fakeEnv()
    await env.REPORTS.put(`rate:ip:198.51.100.7:h:${Math.floor(Date.now() / 1000 / 3600)}`, '5')
    const response = await handle(postReport(reportForm()), env)
    expect(response.status).toBe(429)
    expect(await response.json()).toMatchObject({ error: 'rate_limited' })
  })
  it('still reports success when the dedupe write fails after filing', async () => {
    stub = stubAction()
    const env = fakeEnv()
    const put = env.REPORTS.put.bind(env.REPORTS)
    env.REPORTS.put = async (key, value) => {
      if (key.startsWith('report:')) throw new Error('KV is unavailable')
      return put(key, value)
    }
    const response = await handle(postReport(reportForm()), env)
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ number: 123, duplicate: false })
  })
  it('answers 502 rather than nothing when KV itself is down', async () => {
    const env = fakeEnv()
    env.REPORTS.get = async () => {
      throw new Error('KV is unavailable')
    }
    const response = await handle(postReport(reportForm()), env)
    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ error: 'upstream_error' })
    expect(response.headers.get('access-control-allow-origin')).toBe(SITE)
  })
  it('survives a context built to break the renderer', async () => {
    // The Worker reads the context for the labels; the Action renders the body.
    const hostile = JSON.stringify({ console: [{ toString: null }], fonts: [{ toString: null }], locale: { toString: null } })
    stub = stubAction()
    const response = await handle(postReport(reportForm({ context: hostile })), fakeEnv())
    expect(response.status).toBe(201)
    const labels = stub.calls.filter(call => call.key === 'POST /repos/mkpoli/han-compose/labels').map(call => call.body.name)
    expect(labels).toEqual(['report', 'needs-triage', 'from: ids-input'])
  })
  it('answers 502 when GitHub refuses the dispatch', async () => {
    stub = stubGitHub({
      routes: { 'POST /repos/mkpoli/han-compose/dispatches': () => new Response(JSON.stringify({ message: 'nope' }), { status: 503 }) },
    })
    const response = await handle(postReport(reportForm()), fakeEnv())
    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ error: 'upstream_error' })
  })
  it('checks Turnstile only when a secret is configured', async () => {
    stub = stubGitHub({
      routes: {
        'POST /turnstile/v0/siteverify': () => new Response(JSON.stringify({ success: false }), { status: 200 }),
      },
    })
    const response = await handle(postReport(reportForm({ turnstile: 'token' })), fakeEnv({ TURNSTILE_SECRET: 'secret' }))
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: 'captcha_failed' })
  })
  it('lets a passing challenge through', async () => {
    stub = stubAction({
      routes: { 'POST /turnstile/v0/siteverify': () => new Response(JSON.stringify({ success: true }), { status: 200 }) },
    })
    const response = await handle(postReport(reportForm({ turnstile: 'token' })), fakeEnv({ TURNSTILE_SECRET: 'secret' }))
    expect(response.status).toBe(201)
  })
})

describe('the action', () => {
  const key = 'a'.repeat(64)
  const run = { REPO: 'mkpoli/han-compose', GITHUB_TOKEN: 'run-token' }
  const payload = (over = {}) => ({ key, drawing: true, report: { symptom: 'The preview is blank.', sequence: '⿰亻哥', link: `${SITE}/?ids=x`, contact: '@someone' }, ...over })

  it('files the dispatched report with the run’s token', async () => {
    stub = stubGitHub({ issueNumber: 9 })
    const original = globalThis.fetch
    /** @type {string[]} */
    const tokens = []
    globalThis.fetch = (input, init) => {
      tokens.push(init.headers.authorization)
      return original(input, init)
    }
    expect(await fileReport(payload(), run)).toEqual({ number: 9, url: 'https://github.com/mkpoli/han-compose/issues/9' })
    expect(tokens).toEqual(['Bearer run-token'])
    expect(stub.calls.map(call => call.key)).toEqual([`POST ${ISSUES}`])
    expect(stub.calls[0].body.body).toContain('@\u200bsomeone')
  })
  it('refuses a dispatch without a report or a key', async () => {
    stub = stubGitHub()
    await expect(fileReport({ key }, run)).rejects.toThrow('no report')
    await expect(fileReport(payload({ key: 'short' }), run)).rejects.toThrow('no key')
    await expect(fileReport(payload({ report: { symptom: '' } }), run)).rejects.toThrow('does not read')
    expect(stub.calls).toEqual([])
  })
  it('commits the drawing and shows it in the issue', async () => {
    stub = stubGitHub()
    /** @type {URL[]} */
    const opened = []
    /** @type {(string | null)[]} */
    const faces = []
    const address = await drawReport(payload(), run, 9, async (page, face) => {
      opened.push(page)
      faces.push(face)
      return PNG
    })
    expect(opened.map(String)).toEqual([`${SITE}/?ids=x`])
    // The report names no face, so the workshop's own choice is photographed.
    expect(faces).toEqual([null])
    expect(address).toMatch(/^https:\/\/github\.com\/mkpoli\/han-compose\/raw\/bug-attachments\/reports\/\d{4}\/\d{2}\/[0-9a-f-]+\.png$/)
    expect(stub.calls.find(call => call.key === 'POST /repos/mkpoli/han-compose/git/blobs').body).toEqual({ content: toBase64(PNG), encoding: 'base64' })
    const rewritten = stub.calls.find(call => call.key === `PATCH ${ISSUES}/9`).body.body
    expect(rewritten).toContain(`![the reported drawing](${address})`)
    expect(rewritten.endsWith(`${reportMarker(key)}\n`)).toBe(true)
  })
  it('photographs the drawing in the face the reporter drew in', async () => {
    /** @type {(string | null)[]} */
    const faces = []
    const inFace = (/** @type {unknown} */ face) => payload({ report: { ...payload().report, context: JSON.stringify({ face }) } })
    // One stub for the four runs: each new one would keep the one before as the fetch to restore.
    stub = stubGitHub()
    for (const face of ['serif', 'pen-writing', 'comic', 7]) {
      await drawReport(inFace(face), run, 9, async (_page, chosen) => { faces.push(chosen); return PNG })
    }
    // A face the font switch does not offer is not handed to the page.
    expect(faces).toEqual(['serif', 'pen-writing', null, null])
  })
  it('says so in the issue when the drawing cannot be taken', async () => {
    stub = stubGitHub()
    await expect(drawReport(payload(), run, 9, async () => { throw new Error('the page never composed') })).rejects.toThrow('never composed')
    const rewritten = stub.calls.find(call => call.key === `PATCH ${ISSUES}/9`).body.body
    expect(rewritten).toContain('could not be stored')
    expect(rewritten).not.toContain('![the reported drawing]')
  })
  it('fails on why the drawing was not taken even when the issue cannot be rewritten', async () => {
    stub = stubGitHub({ routes: { [`PATCH ${ISSUES}/9`]: () => new Response(JSON.stringify({ message: 'Server Error' }), { status: 500 }) } })
    await expect(drawReport(payload(), run, 9, async () => { throw new Error('the page never composed') })).rejects.toThrow('never composed')
  })
})

describe('reports from two sites', () => {
  const SITES = `${SITE},${RARE}`
  const rareContext = JSON.stringify({ site: 'rare', style: 'songti', layout: 'v4', composerVersion: '0.1.0', locale: 'ja', record: 'X-00053' })
  const rareForm = () =>
    reportForm({ context: rareContext, link: `${RARE}/ja/entry/X-00053`, sequence: '⿰亻哥', document: '{}' }, { image: new File([PNG], 'drawing.png', { type: 'image/png' }) })

  it('allows every origin in the list, and nothing else', () => {
    expect(originAllowed(SITE, SITES)).toBe(true)
    expect(originAllowed(RARE, SITES)).toBe(true)
    expect(originAllowed('http://localhost:5173', SITES)).toBe(true)
    expect(originAllowed('tauri://localhost', SITES)).toBe(true)
    expect(originAllowed('https://ids-input-workshop.mkpoli.workers.dev', SITES)).toBe(true)
    expect(originAllowed('https://rare.glyphatlas.org.evil.example', SITES)).toBe(false)
    expect(originAllowed('https://glyphatlas.org', SITES)).toBe(false)
  })
  it('answers a preflight from the compendium', async () => {
    const response = await handle(new Request('https://reports.example/', { method: 'OPTIONS', headers: { origin: RARE } }), fakeEnv())
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe(RARE)
  })
  it('takes a share link from either site', async () => {
    const parse = link => parseReport(reportForm({ link }), { siteOrigins: [SITE, RARE] })
    expect((await parse(`${RARE}/ja/entry/1`)).ok).toBe(true)
    expect((await parse(`${SITE}/#s=abc`)).ok).toBe(true)
    expect((await parse('https://evil.example/x')).ok).toBe(false)
  })
  it('labels a report with the site it came from', () => {
    expect(labelsFor({ site: 'rare', locale: 'ja' })).toEqual(['report', 'needs-triage', 'from: rare-compendium', 'lang:ja'])
    expect(labelsFor({ site: 'other' })).toEqual(['report', 'needs-triage', 'from: ids-input'])
  })
  it('files a compendium report under its label, with its own drawing and no photograph', async () => {
    let dispatch = null
    stub = stubAction({ asked: body => { dispatch = body } })
    const response = await handle(postReport(rareForm(), { origin: RARE }), fakeEnv())
    expect(response.status).toBe(201)
    expect(response.headers.get('access-control-allow-origin')).toBe(RARE)
    const labels = stub.calls.filter(call => call.key === 'POST /repos/mkpoli/han-compose/labels').map(call => call.body.name)
    expect(labels).toEqual(['report', 'needs-triage', 'from: rare-compendium', 'lang:ja'])
    expect(dispatch.client_payload.drawing).toBe(false)
    expect(dispatch.client_payload.image).toMatch(/^https:\/\/github\.com\/mkpoli\/han-compose\/raw\/bug-attachments\/reports\/\d{4}\/\d{2}\/[0-9a-f-]+\.png$/)
    const filed = stub.calls.find(call => call.key === `POST ${ISSUES}`).body
    expect(filed.labels).toEqual(['report', 'needs-triage', 'from: rare-compendium', 'lang:ja'])
    expect(filed.body).toContain(`![the reported drawing](${dispatch.client_payload.image})`)
    expect(filed.body).toContain('| Record | X-00053 |')
    expect(stub.calls.some(call => call.key === 'POST /repos/mkpoli/han-compose/git/blobs')).toBe(true)
  })
  it('still labels a workshop report from ids-input and leaves the photograph to the run', async () => {
    let dispatch = null
    stub = stubAction({ asked: body => { dispatch = body } })
    const form = reportForm({ link: `${SITE}/#s=abc` }, { image: new File([PNG], 'drawing.png', { type: 'image/png' }) })
    expect((await handle(postReport(form), fakeEnv())).status).toBe(201)
    expect(dispatch.client_payload.drawing).toBe(true)
    expect(dispatch.client_payload.image).toBeNull()
    expect(stub.calls.find(call => call.key === `POST ${ISSUES}`).body.labels).toEqual(['report', 'needs-triage', 'from: ids-input'])
  })
  it('refuses an image address that is not the repository’s attachment branch', async () => {
    stub = stubGitHub({ issueNumber: 9 })
    const run = { REPO: 'mkpoli/han-compose', GITHUB_TOKEN: 'run-token' }
    const fields = { symptom: 'x', context: rareContext }
    await fileReport({ key: 'a'.repeat(64), image: 'https://evil.example/a.png', report: fields }, run)
    expect(stub.calls[0].body.body).not.toContain('evil.example')
  })
})
