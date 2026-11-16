// The report as a run reads it from the `repository_dispatch` the endpoint sent: the fields the
// dialog submitted, the key the issue is marked with, and whether the reporter sent a drawing. The
// endpoint has already judged the report, and only the repository's own token can dispatch.

import { readFile } from 'node:fs/promises'

import { parseReport } from '../src/validate.js'

/**
 * @param {Record<string, unknown>} payload the dispatch's `client_payload`
 * @param {string} repo the repository the run files in
 * @returns {Promise<{ key: string, drawing: boolean, image: string | null, imageFailed: boolean, report: import('../src/validate.js').Report }>}
 */
export async function reportOf(payload, repo) {
  const fields = payload?.report
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new Error('The dispatch carried no report.')
  const key = typeof payload.key === 'string' ? payload.key : ''
  if (!/^[0-9a-f]{64}$/.test(key)) throw new Error('The dispatch carried no key.')
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) if (typeof value === 'string') form.set(name, value)
  const parsed = await parseReport(form)
  if (!parsed.ok) throw new Error(`The dispatched report does not read: ${parsed.message}`)
  // The address of a drawing the endpoint stored, which only its own repository's branch can hold.
  const image = typeof payload.image === 'string' && payload.image.startsWith(`https://github.com/${repo}/raw/bug-attachments/`) ? payload.image : null
  return { key, drawing: payload.drawing === true, image, imageFailed: payload.imageFailed === true, report: parsed.report }
}

/**
 * What GitHub hands a run: the dispatch's payload, and the repository with the run's own token,
 * which files as `github-actions[bot]`.
 * @returns {Promise<{ payload: Record<string, unknown>, env: import('../src/github.js').GitHubEnv }>}
 */
export async function runGiven() {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH ?? '', 'utf8'))
  return {
    payload: event.client_payload ?? {},
    env: { REPO: process.env.GITHUB_REPOSITORY ?? '', GITHUB_TOKEN: process.env.GITHUB_TOKEN ?? '' },
  }
}
