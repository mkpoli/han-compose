/** @typedef {[number, number]} Point */
/** @typedef {{ type: 'M' | 'L', p: Point } | { type: 'Q', p: Point, c: Point, end: Point } | { type: 'C', p: Point, c1: Point, c2: Point, end: Point } | { type: 'Z', p: Point, start: Point }} Segment */
/** @typedef {{ segments: Segment[], points: Point[] }} Path */
export type Point = [number, number];
export type Segment = {
    type: 'M' | 'L';
    p: Point;
} | {
    type: 'Q';
    p: Point;
    c: Point;
    end: Point;
} | {
    type: 'C';
    p: Point;
    c1: Point;
    c2: Point;
    end: Point;
} | {
    type: 'Z';
    p: Point;
    start: Point;
};
export type Path = {
    segments: Segment[];
    points: Point[];
};
/** A path the source cannot read as the absolute M, L, Q, C, Z subset a drawing uses. */
export declare class PathError extends Error {
    name: string;
}
/** Whether the text is that subset at all, without reading it. @param {string} d */
export declare const isPath: (/** @type {string} */ d: string) => boolean;
/** Parse the absolute M, L, Q, C and Z subset a document geometry uses. @param {string} d @returns {Path} */
export declare function parsePath(d: string): Path;
/** The closed subpaths of a piece, each starting at M. @param {string} d @returns {string[]} */
export declare const splitSubpaths: (/** @type {string} */ d: string) => string[];
/** The polygon a closed subpath traces, with each curve sampled. @param {string} d @returns {Point[]} */
export declare function flatten(d: string): Point[];
/** The signed area of a polygon. @param {Point[]} points */
export declare function signedAreaOf(points: Point[]): number;
/** Whether `point` lies inside the polygon through `points`, by the even-odd rule.
 * @param {Point} point @param {Point[]} points */
export declare function inside(point: Point, points: Point[]): boolean;
/** Whether any edge of one polygon properly crosses an edge of the other. @param {Point[]} one @param {Point[]} other */
export declare function edgesCross(one: Point[], other: Point[]): boolean;
/** Whether `inner` lies wholly inside `outer`: every vertex is inside and no edge crosses.
 * @param {Point[]} outer @param {Point[]} inner */
export declare function contains(outer: Point[], inner: Point[]): boolean;
