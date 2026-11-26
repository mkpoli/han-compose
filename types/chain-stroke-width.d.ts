/**
 * Map the outline of a swept stroke along its new length while retaining its
 * pen width across the sweep. A dot stretched from the corner to the foot of
 * 又 can travel several times its original length. Sampling both sides keeps
 * its changing thickness and the bow of the original outline.
 * @param {any} glyph
 * @param {((v: number) => number)[]} maps
 * @param {number} slope The sign of the stroke's overall slope in font space.
 */
export declare function sweepMap(glyph: any, maps: ((v: number) => number)[], slope: number): ((x: number, y: number) => number[]) | null;
/** A rising-entry sweep taken from the side or foot of a character retains
 * its entry and terminal shape when used at a steeper angle.
 * @param {any} glyph @param {number[]} from @param {number[]} to */
export declare function risingSweepMap(glyph: any, from: number[], to: number[]): ((x: number, y: number) => number[]) | null;
