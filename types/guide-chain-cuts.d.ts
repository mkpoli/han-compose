/** @param {string} key */
export declare const guideChainDonor: (key: string) => string | undefined;
/** @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region @param {boolean} [atRoot] */
export declare function guideChainParts(composer: import('./compose.js').Composer, key: string, region: number[], atRoot?: boolean): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
}[] | null;
