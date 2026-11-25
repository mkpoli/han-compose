/** The encoded character of an exact, unmodified level-1 description. @param {any} node */
export declare function birdChainChar(node: any): string | null;
/** Draw the complete glyph at its native proportions, when the selected face has it.
 * @param {import('./compose.js').Composer} composer @param {any} node
 * @param {number[]} region @param {boolean} atRoot */
export declare function birdChainParts(composer: import('./compose.js').Composer, node: any, region: number[], atRoot: boolean): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
}[] | null;
