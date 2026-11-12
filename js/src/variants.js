// @ts-check
// The variation sequences an export draws: `variants.json`, each character with the selectors its
// font draws as a glyph of its own. An export of a font with none has no such file.
import { download } from './retry.js'

/** @type {Map<string, Promise<Map<string, string[]>>>} */
const lists = new Map()

/**
 * Every character of the export at `base` with the variation sequences it draws, the plain character
 * left out: 者 → [者 U+8005 U+E0101]. Read once a page; an export without the file answers an empty map.
 * @param {string} base The folder holding the export.
 * @param {{ fetch?: (url: string) => Promise<Response> }} [options]
 * @returns {Promise<Map<string, string[]>>}
 */
export function variationSequences(base, { fetch: get = download } = {}) {
  const root = base.endsWith('/') ? base : `${base}/`
  let list = lists.get(root)
  if (!list) {
    list = (async () => {
      const response = await get(`${root}variants.json`)
      if (response.status === 404) return new Map()
      if (!response.ok) throw new Error(`variants.json: ${response.status}`)
      const index = /** @type {Record<string, string>} */ (await response.json())
      return new Map(Object.entries(index).map(([char, selectors]) => [char, [...selectors].map(selector => char + selector)]))
    })()
    // A failed read is asked for again by the next caller.
    list.catch(() => { if (lists.get(root) === list) lists.delete(root) })
    lists.set(root, list)
  }
  return list
}
