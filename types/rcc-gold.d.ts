/** @param {string} key @param {string} style */
export declare const goldDonors: (key: string, style: string) => string[];
/** @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region */
export declare function goldParts(composer: import('./compose.js').Composer, key: string, region: number[]): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
    rccLeaf: number;
    fixed: boolean;
}[] | null;
