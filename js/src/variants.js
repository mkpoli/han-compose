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

// Unicode IVD 2026-08-03, U+8279. Adobe-Japan1 CIDs 14197, 14198 and 14199
// correspond respectively to MJ021481, MJ030293 and MJ030292. FE00 and FE01
// are the standardized variants for compatibility ideographs FA5D and FA5E.
export const grassIVS = Object.freeze({ connected: '艹\u{E0100}', split: '艹\u{E0102}', inward: '艹\u{E0101}' })
const grassShapes = new Map([
  ...['艹', '⺾', grassIVS.connected, '艹\u{E0105}'].map(s => [s, '艹']),
  ...['⺿', '艹', '艹\uFE01', grassIVS.split, '艹\u{E0104}'].map(s => [s, '⺿']),
  ...['⻀', '艹', '艹\uFE00', grassIVS.inward, '艹\u{E0103}'].map(s => [s, '⻀']),
].map(([text, shape]) => /** @type {[string,string]} */ ([text, shape])))

/** Contextual drawing key for a single grass radical token. @param {string} text */
export const grassShape = text => grassShapes.get(text)

/** Attested spellings of the grass radical, grouped by the contextual shape used by the
 * composer. The literal drawings are feature values. Look up each exact sequence in the
 * IVD catalogue for its collection-specific glyph identifiers. */
export const grassFamily = {
  id: 'grass/8279',
  subjects: [...grassShapes.keys()],
  reference: '艹',
  axes: [
    { id: 'crossbar', property: 'continuity', locus: [{ path: [] }], values: ['joined', 'divided'] },
    { id: 'shape', property: 'outline', locus: [{ path: [] }], values: ['艹', '⺿', '⻀'] },
  ],
  forms: [...grassShapes].filter(([text]) => text.startsWith('艹') && [...text].length === 2 &&
    /** @type {number} */ (text.codePointAt(1)) >= 0xe0100).map(([text, shape]) => ({
    id: /** @type {number} */ (text.codePointAt(1)).toString(16).toUpperCase(),
    text, traits: { crossbar: shape === '艹' ? 'joined' : 'divided', shape },
  })),
  source: { name: 'Unicode IVD', edition: '2026-08-03',
    url: 'https://www.unicode.org/ivd/data/2026-08-03/IVD_Sequences.txt' },
}
