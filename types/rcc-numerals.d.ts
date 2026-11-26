/** @param {string} key @param {string} style */
export declare function numeralDonors(key: string, style: string): string[];
/** R+09D2: 胡懷琛《簡易字表》 (1928), p. 102.
 * R+09D4 and R+09D6: 「圕」新字之商榷（第三次）.
 * https://rare.glyphatlas.org/en/entry/2514#sighting-2678
 * https://rare.glyphatlas.org/en/entry/2516#sighting-2680
 * https://rare.glyphatlas.org/en/entry/2518#sighting-2682
 * @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region */
export declare function numeralParts(composer: import('./compose.js').Composer, key: string, region: number[]): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
    fixed: boolean;
    rccLeaf: number;
}[] | null;
