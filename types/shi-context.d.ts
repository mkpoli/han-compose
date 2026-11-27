/** @param {string} key */
export declare const shiContextDonors: (key: string) => string[];
/** @param {import('./compose.js').Composer} composer @param {string} key */
export declare const excludedShiContext: (composer: import('./compose.js').Composer, key: string) => boolean;
/** @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region */
export declare function shiContextParts(composer: import('./compose.js').Composer, key: string, region: number[]): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
}[] | null;
