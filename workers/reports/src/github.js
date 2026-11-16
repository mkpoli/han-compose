// @ts-check
// The GitHub REST calls a report needs: the labels it files under, the dispatch to the Action, the
// issue itself, a comment on a repeat, and the attachments. Attachments go through the Git Data API onto an orphan branch —
// blob, tree, commit, ref — because the issue-attachment upload has no API.

export const ATTACHMENT_BRANCH = 'bug-attachments'
const API = 'https://api.github.com'
const CALL_TIMEOUT = 15_000

/** @typedef {{ REPO: string, GITHUB_TOKEN: string }} GitHubEnv */
/** @typedef {{ path: string, bytes: Uint8Array }} UploadFile */

/** A GitHub call that did not succeed. */
export class GitHubError extends Error {
  /** @param {number} status @param {string} message */
  constructor(status, message) {
    super(message)
    this.name = 'GitHubError'
    this.status = status
  }
}

/** @param {GitHubEnv} env @returns {Record<string, string>} */
const headers = env => ({
  accept: 'application/vnd.github+json',
  'x-github-api-version': '2022-11-28',
  authorization: `Bearer ${env.GITHUB_TOKEN}`,
  'user-agent': 'ids-reports',
  'content-type': 'application/json',
})

/**
 * One call against the API. It returns the parsed body, or throws `GitHubError` carrying the status.
 * @param {GitHubEnv} env @param {string} path @param {{ method?: string, body?: unknown }} [init]
 * @returns {Promise<any>}
 */
export async function call(env, path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    method: init.method ?? 'GET',
    headers: headers(env),
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    // A call that hangs must not hold the reporter past the wait.
    signal: AbortSignal.timeout(CALL_TIMEOUT),
  })
  const text = await response.text()
  if (!response.ok) throw new GitHubError(response.status, `${init.method ?? 'GET'} ${path} answered ${response.status}: ${text.slice(0, 500)}`)
  return text ? JSON.parse(text) : null
}

/** Bytes as base64, for a blob's `content`. @param {Uint8Array} bytes @returns {string} */
export function toBase64(bytes) {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}

/**
 * Make sure every label exists before an issue asks for it. A label the repository already has
 * answers 422, which is the expected case and not an error.
 * @param {GitHubEnv} env @param {string[]} labels @returns {Promise<void>}
 */
export async function ensureLabels(env, labels) {
  for (const name of labels) {
    try {
      await call(env, `/repos/${env.REPO}/labels`, { method: 'POST', body: { name } })
    } catch (error) {
      if (!(error instanceof GitHubError) || error.status !== 422) throw error
    }
  }
}

/**
 * @param {GitHubEnv} env @param {{ title: string, body: string, labels: string[] }} issue
 * @returns {Promise<{ number: number, url: string }>}
 */
export async function createIssue(env, issue) {
  const created = await call(env, `/repos/${env.REPO}/issues`, { method: 'POST', body: issue })
  return { number: created.number, url: created.html_url }
}

/** @param {GitHubEnv} env @param {number} number @param {string} body @returns {Promise<void>} */
export async function rewriteIssue(env, number, body) {
  await call(env, `/repos/${env.REPO}/issues/${number}`, { method: 'PATCH', body: { body } })
}

/**
 * The newest issue under `label`, touched since `since`, whose body ends in `ending`; null when
 * there is none. Only the end counts: a reporter's own text sits inside the body and may quote
 * anything.
 * @param {GitHubEnv} env @param {{ label: string, since: Date, ending: string }} wanted
 * @returns {Promise<{ number: number, url: string } | null>}
 */
export async function findIssue(env, { label, since, ending }) {
  const query = new URLSearchParams({ labels: label, state: 'all', sort: 'created', direction: 'desc', since: since.toISOString(), per_page: '50' })
  /** @type {{ number: number, html_url: string, body?: string | null, pull_request?: unknown }[]} */
  const issues = await call(env, `/repos/${env.REPO}/issues?${query}`)
  const found = issues.find(issue => !issue.pull_request && typeof issue.body === 'string' && issue.body.trimEnd().endsWith(ending))
  return found ? { number: found.number, url: found.html_url } : null
}

/**
 * Ask the workshop's Action to file a report, which rides in the payload.
 * @param {GitHubEnv} env @param {{ event_type: string, client_payload: Record<string, unknown> }} event
 * @returns {Promise<void>}
 */
export async function dispatch(env, event) {
  await call(env, `/repos/${env.REPO}/dispatches`, { method: 'POST', body: event })
}

/** @param {GitHubEnv} env @param {number} number @param {string} body @returns {Promise<void>} */
export async function commentOnIssue(env, number, body) {
  await call(env, `/repos/${env.REPO}/issues/${number}/comments`, { method: 'POST', body: { body } })
}

/**
 * The branch's head commit and the tree under it, or null when the branch does not exist yet.
 * @param {GitHubEnv} env @returns {Promise<{ commit: string, tree: string } | null>}
 */
async function readBranch(env) {
  let ref
  try {
    ref = await call(env, `/repos/${env.REPO}/git/ref/heads/${ATTACHMENT_BRANCH}`)
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return null
    throw error
  }
  const commit = await call(env, `/repos/${env.REPO}/git/commits/${ref.object.sha}`)
  return { commit: ref.object.sha, tree: commit.tree.sha }
}

/** @param {GitHubEnv} env @param {UploadFile[]} files @param {string} message @returns {Promise<void>} */
async function commitFiles(env, files, message) {
  const branch = await readBranch(env)
  const blobs = await Promise.all(
    files.map(file => call(env, `/repos/${env.REPO}/git/blobs`, { method: 'POST', body: { content: toBase64(file.bytes), encoding: 'base64' } })),
  )
  // With no branch yet the tree stands alone; `base_tree` is left out rather than pointed at the
  // canonical empty tree, which the API would have to already hold as an object.
  const tree = await call(env, `/repos/${env.REPO}/git/trees`, {
    method: 'POST',
    body: {
      ...(branch ? { base_tree: branch.tree } : {}),
      tree: files.map((file, index) => ({ path: file.path, mode: '100644', type: 'blob', sha: blobs[index].sha })),
    },
  })
  const commit = await call(env, `/repos/${env.REPO}/git/commits`, {
    method: 'POST',
    body: { message, tree: tree.sha, parents: branch ? [branch.commit] : [] },
  })
  if (branch) await call(env, `/repos/${env.REPO}/git/refs/heads/${ATTACHMENT_BRANCH}`, { method: 'PATCH', body: { sha: commit.sha } })
  else await call(env, `/repos/${env.REPO}/git/refs`, { method: 'POST', body: { ref: `refs/heads/${ATTACHMENT_BRANCH}`, sha: commit.sha } })
}

/**
 * Commit the files to the attachment branch. A 422 means another report moved the ref between the
 * read and the write, so the whole sequence runs once more against the new head.
 * @param {GitHubEnv} env @param {UploadFile[]} files @param {string} message @returns {Promise<void>}
 */
export async function uploadAttachments(env, files, message) {
  if (!files.length) return
  try {
    await commitFiles(env, files, message)
  } catch (error) {
    if (!(error instanceof GitHubError) || error.status !== 422) throw error
    await commitFiles(env, files, message)
  }
}

/** The URL a committed attachment is served from. @param {GitHubEnv} env @param {string} path */
export const rawUrl = (env, path) => `https://github.com/${env.REPO}/raw/${ATTACHMENT_BRANCH}/${path}`
