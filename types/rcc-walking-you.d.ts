export declare const walkingYou = "\u2FFA#(\u31CB\u4E40)\u7531";
export type WalkingCut = {
    yan: string;
    contour: number;
    runs: number[][];
    inner: string;
    digest: string;
    body: number[];
    inside: number[];
};
/** @param {string} style */
export declare const walkingYouDonors: (style: string) => string[];
/** @param {import('./compose.js').Composer} composer @param {number[]} region */
export declare function walkingYouParts(composer: import('./compose.js').Composer, region: number[]): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
    rccLeaf: number;
    fixed: boolean;
}[] | null;
