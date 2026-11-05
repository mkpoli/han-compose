// @ts-check
// The engine's front door: draw a sequence from an export in a Worker, and what a drawing answers.
// Everything else is reachable from its own entry point (see `package.json`).
import { APPROXIMATE, EMPTY } from './compose.js'
import { createDrawer } from './client.js'
import { emojiSlots } from './emoji.js'
import { groupParts } from './group-parts.js'
import { onlyBundled } from './local.js'
import { LIMITS, LookupError, PYRAMID_LAYERS, compose, createSource, fromUrl, size, sketch, svgBox, tooLarge } from './loader.js'
import { parseTree } from './compose.js'
import { parseDescription, splitDescription } from './tree.js'
import outlines from '../data/unicode/outlines.json' with { type: 'json' }

export { APPROXIMATE, EMPTY }
export { LIMITS, LookupError, PYRAMID_LAYERS, compose, createSource, createDrawer, fromUrl, size, sketch, svgBox, tooLarge }
export { unicodeSource, hasUnicodeGlyph, UNICODE_COVERAGE } from './unicode.js'
export { unpack } from './loader.js'
export { componentDrawing, componentParts } from './component-forms.js'
export { documentSource, composeDocumentSource } from './document-source.js'
export { documentView } from './document-view.js'
export { placeholder, STROKE } from './slot-placeholder.js'
export { drawingSvg, EMOJI_CUT_MATRIX, emojiTransform } from './drawing-svg.js'
export { groupParts } from './group-parts.js'
export { pyramidRows } from './pyramid-rows.js'
export { parseDescription, splitDescription, writeDescription, isNode, isEmpty, isComponent, isLetter, isMark, isMarks } from './tree.js'
export { pyramidSequence, pyramidCount } from './pyramid-sequence.js'
export { emojiPrefix, emojiSlots } from './emoji.js'
export { tokens } from './tokens.js'
export { characterScript, treeScript } from './scripts.js'
export { partScript } from './part-script.js'

/**
 * The ink of a sequence in a 1000-unit box, y down, as a drawing fills it.
 * @typedef {object} Drawing
 * @property {string} d The SVG path of the ink, nonzero fill.
 * @property {string} [cut] The path of what ㇯ takes away, masked out of `d`.
 * @property {{ index: number, box: number[], leaf?: number }[]} [slots] Each empty slot, in reading order, in the box the layout gives it.
 * @property {string[]} [leaves] The leaves of the sequence in reading order, an empty slot as ⬚.
 * @property {number[] | null} [stroke] The stroke widths the drawing is weighted to, across x and y.
 * @property {string[]} [approximate] Operators drawn by rooms and turns of this port's own choosing.
 * @property {boolean} [kanjivg] Whether a part was cut along KanjiVG's groups, so the drawing is shared alike (CC BY-SA 3.0).
 * @property {{ leaf: number, origin: string, box: number[], d: string, cut?: boolean }[]} [parts] Each drawn part: the leaf it stands under, where it came from, its box and its path.
 * @property {{ text: string, box: number[], leaf: number, part: number, flip?: [boolean, boolean], cut?: boolean, restored?: boolean }[]} [emoji] Each Emoji part, drawn as text in its box; `part` is its piece in `parts` when the parts could be told apart.
 */

/**
 * Where the layout puts each leaf before the drawing is done.
 * @typedef {object} SketchLeaf
 * @property {number} index The leaf's place in reading order.
 * @property {number[]} box [x, y, width, height] in the drawing's box, y down.
 * @property {boolean} empty Whether the leaf is an empty slot.
 */

/**
 * @typedef {object} PreviewOptions
 * @property {AbortSignal} [signal]
 * @property {(leaves: SketchLeaf[]) => void} [onSketch]
 */

/** A sequence larger than the composer draws (`LIMITS`). */
export class TooLargeError extends Error { name = 'TooLargeError' }
/** The export could not be read at all: unreachable, refused by CORS, not there, or `base` is no URL. */
export class UnavailableError extends Error { name = 'UnavailableError' }

/** @typedef {import('./client.js').WorkerLike} WorkerLike */

