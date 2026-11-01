// @ts-check
// The engine's front door: draw a sequence from an export in a Worker, and what a drawing answers.
// Everything else is reachable from its own entry point (see `package.json`).
import { APPROXIMATE, EMPTY } from './compose.js'
import { createDrawer } from './client.js'
import { LIMITS, LookupError, PYRAMID_LAYERS, compose, createSource, fromUrl, size, sketch, svgBox, tooLarge } from './loader.js'
import { parseTree } from './compose.js'
import { parseDescription, splitDescription } from './tree.js'

export { APPROXIMATE, EMPTY }
export { LIMITS, LookupError, PYRAMID_LAYERS, compose, createSource, createDrawer, fromUrl, size, sketch, svgBox, tooLarge }
export { unicodeSource, hasUnicodeGlyph } from './unicode.js'
export { componentDrawing } from './component-forms.js'
export { documentSource, composeDocumentSource } from './document-source.js'
export { documentView } from './document-view.js'
export { placeholder, STROKE } from './slot-placeholder.js'
export { pyramidRows } from './pyramid-rows.js'
export { parseDescription, splitDescription, writeDescription, isNode, isEmpty } from './tree.js'

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
 * @property {{ leaf: number, origin: string, box: number[] }[]} [parts] Each drawn part: the leaf it stands under, where it came from, its box.
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
 * A `preview` for an IDS editor: `draw(sequence, options)` answers the drawing, empty slots (⬚)
 * included, or rejects with a `TooLargeError` (larger than `LIMITS`), an `UnavailableError` (the export
 * could not be read), an `AbortError` (its signal aborted), or a `LookupError` saying what could not be
 * drawn. Drawing runs in a Worker made by `worker`, one sequence at a time; a newer request ends the one
 * before. A sequence drawn once is answered from memory; `warm()` starts the Worker on the export
 * before the first drawing. `loaders` says how to read files a page cannot fetch.
 *
 * The sequence reaches the composer as text, empty slots as ⬚.
 *
 * @param {{ base: string, separate?: boolean, fontStyle?: 'sans' | 'serif' | 'kaisho',
 *   worker?: () => WorkerLike, loaders?: import('./loader.js').Loaders, timeout?: number }} options
 * @returns {((sequence: string, options?: PreviewOptions) => Promise<Drawing>) & { warm: () => void }}
 */
export function composerPreview({ base, separate = false, fontStyle = 'sans', loaders = {}, timeout, worker = () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }) }) {
  const drawer = createDrawer(worker, base, { loaders, timeout })
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
  const preview = /** @type {ReturnType<typeof composerPreview>} */ (async (sequence, { signal, onSketch } = {}) => {
    // What follows one description (an input method's marked text) is not drawn.
    const text = splitDescription(sequence).base || sequence
    if (tooLarge(parseLoose(text))) throw new TooLargeError(`${text} is larger than ${LIMITS.nodes} operators or ${LIMITS.depth} levels.`)
    signal?.throwIfAborted()
    const cached = drawings.get(text)
    if (cached) {
      drawings.delete(text)
      drawings.set(text, cached)
      if (cached.sketch) onSketch?.(cached.sketch)
      return cached.drawn
    }
    /** @type {SketchLeaf[] | null} */
    let leaves = null
    const answer = await drawer.draw(text, heard => { leaves = heard; if (!signal?.aborted) onSketch?.(heard) }, { separate, fontStyle })
    if (answer.status === 'composed') { remember(text, answer.drawn, answer.sketch ?? leaves); return answer.drawn }
    if (answer.status === 'cancelled') throw new DOMException('The drawing was replaced.', 'AbortError')
    throw answer.unavailable ? new UnavailableError(answer.error) : new LookupError(answer.error)
  })
  let warmed = false
  preview.warm = () => {
    if (warmed) return
    warmed = true
    try { drawer.warm() } catch { /* the first drawing reports the base */ }
  }
  return preview
}

/** The tree a draft reads as, for the size check; null where it is no description. @param {string} text */
function parseLoose(text) {
  try { return parseTree(text, op => '⿰⿱⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽㇯'.includes(op) ? 2 : '⿲⿳'.includes(op) ? 3 : '⿾⿿〾'.includes(op) ? 1 : 0) } catch { return null }
}
