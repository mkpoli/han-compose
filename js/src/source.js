// @ts-nocheck
// The source a sequence draws from: bundled outlines for the parts that have them, the host's export
// for the rest, and the overlay sources for the scripts and palette parts the export leaves out.
// The page's worker and the card renderer behind a share link both choose a source here, so a
// drawing on a shared card is the drawing the editor shows.
import { bundledSource } from './bundled.js'
import { fromUrl, unpack } from './loader.js'
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
 * The source `sequence` draws from over the export at `base`. `loaders` gives the URL each bundled
 * file is served at, by its path under the package's `data/` (`sources/tangut/outlines.json.gz`),
 * for a page that serves them elsewhere; left out, the page fetches them beside the package.
 * `bundled` draws without the export, as a page does when the export could not be read; `remote`
 * keeps the export even for a sequence bundled outlines would cover, as warming does. `fetch`
 * replaces how the export is read, and `read` how a bundled file is: a page that reads its own assets
 * (a Worker over its deployment's files) answers by path, wherever `loaders` puts them.
 * @param {string} sequence
 * @param {{ base?: string, fontStyle?: string, separate?: boolean, bundled?: boolean, remote?: boolean, loaders?: Record<string, string>, traits?: ReturnType<typeof traitsOf>, fetch?: typeof globalThis.fetch, read?: (path: string, url?: string) => Promise<Response> }} [options]
 */
export function sourceFor(sequence, { base, fontStyle = 'sans', separate = false, bundled = false, remote = false, loaders = {}, traits = null, fetch: get, read } = {}) {
  traits = traits ?? traitsOf(sequence ?? '')
  const local = !remote && (bundled || traits.empty || onlyBundled(sequence, separate, false, fontStyle))
  /** The source of one script or palette, over `fallback`, reading its file by path or URL. A kind
   *  that reads one file asks for it by no name and gets `path`; the Unicode fallback asks for the
   *  shard it needs, so the name a kind passes is the file that is read. A host that lists none of
   *  the files leaves the package's own copy to answer. */
  const overlay = (/** @type {Function} */ kind, /** @type {any} */ fallback, /** @type {string} */ path) => {
    const load = bundledLoader(path, !local, loaders, read)
    return kind({ fallback, ...(load ? { load } : {}) })
  }
  // A bundled sequence needs no export: a failing one is not asked for at all. The export's own
  // Unicode fallback reads its shards where the host says they are.
  const shards = bundledLoader(UNICODE, true, loaders, read)
  let source = local ? null : fromUrl(base, { ...(get ? { fetch: get } : {}), ...(shards ? { load: shards } : {}) })
  // Bundled alone, a leaf may be one only the Unicode outlines hold; they load only what is asked for.
  if (local && (traits.loose || bundled)) source = overlay(unicodeSource, source, UNICODE)
  if (traits.tangut) source = overlay(tangutSource, source, 'sources/tangut/outlines.json.gz')
  if (traits.bopomofo) source = overlay(bopomofoSource, source, 'sources/bopomofo/outlines.json.gz')
  if (traits.seal) source = overlay(smallSealSource, source, 'sources/small-seal/outlines.json.gz')
  if (traits.newKorean) source = overlay(newKoreanSource, source, 'sources/new-korean/outlines.json.gz')
  if (traits.shuishu) source = overlay(shuishuSource, source, 'sources/shuishu/outlines.json.gz')
  if (traits.palette) source = overlay(paletteSource, source, 'sources/palette/outlines.json.gz')
  return source ?? bundledSource({ load: async () => ({ records: {} }), matches: () => false })
}

/** The path a Unicode overlay reads stands for each of its shards. */
const UNICODE = 'unicode/outlines/'

/** A bundled file's parsed JSON, from the bytes a response holds. @param {Response} response @param {string} name */
async function parsed(response, name) {
  if (!response.ok) throw new Error(`${name}: ${response.status}`)
  return JSON.parse(await unpack(await response.arrayBuffer()))
}

/**
 * How one kind reads its file, or null where the host lists none of its files and the package's own
 * copy answers. A kind reading one file asks by no name; the Unicode fallback asks for a shard by
 * name (`unicode/000`), which is `unicode/outlines/000.json.gz` under `data/`. A file is optional
 * over an export, which draws what it holds; alone, a failure rejects so the next drawing asks again.
 * @param {string} path @param {boolean} optional @param {Record<string, string>} loaders
 * @param {((path: string, url?: string) => any) | undefined} read
 */
function bundledLoader(path, optional, loaders, read) {
  const unicode = path === UNICODE
  const listed = unicode ? Object.keys(loaders).some(name => name.startsWith(UNICODE)) : path in loaders
  if (!read && !listed) return null
  /** @param {string} [name] */
  const fileOf = name => unicode && name ? `${UNICODE}${name.slice('unicode/'.length)}.json.gz` : path
  return async (/** @type {string} [name] */ name) => {
    const file = fileOf(name)
    try {
      const answer = read ? await read(file, loaders[file])
        : loaders[file] ? await fetch(loaders[file]) : null
      if (answer === null) return {}
      return answer instanceof Response ? await parsed(answer, file) : answer
    } catch (error) {
      if (optional) return {}
      throw error
    }
  }
}