/**
 * A `preview` for an IDS editor: `draw(sequence, options)` answers the drawing, empty slots (⬚) and
 * Emoji included, or rejects with a `TooLargeError` (larger than `LIMITS`), an `UnavailableError`
 * (the export could not be read), an `AbortError` (its signal aborted), or a `LookupError` saying what
 * could not be drawn. Drawing runs in a Worker made by `worker`, one sequence at a time; a newer
 * request ends the one before, and the files it loaded stay in the browser's cache. A sequence drawn
 * once is answered from memory; `warm()` starts the Worker on the export before the first drawing.
 * `loaders` gives the URL each bundled file is served at, where a page serves the package's `data/`
 * somewhere of its own.
 *
 * The sequence reaches the composer as text, empty slots as ⬚. An Emoji part (👩‍💻) has no outlines:
 * it takes a slot of the draft, draws as text in the box the layout gave it, and comes back in the
 * drawing's `emoji`, with `restored` and `cut` saying what ㇯ does to it.
 *
 * @param {{ base: string, separate?: boolean, fontStyle?: 'sans' | 'serif' | 'kaisho',
 *   worker?: () => WorkerLike, loaders?: Record<string, string>, timeout?: number }} options
 * @returns {((sequence: string, options?: PreviewOptions) => Promise<Drawing>) & { warm: () => void }}
 */
export function composerPreview({ base, separate = false, fontStyle = 'sans', loaders = {}, timeout, worker = () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }) }) {
  // A base that is no URL is reported when a drawing needs the export; nothing makes a worker for it.
  const known = (() => { try { new URL(base, globalThis.location?.href); return true } catch { return false } })()
  const drawer = known ? createDrawer(worker, base, { loaders, timeout }) : null
  /** @type {Map<string, { drawn: Drawing, sketch: SketchLeaf[] | null }>} */
  const drawings = new Map()
  const CACHE = 32
  /**
   * @param {string} sequence @param {Drawing} drawn @param {SketchLeaf[] | null} sketch
   */
  function remember(sequence, drawn, sketch) {
    drawings.delete(sequence)
    drawings.set(sequence, { drawn, sketch })
    if (drawings.size > CACHE) {
      const oldest = drawings.keys().next().value
      if (oldest !== undefined) drawings.delete(oldest)
    }
  }
  /**
   * A drawing as the caller asked for it: its Emoji drawn back where the slots were, each a piece of
   * its own so a view can select it, and the slots that remain the ones the caller wrote.
   * @param {Drawing} drawn @param {import('./emoji.js').EmojiPart[]} emoji @param {SketchLeaf[] | null} sketch
   */
  function withEmoji(drawn, emoji, sketch) {
    if (!emoji.length) return { drawn, sketch }
    const slots = drawn.slots ?? []
    const leaves = sketch?.map(leaf => emoji.some(item => item.leaf === leaf.index) ? { ...leaf, empty: false } : leaf) ?? null
    /** Emoji are drawn as text in their slot's box. */
    const items = emoji.flatMap(item => {
      const slot = slots[item.slot]
      if (!slot) return []
      return [{ text: item.text, box: slot.box, leaf: item.leaf, part: -1, ...(item.flip ? { flip: item.flip } : {}),
        ...(item.cut ? { cut: true } : item.restored ? { restored: true } : {}) }]
    })
    const pieces = drawn.parts ?? []
    const oldLeaves = sketch?.map(leaf => ({ ...leaf, empty: emoji.some(item => item.leaf === leaf.index) || leaf.empty })) ?? null
    const groups = pieces.length ? groupParts(pieces, oldLeaves ?? []) : null
    if (!groups && items.some((_, index) => emoji[index]?.overlay)) throw new Error('Cannot determine emoji stacking order for this overlay.')
    /** @type {NonNullable<Drawing['parts']>} */
    const parts = pieces.map(piece => ({ ...piece }))
    for (const group of groups ?? []) for (const index of group.parts) parts[index] = { ...parts[index], leaf: group.index }
    // An Emoji has a part even in a drawing with no other: a document reads its geometry from them.
    for (const item of items) { item.part = parts.length; parts.push({ leaf: item.leaf, origin: 'emoji', box: item.box, d: '' }) }
    return { drawn: { ...drawn, parts, emoji: items,
      slots: slots.filter(slot => !emoji.some(item => item.slot === slot.index)).map((slot, index) => ({ ...slot, index })) }, sketch: leaves }
  }
  /** @type {ReturnType<typeof composerPreview>} */
  const preview = async (sequence, options = {}) => {
    const { signal, onSketch } = options;
    // What follows one description (an input method's marked text) is not drawn.
    const text = splitDescription(sequence).base || sequence
    const prepared = emojiSlots(text)
    if (tooLarge(parseLoose(text))) throw new TooLargeError(`${text} is larger than ${LIMITS.nodes} operators or ${LIMITS.depth} levels.`)
    signal?.throwIfAborted()
    const cached = drawings.get(text)
    if (cached) {
      drawings.delete(text)
      drawings.set(text, cached)
      if (cached.sketch) onSketch?.(cached.sketch)
      return cached.drawn
    }
    // Bundled outlines alone draw what they cover; anything else needs an export to read.
    if (!drawer && !onlyBundled(prepared.sequence, separate, true, fontStyle)) throw new UnavailableError(`${base} is not a URL.`)
    /** @type {SketchLeaf[] | null} */
    let shown = null
    /** @param {SketchLeaf[]} leaves */
    const heard = leaves => {
      shown = withEmoji({ d: '' }, prepared.emoji, leaves).sketch ?? leaves
      if (!signal?.aborted) onSketch?.(shown)
    }
    // The drawing itself, or an empty one where no export is needed.
    /** @type {Promise<import('./client.js').Answer>} */
    const request = drawer ? drawer.draw(prepared.sequence, heard, { separate, fontStyle })
      : Promise.resolve(/** @type {import('./client.js').Answer} */ ({ status: 'composed', drawn: { d: '' }, sketch: shown }))
    // The drawing in progress, ended when its signal aborts; the drawer answers it as cancelled.
    /** @type {import('./client.js').Answer} */
    const answer = await new Promise(settle => {
      let ended = false
      const stop = () => { if (!ended) { ended = true; drawer?.cancel(); settle({ status: 'cancelled' }) } }
      if (signal?.aborted) { stop(); return }
      signal?.addEventListener('abort', stop, { once: true })
      request.then(result => { if (!ended) { ended = true; signal?.removeEventListener('abort', stop); settle(result) } })
    })
    if (answer.status === 'composed') {
      const made = withEmoji(answer.drawn, prepared.emoji, answer.sketch ?? shown)
      remember(text, made.drawn, made.sketch)
      return made.drawn
    }
    if (answer.status === 'cancelled') throw new DOMException('The drawing was replaced.', 'AbortError')
    throw answer.unavailable ? new UnavailableError(answer.error) : new LookupError(answer.error)
  }
  let warmed = false
  preview.warm = () => {
    if (warmed) return
    warmed = true
    // Nothing is warmed for a base that is no URL: the first drawing reports it.
    try { drawer?.warm() } catch { /* the first drawing reports the base */ }
  }
  return preview
}

