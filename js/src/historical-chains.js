import catalogue from './historical-chains.json' with { type: 'json' }

/** @type {Readonly<Record<string, string>>} */
const aliases = catalogue.aliases

/** A historical spelling's verified modern equivalent, or the original spelling.
 * @param {string} text */
export function canonicalHistoricalChain(text) {
  return Object.hasOwn(aliases, text) ? aliases[text] : text
}

/** @typedef {{ strokes: string[], joins: number[][][], crossings: number[][],
 * evidence: { revision: string, file: string, host: string, description: string } }} HistoricalGraph */
/** @type {Readonly<Record<string, HistoricalGraph>>} */
const graphs = catalogue.graphs

/** The attested topology of a chain without a verified modern equivalent.
 * Endpoint 0 is the beginning of a stroke and 1 is its end.
 * @param {string} text */
export function historicalChainGraph(text) {
  return Object.hasOwn(graphs, text) ? graphs[text] : null
}

/** @type {Readonly<Record<string, { key: string, chain: string, revision: string, file: string, host: string }>>} */
const references = catalogue.references

/** A named variant that replaced this historical spelling in the source.
 * The key retains the original Bai-style glyph-variant marker.
 * @param {string} text */
export function historicalChainReference(text) {
  return Object.hasOwn(references, text) ? references[text] : null
}

/** @type {Readonly<Record<string, { char: string }>>} */
const identities = catalogue.nativeIdentities

/** The unique, unqualified historical level-0 host of a standalone chain.
 * Use the font's own outline only where its glyph agrees with the source form.
 * @param {string} text */
export function historicalNativeChar(text) {
  return Object.hasOwn(identities, text) ? identities[text].char : null
}
