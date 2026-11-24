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
 * @returns {number[][][][][][] | null} per island, each face's one island */
export declare function splitIslands(polygons: number[][][][][]): number[][][][][][] | null;
/** Compute correspondences and local stroke widths once, independently of the controls.
 * @param {number[][][][][]} polygons each face's one island
 * @param {boolean} [cut] the islands were cut from larger ones */
export declare function prepareCorrespondence(polygons: number[][][][][], cut?: boolean): ((shares: number[], weight: number) => number[][][]) | null;
/** @param {number[][][]} rings */
export declare function prepareWeight(rings: number[][][]): (/** @type {number} */ weight: number) => number[][][];
