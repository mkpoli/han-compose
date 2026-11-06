// @ts-check
// One derived view of a document for the preview, handles and export: the composer-backed source,
// the scoped drawing, the layer frames and the issues that keep the view incomplete.
import { documentSource } from './document-source.js'

// The view is what a document renderer (ids-input's `src/document/render.js` and `frames.js`) makes
// of the source above: the scoped drawing, the layer frames, and the issues that keep it incomplete.
/** @typedef {import('./document-source.js').Document} Document */
/** @typedef {import('./document-source.js').LayerSource} LayerSource */
/** @typedef {import('./document-source.js').Drawing} Drawing */
/** @typedef {import('./document-source.js').SketchLeaf} SketchLeaf */
/** @typedef {import('./document-source.js').Box} Box */
/** @typedef {import('./document-source.js').LayerInfo} LayerInfo */
/** @typedef {import('./document-source.js').DocumentSource} DocumentSource */
// The middleware a view is made with is ids-input's own renderer, `src/document/render.js` for the
// scoped drawing and `src/document/frames.js` for the frames; its types belong to that package.
/**
 * @typedef {object} DocumentView
 * @property {DocumentSource} source The composer-backed source, complete or not.
 * @property {Map<number, import('./document-source.js').DrawingPart[]>} partsByLeaf The drawn parts of each component leaf.
 * @property {import('./document-source.js').Scopes | null} scopes The scoped drawing, or null when the source is incomplete.
 * @property {import('./document-source.js').Frames} frames Layout frames for every layer the sketch covers.
 * @property {string[]} issues Source and transform problems in one list.
 * @property {boolean} complete Whether the source and every transform produced a drawing.
 * @property {Drawing} drawing The separated drawing the view was made from.
 * @property {SketchLeaf[] | null} sketch The layout the composer sent with the drawing.
 */

/**
 * Build one document view from a separated composer drawing, its matching sketch, and the renderer
 * that draws a document from a source. Frames are available even when the source is incomplete, so
 * an inspector can still select a known layer.
 * @param {Document} document @param {Drawing} drawing @param {SketchLeaf[] | null | undefined} sketch
 * @param {{ tolerance?: number, renderer: import('./document-source.js').Renderer }} options
 * @returns {DocumentView}
 */
export function documentView(document, drawing, sketch, { tolerance = 0.1, renderer }) {
  const { layerFrames, renderScopes } = renderer
  const made = documentSource(document, drawing, sketch)
  const frames = layerFrames(document, made.source, sketch ?? [])
  if (!made.complete) return { source: made, scopes: null, frames, issues: made.issues, complete: false, drawing, sketch: sketch ?? null, partsByLeaf: made.partsByLeaf }
  const scopes = renderScopes(document, made.source, { tolerance })
  // Emoji and the cut path arrive in the drawing's own coordinates, which the layer frames leave
  // alone: `canvas` is the layer's own transform seen from the canvas, the identity until it moves.
  for (const [id, at] of made.info) {
    const frame = frames.get(id)
    if (typeof at.leaf === 'number' && frame?.supported) scopes.leafFrames.set(at.leaf, frame.canvas)
  }
  /** @type {{ message: string }[]} */
  const reported = /** @type {{ issues?: { message: string }[] }} */ (scopes).issues ?? []
  return {
    source: made,
    scopes,
    frames,
    issues: [...made.issues, ...reported.map(issue => issue.message)],
    complete: scopes.complete,
    drawing,
    sketch: sketch ?? null,
    partsByLeaf: made.partsByLeaf,
  }
}
