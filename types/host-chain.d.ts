/** @param {any} node @param {string} style */
export declare function chainHost(node: any, style: string): string;
/** Select the frame only after the exact donor has been identified. Layout
 * may adjust its coordinates before the editable operands are cut.
 * @param {any} record @param {string} style @param {boolean} allowNoto */
export declare function horseFrameCut(record: any, style: string, allowNoto: boolean): {
    face: string;
    frame: (/** @type {any} */ glyph: any) => {
        contours: any[];
        box: number[];
    };
} | null;
/** Place a leaf drawn from an attested host whose frame has its own contours.
 * @param {import('./compose.js').Composer} composer
 * @param {any} node @param {number[]} region @param {boolean} atRoot @param {string} [written] */
export declare function hostChainParts(composer: import('./compose.js').Composer, node: any, region: number[], atRoot: boolean, written?: string): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
}[] | null;
