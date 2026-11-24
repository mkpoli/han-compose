export type Node = {
    id: string;
    kind: string;
    char?: string;
    child?: Node;
    op?: string;
    children?: Node[];
    note?: string;
    marks?: string;
};
export type Document = {
    root: Node;
} & Record<string, unknown>;
export type LayerSource = {
    geometry: (node: Node) => any;
    placement: (parent: Node, child: Node) => number[] | null;
};
export type DrawingPart = {
    d: string;
    cut?: boolean;
    leaf?: number;
};
export type Drawing = {
    d: string;
    parts?: DrawingPart[];
    slots?: {
        index: number;
        box: number[];
    }[];
};
export type SketchLeaf = {
    index: number;
    box: number[];
    empty: boolean;
};
export type Box = [number, number, number, number];
export type LayerInfo = {
    node: Node;
    leaf: number | null;
    region: Box | null;
};
export type DocumentSource = {
    source: LayerSource;
    complete: boolean;
    issues: string[];
    info: Map<string, LayerInfo>;
    partsByLeaf: Map<number, DrawingPart[]>;
};
export type Scopes = any;
export type Frames = Map<string, any>;
export type Renderer = {
    renderScopes: Function;
    layerFrames: Function;
};
export type LocalPiece = {
    d: string;
    fillRule: 'nonzero' | 'evenodd';
    cut?: boolean;
};
export type StrokeGroup = {
    id: string;
    pieces: number[];
};
/**
 * The source a document renderer needs from a separated composer drawing. `sketch` is
 * the leaf layout the composer sent for the same sequence. Every drawn part must carry its leaf
 * index; otherwise the source is incomplete and those components have no geometry. Identity layer
 * transforms reconstruct the composer's canvas drawing exactly; nested transforms then act in each
 * layer's box-derived 1000-unit frame.
 * @param {Document} document @param {Drawing} drawing @param {SketchLeaf[] | null | undefined} sketch
 * @returns {DocumentSource}
 */
export declare function documentSource(document: Document, drawing: Drawing, sketch: SketchLeaf[] | null | undefined): DocumentSource;
/**
 * Draw `document` with a separated composer preview and return its complete source. The preview
 * must have been made with `separate: true`; `onSketch` is forwarded, and the drawing is returned
 * alongside the source.
 * @param {Document} document @param {(sequence: string, options?: { signal?: AbortSignal, onSketch?: (leaves: SketchLeaf[]) => void }) => Promise<Drawing>} preview
 * @param {{ signal?: AbortSignal, onSketch?: (leaves: SketchLeaf[]) => void }} [options]
 * @returns {Promise<DocumentSource & { drawing: Drawing }>}
 */
export declare function composeDocumentSource(document: Document, preview: (sequence: string, options?: {
    signal?: AbortSignal;
    onSketch?: (leaves: SketchLeaf[]) => void;
}) => Promise<Drawing>, { signal, onSketch }?: {
    signal?: AbortSignal;
    onSketch?: (leaves: SketchLeaf[]) => void;
}): Promise<DocumentSource & {
    drawing: Drawing;
}>;
