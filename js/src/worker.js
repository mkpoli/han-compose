// @ts-nocheck
// The engine in a Web Worker, so drawing a sequence never holds up the page. It receives
// `{ id, sequence, base, separate, fontStyle }` and answers first `{ id, sketch }` (where the layout
// puts each part, `sketch` in `loader.js`) and then `{ id, drawn }`, or `{ id, error }`, with
// `unavailable` when the export's manifest, layout or identity table could not be read at all. A
// `{ id, warm, base }` message loads the three and answers `{ id, warm }`, so the first drawing starts
// with them. `loaders` says how to read files a page cannot fetch (`bundledFetch` in `index.js`). The page
// ends a worker whose answer it no longer needs (`client.js`).
import { EMPTY, leafTexts, parseTree } from './compose.js'
import { compose, sketch } from './loader.js'
import { onlyBundled } from './local.js'
import { exportSource, sourceFor, traitKey, traitsOf } from './source.js'

// A source for each kind of sequence, all over one source of the export they draw from: what a
// warming or an earlier drawing read of the export is there for the next, whatever its traits.
const sources = new Map(), exported = new Map()
// One completed drawing per pole lets a slider reuse the same five source outlines.
const lastFace = new Map()
self.onmessage = async ({ data }) => {
  const { id } = data
  const sendSketch = sketch => self.postMessage({ id, sketch })
  try {
    if (!data.faces) {
      const drawn = await drawFace(data, sendSketch)
      self.postMessage(data.warm ? { id, warm:true } : { id, drawn })
      return
    }
    const shares = data.faces.map(face => face.share)
    const sketches = new Map()
    function heard(index, leaves) {
      sketches.set(index, leaves)
      if (sketches.size !== shares.length || !sketches.get(0)) return
      sendSketch(sketches.get(0).map((leaf,i) => ({...leaf,
        box:leaf.box.map((_,k) => shares.reduce((v,share,j) =>
          v + share*(sketches.get(j)?.[i]?.box[k] ?? leaf.box[k]),0))})))
    }
    const results = await Promise.all(data.faces.map(async ({style, base}, index) => {
      const key = JSON.stringify([data.sequence,base,data.separate,data.loaders,data.preferExport])
      const cached = lastFace.get(style)
      if (cached?.key === key) {
        heard(index,cached.leaves)
        return cached
      }
      let leaves
      const drawing = await drawFace({...data, base, fontStyle:style}, sketch => {
        leaves = sketch
        heard(index,leaves)
      })
      const result = {key,drawing,leaves}
      lastFace.set(style,result)
      return result
    }))
    const weight = data.weight ?? 1
    let drawn = results[0].drawing
    if (results.length > 1 || weight !== 1) {
      const { mixDrawings } = await import('./mix-drawings.js')
      drawn = mixDrawings(results.map(r => r.drawing), shares, weight, results.map(r => r.leaves))
    }
    self.postMessage({ id, drawn })
  } catch (error) {
    self.postMessage({id, error:String(error?.message ?? error), ...(data.warm ? {warm:true} : error?.unavailable ? {unavailable:true} : {})})
  }
}

async function drawFace({ sequence, base, separate, fontStyle, warm, preferExport, loaders, faces }, sendSketch) {
  const traits = !warm ? traitsOf(sequence) : null
  // Whether the sequence draws from bundled outlines is part of the key: `onlyBundled` reads the
  // sequence, which the traits alone do not cover.
  const local = !warm && !preferExport && (traits.empty || onlyBundled(sequence, separate, false, fontStyle))
  // Where the bundled files are read from is part of the key: a later `loaders` must reach its source.
  const key = `${JSON.stringify(loaders ?? {})}:${base}:${warm ? 'warm' : `${local ? 'local' : 'remote'}:${traitKey(traits)}`}:${separate}:${fontStyle}:${preferExport ? 'export' : 'any'}`
  if (!sources.has(key)) {
    const at = `${JSON.stringify(loaders ?? {})}:${base}`
    if (!local && !exported.has(at)) exported.set(at, exportSource(base, { loaders }))
    sources.set(key, sourceFor(sequence, { base, fontStyle, separate, traits, loaders, remote: warm || preferExport, exported: exported.get(at) }))
  }
  let source = sources.get(key)
  try {
    await source.ready()
    if (warm) await source.load(source.modelFiles())
  } catch (error) {
    // The export could not be read: the bundled outlines alone still draw what they cover.
    if (!faces && !warm && onlyBundled(sequence, false, true, fontStyle)) {
      source = sourceFor(sequence, { base, fontStyle, separate, traits, loaders, bundled: true })
      await source.ready()
    } else {
      throw Object.assign(new Error(String(error?.message ?? error)), { unavailable:true })
    }
  }
  if (warm) return
  /** The sketch and then the drawing of the sequence, from one source. */
  const draw = async from => {
    sendSketch(await sketch(from, sequence, { fontStyle, loaders }))
    const drawn = await compose(from, sequence, { separate, fontStyle, loaders })
    // The leaves in reading order and the leaf of each slot, so a view can place parts beside the
    // drawing without a tree of its own.
    let leaves = null
    try { leaves = leafTexts(parseTree(sequence, arityOf(from))) } catch { /* drawn as text alone */ }
    return { ...drawn, ...(leaves ? { leaves, slots: slotsByLeaf(leaves, drawn.slots) } : {}) }
  }
  try { return await draw(source) } catch (error) {
    if (faces || !error?.unavailable || !onlyBundled(sequence, false, true, fontStyle)) throw error
    const bundled = sourceFor(sequence, { base, fontStyle, separate, traits, loaders, bundled: true })
    await bundled.ready()
    return draw(bundled)
  }
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
