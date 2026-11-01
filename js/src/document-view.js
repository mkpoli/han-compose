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
/** @typedef {{ issues: { message: string }[], complete: boolean }} ScopeTree */
/** The renderer a view is made with (ids-input's `src/document/render.js` and `frames.js`), which
 *  makes a scoped drawing and a frame for each layer; a frame's own fields are the renderer's. */
/** @typedef {(document: Document, source: LayerSource, options?: { tolerance?: number }) => ScopeTree} RenderScopes
 *  @typedef {(document: Document, source: LayerSource, sketch: SketchLeaf[]) => Map<string, LayerInfo & { box: number[] }>} LayerFrames
 *  @typedef {{ renderScopes: RenderScopes, layerFrames: LayerFrames }} Renderer */

/**
 * @typedef {object} DocumentView
 * @property {DocumentSource} source The composer-backed source, complete or not.
 * @property {ScopeTree | null} scopes The scoped drawing, or null when the source is incomplete.
 * @property {ReturnType<LayerFrames>} frames Layout frames for every layer the sketch covers, as the renderer frames them.
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
 * @param {{ tolerance?: number, renderer: Renderer }} options
 * @returns {DocumentView}
 */
export function documentView(document, drawing, sketch, { tolerance = 0.1, renderer }) {
  const { layerFrames, renderScopes } = renderer
  const made = documentSource(document, drawing, sketch)
  const frames = layerFrames(document, made.source, sketch ?? [])
  if (!made.complete) return { source: made, scopes: null, frames, issues: made.issues, complete: false, drawing, sketch: sketch ?? null }
  const scopes = renderScopes(document, made.source, { tolerance })
  return {
    source: made,
    scopes,
    frames,
    issues: [...made.issues, ...scopes.issues.map(issue => issue.message)],
    complete: scopes.complete,
    drawing,
    sketch: sketch ?? null,
  }
}
