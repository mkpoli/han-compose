export declare const SI_CHAIN = "#(\u4E00-\uD840\uDCCD\u31C4)";
export type Cut = {
    donor: string;
    hostHash: string;
    donorHash: string;
    host: number[];
    bend: number[];
    stretch?: number[];
};
export declare const siBendDonor: (/** @type {string} */ style: string) => string;
export type Segment = [string, number[][]];
/** @param {import('./compose.js').Composer} composer */
export declare function siChainForm(composer: import('./compose.js').Composer): {
    part: {
        contours: any[];
        box: number[];
        inkLength: any;
    };
    f: any;
    u: any;
    ink: any;
    o: number;
} | null;
