// @ts-nocheck
// The source a sequence draws from: bundled outlines for the parts that have them, the host's export
// for the rest, and the overlay sources for the scripts and palette parts the export leaves out.
// The page's worker and the card renderer behind a share link both choose a source here, so a
// drawing on a shared card is the drawing the editor shows.
import { bundledSource } from './bundled.js'
import { fromUrl } from './loader.js'
import { onlyBundled } from './local.js'
import { unicodeSource } from './unicode.js'
import { hasTangut, tangutSource } from './tangut.js'
import { hasBopomofo, bopomofoSource } from './bopomofo.js'
import { hasSmallSeal, smallSealSource } from './small-seal.js'
import { hasNewKorean, newKoreanSource } from './new-korean.js'
import { hasShuishu, shuishuSource } from './shuishu.js'
import { hasPaletteGlyph, paletteSource } from './palette.js'
import { isEmpty, isNode, parseDescription as parse, splitDescription } from './tree.js'

/**
 * What in a sequence calls for bundled outlines instead of the export: a tree of empty slots draws
 * from the layout alone, a loose mark from the bundled Unicode outlines, and each script or palette
 * character from its own overlay.
 * @param {string} sequence
 */
/** Whether a tree holds nothing but empty slots. @param {import('./tree.js').Part} tree */
const onlySlots = tree => {
  const walk = node => isEmpty(node) || isNode(node) && node.parts.every(walk)
  return tree !== null && walk(tree)
}
export function traitsOf(sequence) {
  let tree = null
  try { tree = parse(sequence) } catch { /* not a description: no traits */ }
  const empty = onlySlots(tree)
  return {
    empty,
    loose: splitDescription(sequence).marks !== '',
    tangut: hasTangut(sequence),
    bopomofo: hasBopomofo(sequence),
    seal: hasSmallSeal(sequence),
    newKorean: hasNewKorean(sequence),
    shuishu: hasShuishu(sequence),
    palette: [...sequence].some(hasPaletteGlyph),
  }
}

/** A cache key for the traits a source depends on. @param {ReturnType<typeof traitsOf>} traits */
export const traitKey = traits => Object.entries(traits).map(([name, on]) => `${name}:${on ? 1 : 0}`).join(',')

/**
 * The source `sequence` draws from over the export at `base`. `loaders` replaces how a bundled
 * file is read (`{ tangut: { load }, … }`), for a page that serves the package's `data/` elsewhere
 * or a runtime with no page: `{ load: path => Promise<parsed JSON> }`. `bundled` draws without the
 * export, as a page does when the export could not be read; `remote` keeps the export even for a
 * sequence bundled outlines would cover, as warming does. `fetch` replaces how the export is read.
 * @param {string} sequence
 * @param {{ base?: string, fontStyle?: string, separate?: boolean, bundled?: boolean, remote?: boolean, loaders?: Record<string, { load?: () => Promise<any> }>, traits?: ReturnType<typeof traitsOf> }} [options]
 */
export function sourceFor(sequence, { base, fontStyle = 'sans', separate = false, bundled = false, remote = false, loaders = {}, traits = null, fetch: get } = {}) {
  traits = traits ?? traitsOf(sequence ?? '')
  const local = !remote && (bundled || traits.empty || onlyBundled(sequence, separate, false, fontStyle))
  // A bundled sequence needs no export: a failing one is not asked for at all.
  let source = local ? null : fromUrl(base, get ? { fetch: get } : {})
  if (local && traits.loose) source = unicodeSource({ fallback: source, ...loaders.unicode })
  if (traits.tangut) source = tangutSource({ fallback: source, ...loaders.tangut })
  if (traits.bopomofo) source = bopomofoSource({ fallback: source, ...loaders.bopomofo })
  if (traits.seal) source = smallSealSource({ fallback: source, ...loaders.seal })
  if (traits.newKorean) source = newKoreanSource({ fallback: source, ...loaders.newKorean })
  if (traits.shuishu) source = shuishuSource({ fallback: source, ...loaders.shuishu })
  if (traits.palette) source = paletteSource({ fallback: source, ...loaders.palette })
  return source ?? bundledSource({ load: async () => ({ records: {} }), matches: () => false })
}
