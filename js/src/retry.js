// @ts-check
// Downloads asked for again when the connection drops or the server is briefly unable to answer.
// On a lossy route one reset in many is ordinary, and a single failed file would otherwise leave a
// search or a drawing unable to start until the page is reloaded.

/** How long to wait before each further attempt, in milliseconds. */
const WAITS = [500, 1500, 4000]

/** Statuses a later attempt may answer differently. @param {number} status */
const passing = status => status === 408 || status === 429 || status >= 500

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
    for (let attempt = 0; ; attempt++) {
      const last = attempt >= waits.length
      try {
        const response = await get(input, init)
        if (last || !passing(response.status)) return response
        await response.body?.cancel()
      } catch (error) {
        if (last || init?.signal?.aborted || stopped(error)) throw error
      }
      await pause(waits[attempt], init?.signal)
    }
  }
}

/** `fetch` with the default retries. */
export const download = retrying()
