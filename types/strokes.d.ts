/**
 * A placed part split at `strokeId`: the stroke as its own placed part and the rest.
 *
 * The two parts are in the drawing's coordinates, not the source glyph's, so the caller can
 * transform the stroke and recombine. A part without stroke groups, an unknown stroke, or a stroke
 * sharing a contour with another returns null. The returned parts carry no `strokes`: their
 * contour indices no longer describe the original glyph.
 *
 * @param {{ part: any, source: number[], target: number[], weight?: number[], native?: number, origin?: string, flips?: any[] }} item
 * @param {number} strokeId
 * @returns {{ stroke: any, rest: any } | null}
 */
export declare function splitStroke(item: {
    part: any;
    source: number[];
    target: number[];
    weight?: number[];
    native?: number;
    origin?: string;
    flips?: any[];
}, strokeId: number): {
    stroke: any;
    rest: any;
} | null;
