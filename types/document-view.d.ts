export type Document = import('./document-source.js').Document;
export type LayerSource = import('./document-source.js').LayerSource;
export type Drawing = import('./document-source.js').Drawing;
export type SketchLeaf = import('./document-source.js').SketchLeaf;
export type Box = import('./document-source.js').Box;
export type LayerInfo = import('./document-source.js').LayerInfo;
export type DocumentSource = import('./document-source.js').DocumentSource;
export type DocumentView = {
    /**
     * The composer-backed source, complete or not.
     */
    source: DocumentSource;
    /**
     * The drawn parts of each component leaf.
     */
    partsByLeaf: Map<number, import('./document-source.js').DrawingPart[]>;
    /**
     * The scoped drawing, or null when the source is incomplete.
     */
    scopes: import('./document-source.js').Scopes | null;
    /**
     * Layout frames for every layer the sketch covers.
     */
    frames: import('./document-source.js').Frames;
    /**
     * Source and transform problems in one list.
     */
    issues: string[];
    /**
     * Whether the source and every transform produced a drawing.
     */
    complete: boolean;
    /**
     * The separated drawing the view was made from.
     */
    drawing: Drawing;
    /**
     * The layout the composer sent with the drawing.
     */
    sketch: SketchLeaf[] | null;
};
/** @typedef {import('./document-source.js').Document} Document */
/** @typedef {import('./document-source.js').LayerSource} LayerSource */
/** @typedef {import('./document-source.js').Drawing} Drawing */
/** @typedef {import('./document-source.js').SketchLeaf} SketchLeaf */
/** @typedef {import('./document-source.js').Box} Box */
/** @typedef {import('./document-source.js').LayerInfo} LayerInfo */
/** @typedef {import('./document-source.js').DocumentSource} DocumentSource */
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
export declare function documentView(document: Document, drawing: Drawing, sketch: SketchLeaf[] | null | undefined, { tolerance, renderer }: {
    tolerance?: number;
    renderer: import('./document-source.js').Renderer;
}): DocumentView;
