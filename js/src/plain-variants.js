// @ts-check
// Variation sequences a face's font registers with its base character's own glyph. Noto CJK JP
// draws 丑 U+E0100 as 丑 itself, and an export records only the sequences a font draws with a glyph
// of their own, so the export holds no record for it. `plain-variants.json` lists them per face,
// selector by selector (`scripts/build_plain_variants.py`).
import registered from './plain-variants.json' with { type: 'json' }

/** @type {Map<string, Set<string>>} */
const faces = new Map()

/** The plain sequences of a face, built on first use. @param {string} style */
function plainIn(style) {
  let set = faces.get(style)
  if (!set) {
    const bySelector = /** @type {Record<string, Record<string, string>>} */ (registered)[style] ?? {}
    set = new Set(Object.entries(bySelector).flatMap(([selector, bases]) =>
      [...bases].map(base => base + String.fromCodePoint(parseInt(selector, 16)))))
    faces.set(style, set)
  }
  return set
}

/** Whether a face lists any plain sequences. @param {string} style */
export const hasPlainVariants = style => Object.hasOwn(registered, style)

/** The base character `key` draws as in `style`, or null where the face registers no plain glyph
 *  for it. @param {string} key @param {string} style */
export function plainBase(key, style) {
  const points = [...key]
  return points.length === 2 && plainIn(style).has(key) ? points[0] : null
}

/** Whether a sequence holds a variation selector. @param {string} sequence */
export const hasVariationSelector = sequence => /[︀-️]|\uDB40[\uDD00-\uDDEF]/.test(sequence)

/**
 * `fallback` with each plain sequence of `style` that it holds no record for answered by its base
 * character's record. A sequence with a record of its own keeps it.
 * @param {{ fallback: any, style: string }} options
 */
export function plainVariantSource({ fallback, style }) {
  /** @param {string} key */
  const plain = key => plainBase(key, style)
  return {
    get manifest() { return fallback.manifest },
    get layout() { return fallback.layout },
    ready: () => fallback.ready(),
    modelFiles: (/** @type {any} */ options) => fallback.modelFiles(options),
    load: (/** @type {string[]} */ names) => fallback.load(names),
    filesOf: (/** @type {string[]} */ keys) => fallback.filesOf([...keys, ...keys.map(plain).filter(base => base !== null)]),
    store() {
      const remote = fallback.store()
      /** @param {string} key */
      const keyOf = key => {
        const base = plain(key)
        return base !== null && remote.rec(key) == null ? base : key
      }
      return {
        manifest: remote.manifest, missing: remote.missing,
        get layout() { return remote.layout },
        identity: (/** @type {string} */ key) => remote.identity?.(keyOf(key)),
        rec: (/** @type {string} */ key) => remote.rec(keyOf(key)),
        hosts: (/** @type {string} */ key, /** @type {any} */ place) => remote.hosts(keyOf(key), place),
        places: (/** @type {string} */ key) => remote.places(keyOf(key)),
        kin: () => remote.kin?.() ?? null,
      }
    },
  }
}
