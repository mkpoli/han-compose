export type Drawing = import('./index.js').Drawing;
/** Mix the composer's y-down outlines before the preview restores any text emoji.
 * @param {Drawing[]} drawings @param {number[]} shares @param {number} weight
 * @param {(import('./index.js').SketchLeaf[] | null)[]} [sketches]
 * @returns {Drawing} */
export declare function mixDrawings(drawings: Drawing[], shares: number[], weight: number, sketches?: (import('./index.js').SketchLeaf[] | null)[]): Drawing;
