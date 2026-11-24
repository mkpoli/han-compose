// @ts-check
// Downloads asked for again when the connection drops or the server is briefly unable to answer.
// On a lossy route one reset in many is ordinary, and a single failed file would otherwise leave a
// search or a drawing unable to start until the page is reloaded.

/** How long to wait before each further attempt, in milliseconds. */
const WAITS = [500, 1500, 4000]

/** Statuses a later attempt may answer differently. @param {number} status */
const passing = status => status === 408 || status === 429 || status >= 500

/** The longest a `Retry-After` is waited for, in milliseconds. */
const LONGEST_WAIT = 10_000

/** What a response's `Retry-After` asks for, in milliseconds, or 0: delay-seconds or an HTTP date.
 *  @param {Response} response */
function retryAfter(response) {
  const value = response.headers?.get('retry-after')?.trim()
  if (!value) return 0
  if (/^\d+$/.test(value)) return Number(value) * 1000
  const date = Date.parse(value)
  return Number.isNaN(date) ? 0 : Math.max(0, date - Date.now())
}

/** Resolves after `ms`, or rejects with the signal's reason once it aborts.
 *  @param {number} ms @param {AbortSignal | null | undefined} signal */
const pause = (ms, signal) => new Promise((resolve, reject) => {
  signal?.throwIfAborted()
  const done = () => { clearTimeout(timer); reject(signal?.reason) }
  const timer = setTimeout(() => { signal?.removeEventListener('abort', done); resolve(undefined) }, ms)
  signal?.addEventListener('abort', done, { once: true })
})

/** An error that ends the request on purpose: a caller's abort or timeout. @param {unknown} error */
const stopped = error => error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')

/**
 * `fetch`, asked again after it rejects (browsers reject a network failure with a TypeError, Bun
 * with a plain Error) or answers 408, 429 or 5xx, up to `waits.length` more times. The last answer
 * or error is the caller's; an aborted or timed-out request is never asked again.
 * @param {(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>} [get]
 * @param {number[]} [waits]
 * @returns {(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>}
 */
export function retrying(get = (input, init) => globalThis.fetch(input, init), waits = WAITS) {
  return async (input, init) => {
    // A `Request` carries its own signal when no options name one.
    const signal = init?.signal ?? (input instanceof Request ? input.signal : null)
    for (let attempt = 0; ; attempt++) {
      const last = attempt >= waits.length
      let wait = waits[attempt]
      try {
        const response = await get(input, init)
        if (last || !passing(response.status)) return response
        const after = retryAfter(response)
        // A server that asks for longer than a drawing can wait is answered as it stands.
        if (after > LONGEST_WAIT) return response
        wait = Math.max(wait, after)
        await response.body?.cancel()
      } catch (error) {
        if (last || signal?.aborted || stopped(error)) throw error
      }
      await pause(wait, signal)
    }
  }
}

/** `fetch` with the default retries. */
export const download = retrying()
