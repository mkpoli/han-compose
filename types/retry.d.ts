/**
 * `fetch`, asked again after it rejects (browsers reject a network failure with a TypeError, Bun
 * with a plain Error) or answers 408, 429 or 5xx, up to `waits.length` more times. The last answer
 * or error is the caller's; an aborted or timed-out request is never asked again.
 * @param {(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>} [get]
 * @param {number[]} [waits]
 * @returns {(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>}
 */
export declare function retrying(get?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>, waits?: number[]): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
/** `fetch` with the default retries. */
export declare const download: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
