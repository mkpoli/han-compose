// @ts-check
// Parsing and validation for a submitted report. Nothing here touches the network, KV or the clock:
// it takes the request's headers and its already read `FormData` and answers with either a clean
// report or the error code and sentence to reply with.

export const MAX_BODY = 8 * 1024 * 1024
export const MAX_SYMPTOM = 4000
export const MAX_SEQUENCE = 2000
export const MAX_DOCUMENT = 200 * 1024
export const MAX_CONTEXT = 32 * 1024
export const MAX_CONTACT = 200
export const MAX_IMAGE = 5 * 1024 * 1024

/** @typedef {{ bytes: Uint8Array, mime: string, ext: string }} Attachment */
/**
 * @typedef {object} Report
 * @property {string} symptom
 * @property {string} sequence
 * @property {string} link
 * @property {string} document
 * @property {Record<string, unknown>} context
 * @property {string} contact
 * @property {string} turnstile
 * @property {Attachment | null} image
 * @property {Attachment | null} documentFile
 */
/** @typedef {{ ok: true, report: Report }} Accepted */
/** @typedef {{ ok: false, status: number, error: string, message: string }} Rejected */

/** @param {number} status @param {string} error @param {string} message @returns {Rejected} */
const reject = (status, error, message) => ({ ok: false, status, error, message })

/**
 * Text without control characters. Tabs survive, every newline becomes `\n`, and the C0 and C1
 * ranges plus the delete character go away, so nothing a client sends can break out of a line.
 * @param {string} text @returns {string}
 */
export function cleanText(text) {
  return text.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
}

