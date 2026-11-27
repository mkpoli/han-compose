export type Member = [string, number[]];
/** @param {string} key @param {string} style */
export declare function overlayContextDonors(key: string, style: string): string[];
/** @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region */
export declare function overlayContextParts(composer: import('./compose.js').Composer, key: string, region: number[]): any;