/** The tree a draft reads as, for the size check; null where it is no description. @param {string} text */
function parseLoose(text) {
  try { return parseTree(text, /** @param {string} op */ op => '⿰⿱⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽㇯'.includes(op) ? 2 : '⿲⿳'.includes(op) ? 3 : '⿾⿿〾'.includes(op) ? 1 : 0) } catch { return null }
}

/** A path under the package's `data/`, and the URL of the file: absolute, so a host that serves the
 *  package's own files, or a bundler that moves them, answers at the URL the page asks for. */
/** @param {string} path */
const dataUrl = path => new URL(`../data/${path}`, import.meta.url).href
/** The Unicode shards the package carries, by their path under `data/`: the ones its own
 *  `data/unicode/outlines.json` records, so a build is handed no URL that answers nothing. */
const unicodeShards = Object.keys(outlines.shards).map(name => `unicode/outlines/${name}.json.gz`)
export const dataUrls = {
  'sources/tangut/outlines.json.gz': dataUrl('sources/tangut/outlines.json.gz'),
  'sources/bopomofo/outlines.json.gz': dataUrl('sources/bopomofo/outlines.json.gz'),
  'sources/new-korean/outlines.json.gz': dataUrl('sources/new-korean/outlines.json.gz'),
  'sources/small-seal/outlines.json.gz': dataUrl('sources/small-seal/outlines.json.gz'),
  'sources/shuishu/outlines.json.gz': dataUrl('sources/shuishu/outlines.json.gz'),
  'sources/palette/outlines.json.gz': dataUrl('sources/palette/outlines.json.gz'),
  // The shards the package ships, read from its own `data/`: a name it has no file for would be a
  // URL that answers nothing. `unicode.json` holds the ones `export-web` wrote.
  ...Object.fromEntries(unicodeShards.map(name => [name, dataUrl(name)])),
}
