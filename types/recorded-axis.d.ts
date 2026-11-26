/** A tip shared with another source centerline, including an interior T join.
 * @param {number[]} vertex @param {number[][]} neighbors */
export declare function meetsSourceStroke(vertex: number[], neighbors: number[][]): boolean;
/** Place an own-face 一 or 丨 on a straight source segment. The two midpoint
 * samples align its trunk while retaining its native taper, tip and bow.
 * @param {number[]} line @param {any[]} stems @param {number[]} lightRadii @param {number[]} heavyRadii @param {boolean[]} joins */
export declare function nativeAxisContours(line: number[], stems: any[], lightRadii: number[], heavyRadii: number[], joins: boolean[]): any;
