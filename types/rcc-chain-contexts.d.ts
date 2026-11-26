export type Run = [number, number, number];
export type Segment = [string, number[][]];
/** @param {string} key @param {string} style */
export declare function rccChainDonors(key: string, style: string): string[];
/** @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region */
export declare function rccChainContextParts(composer: import('./compose.js').Composer, key: string, region: number[]): any[] | null;
