// @ts-check
// One derived view of a document for the preview, handles and export: the composer-backed source,
// the scoped drawing, the layer frames and the issues that keep the view incomplete.
import { layerFrames, renderScopes } from '../document/index.js'
import { documentSource } from './document-source.js'

/** @typedef {import('../document/index.js').Document} Document */
/** @typedef {import('../document/render.js').ScopeTree} ScopeTree */
/** @typedef {import('../document/render.js').LayerSource} LayerSource */
/** @typedef {import('../document/frames.js').LayerFrame} LayerFrame */
/** @typedef {import('../adapter/types.js').Drawing} Drawing */
/** @typedef {import('../adapter/types.js').SketchLeaf} SketchLeaf */
/** @typedef {import('./document-source.js').DocumentSource} DocumentSource */

/**
 * @typedef {object} DocumentView
 * @property {DocumentSource} source The composer-backed source, complete or not.
 * @property {ScopeTree | null} scopes The scoped drawing, or null when the source is incomplete.
 * @property {Map<string, LayerFrame>} frames Layout frames for every layer the sketch covers.
 * @property {string[]} issues Source and transform problems in one list.
 * @property {boolean} complete Whether the source and every transform produced a drawing.
 * @property {Drawing} drawing The separated drawing the view was made from.
 * @property {SketchLeaf[] | null} sketch The layout the composer sent with the drawing.
 */

/**
 * Build one document view from a separated composer drawing and its matching sketch. Frames are
 * available even when the source is incomplete, so the inspector can still select a known layer.
 * @param {Document} document @param {Drawing} drawing @param {SketchLeaf[] | null | undefined} sketch @param {{ tolerance?: number }} [options]
 * @returns {DocumentView}
 */
export function documentView(document, drawing, sketch, { tolerance = 0.1 } = {}) {
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
