/** @param {string} char @param {ReturnType<typeof grassPairs>} groups */
export declare function contextualGrass(char: string, groups: ReturnType<typeof grassPairs>): {
    indices: number[];
    box: number[];
    score: number;
}[] | null;
export type Contour = {
    light: ArrayLike<number>;
    ops: any[];
};
/** Identify split heads anywhere in the native outline, including side and lower components.
 * @param {{contours: Contour[]}} glyph @param {number[] | undefined} owned */
export declare function grassPairs(glyph: {
    contours: Contour[];
}, owned: number[] | undefined): {
    indices: number[];
    box: number[];
    score: number;
}[];
/** @param {number[]} box @param {number[]} source @param {number[]} target */
export declare function connectedGrass(box: number[], source: number[], target: number[], context?: string): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
    fixed: boolean;
};
