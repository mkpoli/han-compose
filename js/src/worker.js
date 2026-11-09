// @ts-nocheck
// The engine in a Web Worker, so drawing a sequence never holds up the page. It receives
// `{ id, sequence, base, separate, fontStyle }` and answers first `{ id, sketch }` (where the layout
// puts each part, `sketch` in `loader.js`) and then `{ id, drawn }`, or `{ id, error }`, with
// `unavailable` when the export's manifest or layout could not be read at all. A `{ id, warm, base }`
// message loads the manifest and layout and answers `{ id, warm }`, so the first drawing starts with
// them. `loaders` says how to read files a page cannot fetch (`bundledFetch` in `index.js`). The page
// ends a worker whose answer it no longer needs (`client.js`).
import { EMPTY, leafTexts, parseTree } from './compose.js'
import { compose, sketch } from './loader.js'
import { onlyBundled } from './local.js'
import { sourceFor, traitKey, traitsOf } from './source.js'

const sources = new Map()
self.onmessage = async ({ data: { id, sequence, base, separate, fontStyle, warm, preferExport, loaders } }) => {
  const traits = !warm ? traitsOf(sequence) : null
  // Whether the sequence draws from bundled outlines is part of the key: `onlyBundled` reads the
  // sequence, which the traits alone do not cover.
  const local = !warm && !preferExport && (traits.empty || onlyBundled(sequence, separate, false, fontStyle))
  // Where the bundled files are read from is part of the key: a later `loaders` must reach its source.
  const key = `${JSON.stringify(loaders ?? {})}:${base}:${warm ? 'warm' : `${local ? 'local' : 'remote'}:${traitKey(traits)}`}:${separate}:${fontStyle}:${preferExport ? 'export' : 'any'}`
  if (!sources.has(key)) sources.set(key, sourceFor(sequence, { base, fontStyle, separate, traits, loaders, remote: warm || preferExport }))
  let source = sources.get(key)
  try {
    await source.ready()
  } catch (error) {
    // The export could not be read: the bundled outlines alone still draw what they cover.
    if (!warm && onlyBundled(sequence, false, true, fontStyle)) {
      source = sourceFor(sequence, { base, fontStyle, separate, traits, loaders, bundled: true })
      await source.ready()
    } else {
      self.postMessage(warm ? { id, warm: true, error: String(error?.message ?? error) } : { id, error: String(error?.message ?? error), unavailable: true })
      return
    }
  }
  if (warm) { self.postMessage({ id, warm: true }); return }
  try {
    self.postMessage({ id, sketch: await sketch(source, sequence, { fontStyle, loaders }) })
    const drawn = await compose(source, sequence, { separate, fontStyle, loaders })
    // The leaves in reading order and the leaf of each slot, so a view can place parts beside the
    // drawing without a tree of its own.
    let leaves = null
    try { leaves = leafTexts(parseTree(sequence, arityOf(source))) } catch { /* drawn as text alone */ }
    self.postMessage({ id, drawn: { ...drawn, ...(leaves ? { leaves, slots: slotsByLeaf(leaves, drawn.slots) } : {}) } })
  } catch (error) { self.postMessage({ id, error: String(error?.message ?? error) }) }
}

/** How many operands the export's own operators take. */
function arityOf(source) {
  const { BINARY, TERNARY, UNARY } = source.manifest.constants
  return ch => BINARY.includes(ch) ? 2 : TERNARY.includes(ch) ? 3 : UNARY.includes(ch) ? 1 : 0
}

/** A drawing's slots with the leaf each belongs to: the empty slots of `leaves`, in reading order. */
function slotsByLeaf(leaves, slots = []) {
  const empty = leaves.map((text, leaf) => text === EMPTY ? leaf : -1).filter(leaf => leaf >= 0)
  return slots.map((slot, i) => ({ ...slot, ...(empty[i] === undefined ? {} : { leaf: empty[i] }) }))
}
