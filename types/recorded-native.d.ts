/** Pinned native outline for a glyph absent from format 7. @param {string} style @param {string} char */
export declare function recordedNativeRecord(style: string, char: string): {
    b: number[];
    p: string[][];
} | null;
/** A whole glyph absent from the exported drawing records, cut from this same face. @param {string} style @param {string} char */
export declare function recordedNativeGlyph(style: string, char: string): any;
