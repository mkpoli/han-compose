// @ts-check
// The issue a report becomes: its title, and its body in a fixed order. Every value that came from
// the client is escaped here, so no submitted text can format the issue or reach GitHub as HTML.

/** @typedef {import('./validate.js').Report} Report */
/**
 * @typedef {object} Attachments
 * @property {string | null} image the raw URL of the reported drawing, when it was stored
 * @property {string | null} document the raw URL of the uploaded document file, when it was stored
 * @property {boolean} failed whether an attachment was offered but could not be stored
 */

export const LABEL_LOCALES = ['en', 'ja', 'zh-Hans', 'zh-Hant', 'ko', 'vi']

/** The rows of the environment table, in order: the context key and the name it reads under. */
const ENVIRONMENT = [
  ['appVersion', 'App version'],
  ['commit', 'Build commit'],
  ['route', 'Route'],
  ['preview', 'Preview state'],
  ['viewport', 'Viewport'],
  ['devicePixelRatio', 'Device pixel ratio'],
  ['locale', 'Locale'],
  ['theme', 'Theme'],
  ['face', 'Han face'],
  ['userAgent', 'User agent'],
  ['platform', 'Platform'],
  ['fonts', 'Loaded fonts'],
  ['composerBase', 'Composer base URL'],
  ['local', 'Local build'],
  ['previewVersion', 'Preview version'],
  ['historyLength', 'History entries'],
]

/** The extra rows of a compendium report's table. */
const RARE_ENVIRONMENT = [
  ['site', 'Site'],
  ['record', 'Record'],
  ['style', 'Style'],
  ['layout', 'Layout'],
  ['composerVersion', 'Composer version'],
]

/**
 * Text that renders as itself. Every ASCII punctuation mark Markdown gives a meaning is
 * backslash-escaped, and a line that would open a list or a heading loses its marker's meaning too.
 * @param {string} text @returns {string}
 */
