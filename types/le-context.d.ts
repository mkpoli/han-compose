/** @param {string} key */
export declare const leContextDonors: (key: string) => string[];
/** @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region */
export declare function leContextParts(composer: import('./compose.js').Composer, key: string, region: number[]): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
}[] | null;
