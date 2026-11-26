/** Glyphs whose light and heavy stem widths the reference drawing uses. @param {string} key @param {string} [_style] */
export declare function recordedArcDonors(key: string, _style?: string): string[];
/** Draw a source-attested arc component using the selected face's stem widths.
 * @param {import('./compose.js').Composer} composer @param {string} key
 * @param {number[]} region @param {boolean} atRoot */
export declare function recordedArcParts(composer: import('./compose.js').Composer, key: string, region: number[], atRoot: boolean): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
}[] | null;