export function escapeMarkdown(text) {
  return text
    .replace(/[\\`*_{}[\]()#+|<>~!&]/g, match => `\\${match}`)
    // A backslash does not stop a mention, so `@someone` in a symptom would notify them; a
    // zero-width space does, and an address like `me@example.com` keeps its shape.
    .replace(/(^|\s)@(?=[\w-])/g, '$1@\u200b')
    .split('\n')
    .map(line =>
      line
        .replace(/^(\s*)([-=]+)(\s*)$/, '$1\\$2$3')
        .replace(/^(\s*)(\d+)\.(?=\s|$)/, '$1$2\\.')
        .replace(/^(\s*)-(?=\s|$)/, '$1\\-'),
    )
    .join('\n')
}

/**
 * `value` as text. A context arrives as parsed JSON, so an object in it can carry a `toString` that
 * throws; this never does.
 * @param {unknown} value @returns {string}
 */
export function asText(value) {
  if (typeof value === 'string') return value
  try {
    return String(value)
  } catch {
    try {
      return JSON.stringify(value) ?? ''
    } catch {
      return ''
    }
  }
}

/**
 * A URL as a clickable autolink. Parsing it first percent-encodes the few characters that would end
 * the autolink early, so a submitted link cannot reach beyond its own angle brackets.
 * @param {string} link @returns {string}
 */
export function autolink(link) {
  try {
    return `<${new URL(link).href}>`
  } catch {
    return escapeMarkdown(link)
  }
}

/**
 * GitHub refuses an issue body over 65536 characters, and a report may carry a 200 KB document, so
 * each part that a reporter controls is cut to a share of the budget before the body is assembled.
 */
export const MAX_BODY_CHARS = 65000
const MAX_DOCUMENT_CHARS = 20000
const MAX_LOG_CHARS = 8000
const MAX_CELL_CHARS = 500

/** `text` cut to `limit`, and whether it had to be. @param {string} text @param {number} limit */
const clip = (text, limit) => ({ text: text.length <= limit ? text : text.slice(0, limit), clipped: text.length > limit })

/** A value for one table cell: escaped, on a single line, and short enough to read. @param {unknown} value @returns {string} */
export function cell(value) {
  if (value === undefined || value === null || value === '') return '—'
  const text = Array.isArray(value) ? value.map(asText).join(', ') : typeof value === 'object' ? asText(JSON.stringify(value)) : asText(value)
  const short = clip(text.replace(/\s+/g, ' ').trim(), MAX_CELL_CHARS)
  return escapeMarkdown(short.clipped ? `${short.text}…` : short.text)
}

/**
 * A fence long enough to hold `content` — one backtick longer than the longest run inside it, and
 * never shorter than three.
 * @param {string} content @returns {string}
 */
export function fenceFor(content) {
  const runs = content.match(/`+/g) ?? []
  const longest = runs.reduce((most, run) => Math.max(most, run.length), 0)
  return '`'.repeat(Math.max(3, longest + 1))
}

/** `content` in a fenced block that it cannot escape. @param {string} content @param {string} [info] */
export function fenced(content, info = '') {
  const fence = fenceFor(content)
  return `${fence}${info}\n${content}\n${fence}`
}

/** `text` cut to `limit` characters, with an ellipsis where it was cut. @param {string} text @param {number} limit */
export function elide(text, limit) {
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`
}

/**
 * The issue title: the sequence under report, then the opening line of the symptom.
 * @param {{ sequence: string, symptom: string }} report @returns {string}
 */
export function issueTitle({ sequence, symptom }) {
  const brief = elide(symptom.split('\n')[0].trim().replace(/\s+/g, ' '), 60)
  return elide(sequence ? `report: ${sequence} — ${brief}` : `report: ${brief}`, 120)
}

/** The sites that send reports, by the `site` a report's context names, and the label each files under. */
const ORIGIN_LABELS = { rare: 'from: rare-compendium' }
const DEFAULT_ORIGIN_LABEL = 'from: ids-input'

/**
 * Whether a report comes from the rare-character compendium, which attaches its own drawing; every
 * other report comes from the IDS workshop.
 * @param {Record<string, unknown>} context @returns {boolean}
 */
export const fromRare = context => context.site === 'rare'

/**
 * The labels to file the report under: always `report`, `needs-triage` and the label naming the
 * site it came from, plus the reporter's language when the context names one the project triages.
 * @param {Record<string, unknown>} context @returns {string[]}
 */
export function labelsFor(context) {
  const locale = typeof context.locale === 'string' ? context.locale : ''
  const origin = fromRare(context) ? ORIGIN_LABELS.rare : DEFAULT_ORIGIN_LABEL
  const labels = ['report', 'needs-triage', origin]
  return LABEL_LOCALES.includes(locale) ? [...labels, `lang:${locale}`] : labels
}

/**
 * The issue body for a report.
 * @param {Report} report @param {Attachments} attachments @returns {string}
 */
export function issueBody(report, attachments) {
  const parts = [`## Symptom\n\n${escapeMarkdown(report.symptom)}`]

  const sequence = ['## Sequence']
  if (report.sequence) sequence.push(fenced(report.sequence))
  else sequence.push('_No sequence was being edited._')
  if (report.link) sequence.push(autolink(report.link))
  if (attachments.image) sequence.push(`![the reported drawing](${attachments.image})`)
  if (attachments.failed) sequence.push('_An attachment was offered with this report but could not be stored._')
  parts.push(sequence.join('\n\n'))

  const rows = (fromRare(report.context) ? [...RARE_ENVIRONMENT, ...ENVIRONMENT] : ENVIRONMENT).map(([key, name]) => `| ${name} | ${cell(report.context[key])} |`)
  parts.push(['## Environment', '', '| Fact | Value |', '| --- | --- |', ...rows].join('\n'))

  const lines = Array.isArray(report.context.console) ? report.context.console.map(asText) : []
  const log = clip(lines.length ? lines.join('\n') : 'No console output was captured.', MAX_LOG_CHARS)
  const logParts = [fenced(log.clipped ? `${log.text}\n…` : log.text)]
  if (log.clipped) logParts.push(`_The console output was cut at ${MAX_LOG_CHARS} characters._`)
  parts.push(`<details><summary>Console output</summary>\n\n${logParts.join('\n\n')}\n\n</details>`)

  const documentParts = []
  if (report.document) {
    const shown = clip(report.document, MAX_DOCUMENT_CHARS)
    documentParts.push(fenced(shown.clipped ? `${shown.text}\n…` : shown.text, 'json'))
    if (shown.clipped) {
      const whole = attachments.document ? ' The whole document is attached below.' : ''
      documentParts.push(`_The document was cut at ${MAX_DOCUMENT_CHARS} characters.${whole}_`)
    }
  } else {
    documentParts.push('_No document was attached._')
  }
  if (attachments.document) documentParts.push(`[the reported document](${attachments.document})`)
  parts.push(`<details><summary>Document</summary>\n\n${documentParts.join('\n\n')}\n\n</details>`)

  const reporter = report.contact ? escapeMarkdown(report.contact) : 'Anonymous visitor'
  parts.push(`<details><summary>Reporter</summary>\n\n${reporter}\n\n</details>`)

  const body = `${parts.join('\n\n')}\n`
  return body.length <= MAX_BODY_CHARS ? body : `${body.slice(0, MAX_BODY_CHARS - 40)}\n\n_This report was cut to fit an issue._\n`
}

/**
 * The mark an issue carries for the report it was filed from; the intake finds the issue by it.
 * @param {string} key the report's dedupe key @returns {string}
 */
export const reportMarker = key => `<!-- report:${key} -->`

/**
 * The body an issue is filed with: what the report says, then its mark.
 * @param {Report} report @param {string} key @param {Attachments} attachments @returns {string}
 */
export const filedBody = (report, key, attachments) => `${issueBody(report, attachments)}\n${reportMarker(key)}\n`

/** The comment left on an issue a repeat report matches. @param {string} when an ISO timestamp */
export const duplicateComment = when => `Reported again at ${when}.`
