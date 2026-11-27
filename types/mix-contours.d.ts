/** Resample closed rings of several faces to a common point list. Corners that the
 * faces share become anchors, and each span between anchors is divided evenly along
 * every face. A straight edge therefore blends into a straight edge, and a corner one
 * face lacks (a serif tip) shrinks onto the edge that replaces it.
 * Returns null when no alignment keeps the halfway outline simple.
 * @param {number[][][]} rings one ring per face @returns {number[][][] | null} */
export declare function alignRings(rings: number[][][]): number[][][] | null;
/** Whether a frame and its counters no longer make one island: a ring crosses itself
 * or another, or a counter has left the frame.
 * @param {number[][][]} rings the frame first, without the repeated closing point */
export declare function tangled(rings: number[][][]): boolean;
/** Pair islands (or counters) by the distance between their bounding boxes.
 * Minimizes total squared distance so a uniform shift never swaps two neighbours.
 * @template T @param {T[][]} faces @param {(item:T)=>number[][]} ringOf */
export declare function matchRegions<T>(faces: T[][], ringOf: (item: T) => number[][]): T[][] | null;
/** Group islands across faces whose island counts differ. Islands whose boxes mostly
 * overlap within `reach` share a group, so a stroke that one face joins to its
 * neighbour takes only those islands out of contour matching. Every group holds at
 * least one island of every face.
 * @template T @param {T[][]} faces @param {(item:T)=>number[][]} ringOf @param {number} reach
 * @returns {T[][][]} */
export declare function groupRegions<T>(faces: T[][], ringOf: (item: T) => number[][], reach: number): T[][][];
/** Faces that draw as one island what another draws as several (a stroke that runs
 * into its neighbour in one face and stands clear in another) get the same islands: the
 * fused island is cut at the junction, so each stroke blends with its own counterpart.
 * Null when the faces split the ink in ways that are not one a coarser form of the other.
 * @param {number[][][][][]} polygons each face's islands
 * @param {'neck' | 'notch' | 'fit'} [prefer] where a fused island is cut: at its narrowest neck, at its notches, or where the pieces fit the finer face best
 * @param {boolean} [through] cut through the counters of a fused island that the finer islands lack
 * @returns {number[][][][][][] | null} per island, each face's one island */
export declare function splitIslands(polygons: number[][][][][], prefer?: 'neck' | 'notch' | 'fit', through?: boolean): number[][][][][][] | null;
/** Two faces can each run together strokes the other keeps apart, so that neither is a
 * coarser form of the other and an island of one lies over parts of several islands of
 * the other. Each such island is cut by the islands it lies over, in either face, until
 * every piece lies over one piece of the other face, and those are paired.
 * Null when nothing needed cutting or the pieces do not pair off.
 * @param {number[][][][][]} polygons two faces' islands
 * @param {boolean} [through] cut through the counters of an island that the islands it lies over lack
 * @returns {{ region: number[][][][][], cut: boolean }[] | null} per pair, each face's one island */
export declare function sharedIslands(polygons: number[][][][][], through?: boolean): {
    region: number[][][][][];
    cut: boolean;
}[] | null;
/** Compute correspondences and local stroke widths once, independently of the controls.
 * @param {number[][][][][]} polygons each face's one island
 * @param {boolean} [cut] the islands were cut from larger ones */
export declare function prepareCorrespondence(polygons: number[][][][][], cut?: boolean): (((shares: number[], weight: number) => number[][][]) & {
    strain: number;
}) | null;
/** @param {number[][][]} rings */
export declare function prepareWeight(rings: number[][][]): (/** @type {number} */ weight: number) => number[][][];
