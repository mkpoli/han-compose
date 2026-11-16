// @ts-check
// Rate limiting and duplicate detection on KV. Counters live in fixed windows keyed by the clock, so
// each one expires on its own and nothing has to be swept. KV is eventually consistent: a burst
// arriving in the same second at several edges can slip past a limit, which is tolerable for abuse
// control and would not be for anything that has to be exact.

export const PER_HOUR = 5
export const PER_DAY = 20
export const TOTAL_PER_DAY = 300
export const DEDUPE_DAYS = 14

const HOUR = 3600
const DAY = 86400
/**
 * The day's total is split over several keys. One key would take a write per report, and KV accepts
 * only one write a second to a key; spread over ten, ordinary traffic stays well inside that.
 */
const TOTAL_SHARDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

/** @typedef {{ REPORTS: KVNamespace }} RateEnv */
/** @typedef {{ number: number, url: string }} KnownIssue */

/** @param {number} now milliseconds @returns {string} */
const hourWindow = now => String(Math.floor(now / 1000 / HOUR))
/** @param {number} now milliseconds @returns {string} */
const dayWindow = now => new Date(now).toISOString().slice(0, 10)

/**
 * Whether this address may file another report, and the counters bumped when it may. The three
 * windows are five an hour and twenty a day for one address, and three hundred a day for everyone.
 * @param {RateEnv} env @param {string} ip @param {number} [now]
 * @returns {Promise<{ ok: true } | { ok: false, scope: 'ip-hour' | 'ip-day' | 'total-day' }>}
 */
export async function checkRate(env, ip, now = Date.now()) {
  const day = dayWindow(now)
  /** @type {{ scope: 'ip-hour' | 'ip-day' | 'total-day', keys: string[], limit: number, ttl: number }[]} */
  const windows = [
    { scope: 'ip-hour', keys: [`rate:ip:${ip}:h:${hourWindow(now)}`], limit: PER_HOUR, ttl: HOUR },
    { scope: 'ip-day', keys: [`rate:ip:${ip}:d:${day}`], limit: PER_DAY, ttl: DAY },
    { scope: 'total-day', keys: TOTAL_SHARDS.map(shard => `rate:all:d:${day}:${shard}`), limit: TOTAL_PER_DAY, ttl: DAY },
  ]
  const counts = await Promise.all(windows.map(async window => {
    const values = await Promise.all(window.keys.map(key => env.REPORTS.get(key)))
    return values.reduce((total, value) => total + (Number(value) || 0), 0)
  }))
  for (const [index, window] of windows.entries()) {
    if (counts[index] >= window.limit) return { ok: false, scope: window.scope }
  }
  // One of the shards takes the increment. Counting is best effort: KV allows one write a second to
  // a key, and a report is worth more than a counter, so a rejected write is logged and let go.
  await Promise.all(windows.map(async (window, index) => {
    const key = window.keys.length === 1 ? window.keys[0] : window.keys[Math.floor(Math.random() * window.keys.length)]
    const shard = window.keys.length === 1 ? counts[index] : Number(await env.REPORTS.get(key)) || 0
    try {
      await env.REPORTS.put(key, String(shard + 1), { expirationTtl: window.ttl })
    } catch (error) {
      console.error(`counting ${window.scope} failed`, error)
    }
  }))
  return { ok: true }
}

/**
 * The dedupe key for a report: the sequence and the symptom with whitespace runs collapsed and
 * folded to lower case, hashed with SHA-256.
 * @param {string} sequence @param {string} symptom @returns {Promise<string>}
 */
export async function dedupeKey(sequence, symptom) {
  const fold = text => text.replace(/\s+/g, ' ').trim().toLowerCase()
  // The two fields are hashed as a pair, so moving a word across the boundary is a different report.
  const normal = JSON.stringify([fold(sequence), fold(symptom)])
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normal))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

/** The issue an identical report already opened, when one did. @param {RateEnv} env @param {string} key */
export async function findDuplicate(env, key) {
  const stored = await env.REPORTS.get(`report:${key}`, 'json')
  if (!stored || typeof stored !== 'object') return null
  const issue = /** @type {Partial<KnownIssue>} */ (stored)
  return typeof issue.number === 'number' && typeof issue.url === 'string' ? /** @type {KnownIssue} */ (issue) : null
}

/** Remember which issue a report opened, for a fortnight. @param {RateEnv} env @param {string} key @param {KnownIssue} issue */
export async function rememberIssue(env, key, issue) {
  await env.REPORTS.put(`report:${key}`, JSON.stringify(issue), { expirationTtl: DEDUPE_DAYS * DAY })
}
