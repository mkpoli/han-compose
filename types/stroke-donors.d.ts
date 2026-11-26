export type OutlineContour = {
    ops: [string, number, boolean][];
    light: Float64Array;
    heavy: Float64Array;
    width: number[] | null;
};
export type OutlinePart = {
    contours: OutlineContour[];
    box: number[];
    reverse?: boolean;
};
export type StrokeRecord = {
    b: number[];
    p: string[][];
    v: number;
    w?: number[];
};
export type BoundaryRanges = {
    index: number;
    segments: number[][];
};
export type StrokeCut = {
    host: string;
    digest: string;
    contours: number[];
    ranges?: BoundaryRanges;
};
export type OutlineSegment = [string, number[][]];
export type FaceTable<T> = Record<string, Record<string, T> | undefined>;
/** @param {string} char @param {string} style */
export declare function strokeDonor(char: string, style: string): string | undefined;
/**
 * @param {OutlineContour[]} contours
 * @param {number[][]} runs
 * @returns {OutlineContour}
 */
export declare function reconnectStroke(contours: OutlineContour[], runs: number[][]): OutlineContour;
/** @param {string} char @param {string} style @param {(char: string) => StrokeRecord | null | undefined} [recordOf] */
export declare function nativeStroke(char: string, style: string, recordOf?: (char: string) => StrokeRecord | null | undefined): any;
/** @param {string} char @param {string} style @param {(char: string) => OutlinePart | null | undefined} glyphOf */
export declare function reconstructStroke(char: string, style: string, glyphOf: (char: string) => OutlinePart | null | undefined): any;
