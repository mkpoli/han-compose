/** Union the original flattened Bézier contours in fixed point. Boundary correspondence
 * sees subpixel edges and the actual counter topology of overlapping strokes.
 * @param {number[][]} rings (flat x,y pairs, y down) */
export declare function inkPolygons(rings: number[][]): number[][][][];
/** Rings whose counters may overlap one another, redrawn so that ink is only where the
 * frames cover more than the counters do. Frames turn one way and counters the other.
 * @param {number[][][]} rings closed rings, the first a frame */
export declare function settledRings(rings: number[][][]): number[][][];
/** A smooth SVG outline with bounded corner rounding. Gentle turns use quadratic
 * joins; a serif, stroke tip or square corner keeps its vertex.
 * @param {number[][]} ring @param {number[]} box SVG [left,top,width,height]
 * @param {number} xScale @param {number} yScale @param {number} pad */
export declare function outlinePath(ring: number[][], box: number[], xScale: number, yScale: number, pad: number): string;
/** Sample the opposing ink edge along an inward normal. Use a local thickness for
 * the offset so a hairline beside a heavy stem survives thinning. Subdivide long
 * straight segments too: their middle can have a different thickness from the tip.
 * @param {number[][][]} rings */
export declare function weightVectors(rings: number[][][]): number[][][];
/** Constrain ink to a band either side of the limiting outline as a share vanishes.
 * Different sets of masters can have different contour correspondences, even for a
 * near-zero additional share. The band has zero width on the simplex boundary.
 * @param {string} drawing @param {string} boundary @param {number} radius */
export declare function limitDisplacement(drawing: string, boundary: string, radius: number): string;