const MAGIC = [
  { ext: 'png', mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { ext: 'jpg', mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
]

/**
 * The image type the bytes actually are, by magic number, or null for anything else. The extension
 * comes from here and never from what the client called the file.
 * @param {Uint8Array} bytes @returns {{ mime: string, ext: string } | null}
 */
export function sniffImage(bytes) {
  for (const type of MAGIC) {
    if (bytes.length >= type.bytes.length && type.bytes.every((byte, index) => bytes[index] === byte)) {
      return { mime: type.mime, ext: type.ext }
    }
  }
  const riff = [0x52, 0x49, 0x46, 0x46]
  const webp = [0x57, 0x45, 0x42, 0x50]
  if (bytes.length >= 12 && riff.every((byte, index) => bytes[index] === byte) && webp.every((byte, index) => bytes[8 + index] === byte)) {
    return { mime: 'image/webp', ext: 'webp' }
  }
  return null
}

/**
 * Whether the body is small enough to read at all, judged from `Content-Length` before any of it is
 * pulled in. A request without the header passes here and meets the per-field limits instead.
 * @param {Headers} headers @returns {Rejected | null}
 */
export function checkBodySize(headers) {
  const length = Number(headers.get('content-length') ?? '')
  if (Number.isFinite(length) && length > MAX_BODY) {
    return reject(413, 'too_large', `A report may be at most ${MAX_BODY} bytes in total.`)
  }
  return null
}

/**
 * The request with its body metered, and a flag that goes true the moment it runs past `max`.
 * `Content-Length` is a courtesy a client need not extend — a chunked body carries none — so the
 * cap is also counted off the stream, and reading the form fails rather than buffering the rest.
 * @param {Request} request @param {number} [max]
 * @returns {{ request: Request, overrun: { exceeded: boolean } }}
 */
export function meterBody(request, max = MAX_BODY) {
  const overrun = { exceeded: false }
  if (!request.body) return { request, overrun }
  let seen = 0
  const meter = new TransformStream({
    transform(chunk, controller) {
      seen += chunk.byteLength
      if (seen > max) {
        overrun.exceeded = true
        controller.error(new Error('the report body ran past its limit'))
        return
      }
      controller.enqueue(chunk)
    },
  })
  const metered = new Request(request, { body: request.body.pipeThrough(meter), duplex: 'half' })
  return { request: metered, overrun }
}

/** Whether the request carries a multipart form. @param {Headers} headers @returns {Rejected | null} */
export function checkMediaType(headers) {
  const type = (headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (type !== 'multipart/form-data') {
    return reject(415, 'unsupported_media_type', 'A report must be sent as multipart/form-data.')
  }
  return null
}

/** @param {FormData} form @param {string} name @returns {string} */
const field = (form, name) => {
  const value = form.get(name)
  return typeof value === 'string' ? cleanText(value).trim() : ''
}

/** @param {FormData} form @param {string} name @returns {File | null} */
const file = (form, name) => {
  const value = form.get(name)
  return value && typeof value === 'object' && 'arrayBuffer' in value ? /** @type {File} */ (value) : null
}

/** The size of a string in UTF-8 bytes. @param {string} text @returns {number} */
export const byteLength = text => new TextEncoder().encode(text).length

/**
 * A report from the submitted form, or the error to answer with.
 * @param {FormData} form
 * @param {{ siteOrigins?: string[] }} [options] the sites a share link may point at; a run that
 *   reads a report the endpoint already judged leaves them out and the link is not checked again
 * @returns {Promise<Accepted | Rejected>}
 */
export async function parseReport(form, { siteOrigins } = {}) {
  const symptom = field(form, 'symptom')
  if (!symptom) return reject(400, 'invalid_request', 'Say what went wrong in the symptom field.')
  if (symptom.length > MAX_SYMPTOM) return reject(400, 'invalid_request', `The symptom may be at most ${MAX_SYMPTOM} characters.`)

  const sequence = field(form, 'sequence')
  if (sequence.length > MAX_SEQUENCE) return reject(400, 'invalid_request', `The sequence may be at most ${MAX_SEQUENCE} code units.`)

  const link = field(form, 'link')
  if (link && siteOrigins && !siteOrigins.some(origin => link.startsWith(`${origin}/`))) {
    return reject(400, 'invalid_request', `A share link must point at ${siteOrigins.join(' or ')}.`)
  }

  const contact = field(form, 'contact')
  if (contact.length > MAX_CONTACT) return reject(400, 'invalid_request', `The contact may be at most ${MAX_CONTACT} characters.`)

  const documentText = field(form, 'document')
  if (byteLength(documentText) > MAX_DOCUMENT) return reject(413, 'too_large', `The document may be at most ${MAX_DOCUMENT} bytes.`)
  if (documentText && !parses(documentText)) return reject(400, 'invalid_request', 'The document field must be JSON.')

  const contextText = field(form, 'context')
  if (byteLength(contextText) > MAX_CONTEXT) return reject(413, 'too_large', `The context may be at most ${MAX_CONTEXT} bytes.`)
  const context = contextText ? asObject(contextText) : {}
  if (!context) return reject(400, 'invalid_request', 'The context field must be a JSON object.')

  const imageFile = file(form, 'image')
  /** @type {Attachment | null} */
  let image = null
  if (imageFile && imageFile.size > 0) {
    if (imageFile.size > MAX_IMAGE) return reject(413, 'too_large', `An image may be at most ${MAX_IMAGE} bytes.`)
    const bytes = new Uint8Array(await imageFile.arrayBuffer())
    const sniffed = sniffImage(bytes)
    if (!sniffed) return reject(415, 'unsupported_media_type', 'An image must be a PNG, a JPEG or a WebP.')
    image = { bytes, ...sniffed }
  }

  const documentUpload = file(form, 'documentFile')
  /** @type {Attachment | null} */
  let documentAttachment = null
  if (documentUpload && documentUpload.size > 0) {
    if (documentUpload.size > MAX_DOCUMENT) return reject(413, 'too_large', `The document file may be at most ${MAX_DOCUMENT} bytes.`)
    const text = await documentUpload.text()
    if (!parses(text)) return reject(400, 'invalid_request', 'The document file must be JSON.')
    documentAttachment = { bytes: new TextEncoder().encode(text), mime: 'application/json', ext: 'json' }
  }

  return {
    ok: true,
    report: {
      symptom,
      sequence,
      link,
      document: documentText,
      context,
      contact,
      turnstile: field(form, 'turnstile'),
      image,
      documentFile: documentAttachment,
    },
  }
}

/** @param {string} text @returns {boolean} */
function parses(text) {
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

/** @param {string} text @returns {Record<string, unknown> | null} */
function asObject(text) {
  try {
    const value = JSON.parse(text)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch {
    return null
  }
}
