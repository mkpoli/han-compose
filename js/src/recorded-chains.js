import data from './recorded-chains.json' with { type: 'json' }

const IDS = 'https://github.com/yi-bai/ids'
const LEVELS = ['ids_lv0.txt', 'ids_lv1.txt', 'ids_lv2.txt']
const native = /** @type {Record<string, [string, number, string]>} */ (/** @type {unknown} */ (data.native))
const chains = /** @type {Record<string, [number | null, number | null, number[], string[]]>} */ (/** @type {unknown} */ (data.chains))

/**
 * A single native glyph attested for the exact undecorated spelling in Yi Bai's
 * primary level-0 IDS. A competing host or a variant-only description has no match.
 * Pass the preserved written spelling, or `keyOf(node)` from the parsed sequence.
 * @param {string} key
 */
export function recordedChainNative(key) {
  if (!Object.hasOwn(native, key)) return null
  const [char, line, rawDescription] = native[key]
  const level = LEVELS[0], commit = data.commit
  return { char, source: { level, line, commit, rawDescription, url: `${IDS}/blob/${commit}/${level}#L${line}` } }
}

/**
 * Source history for a raw chain spelling. Complete occurrences and contexts
 * are available in data/recorded-chains.json.gz.
 * @param {string} key
 */
export function recordedChainEvidence(key) {
  if (!Object.hasOwn(chains, key)) return null
  const [first, last, levels, codes] = chains[key]
  return {
    firstCommit: first === null ? null : data.revisions[first],
    lastCommit: last === null ? null : data.revisions[last],
    levels: levels.map(level => LEVELS[level]),
    guide: codes.length ? { ...data.guideFont, codePoints: codes } : null,
  }
}
