export type Lift = {
    range: number[];
    bottom: number;
    top: number;
    offset: number[];
};
/** @param {string} chain @param {string} style */
export declare function youChainDonors(chain: string, style: string): string[];
/** @param {import('./compose.js').Composer} composer @param {string} chain @param {number[]} region @param {boolean} atRoot */
export declare function youChainParts(composer: import('./compose.js').Composer, chain: string, region: number[], atRoot: boolean): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
    fixed: boolean;
}[] | null;
