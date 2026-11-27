export declare const EM = 1000;
export declare const ASCENT = 880;
export declare const EM_BOX: number[];
/** Python's `round`: halves go to the even neighbour. */
export declare function pyRound(x: any): number;
/** Base64 to bytes, without `atob`, so it runs alike in browsers and in Bun. */
export declare function bytes(text: any): Uint8Array<ArrayBuffer>;
/** Pen commands as `[op, n, implied]`: M, L, or Q with its point count, implied when the contour
 *  closes on an implied point (`Q<n>*`). */
export declare function commands(text: any): any[][];
/** A contour's box over all its points, off-curve ones too, as the composer measures it. */
export declare function pointsBox(points: any): number[];
/** The way every part is drawn: clockwise in font units, y up (a negative signed area). The fonts
 *  the exports cut from mostly run that way, and the path fills with the nonzero rule, so parts
 *  wound alike add their ink where they overlap and one wound the other way subtracts it. */
export declare const WINDING = -1;
/**
 * A part from contours `{ ops, light, heavy, width }`: its box from the light points. `reverse`
 * marks contours that run against `WINDING`, as `wound` finds them.
 * @param {any[]} contours
 * @param {number[]} [box]
 * @param {boolean} [reverse]
 */
export declare function makePart(contours: any[], box?: number[], reverse?: boolean): {
    contours: any[];
    box: number[];
};
/** The winding of the contour enclosing the most ink: `pointLists` are flat [x, y, …] arrays. */
export declare function windingOf(pointLists: any): number;
/** `part` marked to be drawn backwards when its outermost contour runs against `WINDING`; mark it
 *  where the part is made. A cut or split piece keeps the mark through `derived`, so a glyph's
 *  counters stay opposite its own outline. */
export declare function wound(part: any): any;
/** A part made of `contours` taken from `from` (a cut, a split, a stroke group): drawn the way
 *  `from` is drawn. */
export declare function derived(from: any, contours: any, box: any): {
    contours: any[];
    box: number[];
};
export declare function cutContours(glyph: any, indices: any, box?: undefined): {
    contours: any[];
    box: number[];
};
export declare function contourSections(contours: any, ...sections: any[]): {
    ops: any[];
    light: Float64Array<ArrayBuffer>;
    heavy: Float64Array<ArrayBuffer>;
    width: any;
};
/** A part record of the export (`b`, `p`, `w`) read as a part, decoded once. */
export declare function partOf(record: any, quant?: number): any;
/** A contour as `['M' | 'L' | 'Q', points]` segments, TrueType's implied on-curve points made explicit
 *  (`compose._segments`); points are [x, y] pairs. */
export declare function segments(ops: any, points: any): (string | any[][])[][];
/** Contours flattened into closed polygons (`compose._rings`), each a flat [x, y, …] array. */
export declare function rings(contours: any, points: any, steps?: number): any[];
/**
 * A size × size mask of `box` (y up), row 0 at the top, filled by the nonzero rule at pixel centres
 * (`compose.fill`): a Uint8Array of 0 and 1.
 */
export declare function fill(polys: any, size: any, box: any): Uint8Array<ArrayBuffer>;
/** A mask grown by `by` pixels along rows and columns (`_grown_mask`). */
export declare function grown(mask: any, size: any, by: any): any;
export declare const count: (mask: any) => number;
/** A part's light ink stretched to fill a size × size square (`_square`). */
export declare const square: (part: any, size: any) => Uint8Array<ArrayBuffer>;
/** A part's outline length (`Composer.ink` of a part): the polygon through all its light points. */
export declare function partInk(part: any): any;
export declare const area: (b: any) => number;
export declare const union: (boxes: any) => number[];
/** `box`, drawn within `frame`, carried into `region` in proportion. */
export declare function mapped(box: any, frame: any, region: any): any[];
/** How much a part from `source` changes its proportions in `target`. */
export declare function stretchOf(source: any, target: any): number;
export declare const centre: (b: any) => number[];
/** `target` narrowed about its centre so a part from `source` changes its proportions by at most `stretch`. */
export declare function fitted(source: any, target: any, stretch: any): any[];
/** `box` scaled by `share` about its centre. */
export declare function shrunk(box: any, share: any): number[];
/** The share of `box` lying inside `room`. */
export declare function within(box: any, room: any): number;
/** A placed part: `part` drawn into `target` from `source`, moved `weight` of the way to the heavy
 *  master along x and y; `native` is the outline length of the glyph it was drawn in. `flips` mirror
 *  it in turn, each about its point along x, y or both (⿾ ⿿); `cut` marks a part taken away (㇯). */
export declare const placed: (part: any, source: any, target: any, native: any, origin: any, weight?: number[]) => {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
};
export declare const scaleOf: (p: any) => number[];
/** A placed part's target box as drawn, after its `flips`. */
export declare function drawnBox(p: any): any[];
/** The `target` a placed part needs to be drawn in `box`: `drawnBox` read backwards, so a caller
 *  that measures and moves parts as drawn also places a mirrored one where it means to. */
export declare function targetFor(p: any, box: any): any[];
/** A placed part's contours as drawn: flat [x, y, …] arrays in font units, y up. */
export declare function drawnContours(p: any): any;
/** The rings of a group of placed parts, for masks, wound as `svgPath` draws them. */
export declare const groupRings: (group: any, steps?: number) => any;
/** A size × size mask of the em, the parts filled and joined (`compose.raster`). */
export declare function raster(group: any, size?: number): Uint8Array<ArrayBuffer>;
/** Whether a placed part's contours, as drawn, run against `WINDING`: the part was marked at its
 *  source, and its flips turn them over once more. */
export declare const runsBack: (p: any) => boolean;
/** A contour's segments drawn the other way round: the same outline, wound as the glyph was drawn. */
export declare function backwards(segs: any): (string | any[])[][];
/** Placed parts as one SVG path in a 1000 × 1000 box, y down from the em's top (`compose.svg_path`);
 *  fill it with the nonzero rule. A part whose source runs the other way, or whose flip turns it
 *  over, is drawn backwards as a whole, so overlapping ink adds up and its counters stay holes. */
export declare function svgPath(group: any): string;
/** An SVG path of M, L, Q, C and Z commands (absolute, as `svgPath` writes it) read back as rings in
 *  font units, y up, its curves flattened in `steps`. */
export declare function pathRings(d: any, steps?: number): any[];
/** The mask of an SVG path over the em at `size` px. */
export declare const pathMask: (d: any, size?: number) => Uint8Array<ArrayBuffer>;
/** Overlap of two masks over their union; 1 when both are empty. */
export declare function iou(a: any, b: any): number;
