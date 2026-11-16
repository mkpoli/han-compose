// Files a dispatched report as an issue. The run's token opens it, so `github-actions[bot]` is the
// author and the body names the reporter. The dialog is waiting on this issue, so the step needs
// nothing installed; the drawing is added by `draw.js` afterwards.

import { appendFile } from 'node:fs/promises'

import { createIssue } from '../src/github.js'
import { filedBody, issueTitle, labelsFor } from '../src/issue.js'
import { reportOf, runGiven } from './dispatch.js'

/**
 * @param {Record<string, unknown>} payload the dispatch's `client_payload`
 * @param {import('../src/github.js').GitHubEnv} env
 * @returns {Promise<{ number: number, url: string }>}
 */
export async function fileReport(payload, env) {
  const { key, image, imageFailed, report } = await reportOf(payload, env.REPO)
  // The endpoint has made sure the labels exist; it finds this issue by its mark under `report`.
  return createIssue(env, {
    title: issueTitle(report),
    labels: labelsFor(report.context),
    body: filedBody(report, key, { image, document: null, failed: imageFailed }),
  })
}

if (import.meta.main) {
  const { payload, env } = await runGiven()
  const issue = await fileReport(payload, env)
  console.log(`filed ${issue.url}`)
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `number=${issue.number}\n`)
}
