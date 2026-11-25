export type Contour = {
    ops: unknown[];
    light: Float64Array;
    heavy: Float64Array;
    width: unknown;
};
export type Segment = [string, number[][]];
/** Split a verified contour into 丿 and the rest of the frame. Their closing
 * chords run in opposite directions along the same junction in both masters.
 * @param {Contour} contour @param {string} style @param {string} [char] */
export declare function splitBirdCrest(contour: Contour, style: string, char?: string): {
    ops: (string | number | boolean)[][];
    light: Float64Array<ArrayBuffer>;
    heavy: Float64Array<ArrayBuffer>;
    width: unknown;
}[] | null;
