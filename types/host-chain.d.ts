/** @param {any} node @param {string} style */
export declare function chainHost(node: any, style: string): string;
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
