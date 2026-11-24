/** `part` with the named contours' top (y above `yTarget`) cut off at that height. */
export declare function clippedAbove(part: any, indices: any, yTarget: any): any;
/** `part` with the named contours lowered by `drop` in the target, along y, keeping their columns;
 *  a negative `drop` raises them. */
export declare function lowered(part: any, indices: any, drop: any): any;
/** `part` with the named contours' height changed about their centre, along y. */
export declare function heightened(part: any, indices: any, factor: any): any;
/** `part` with the named contour moved to span `from`–`to` in the target, along x, keeping its rows. */
export declare function respanned(part: any, index: any, from: any, to: any): any;
/** `part` without the named contours. */
export declare function withoutContours(part: any, indices: any): any;
/** The 丶 glyph in `band`: at its own em size where that fits, as large as the band allows
 *  otherwise, standing on the band's bottom as a dot does. A cut of a 丶 that the font drew as a
 *  捺 (遝's lower dot) keeps the slash's shape; the glyph has the dot's. */
export declare function dotIn(composer: any, band: any): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
} | null;
/**
 * The corrections, by description. `glyphs` ties each to the outlines it was read against.
 * A correction that cannot find the parts it names leaves the drawing as it is.
 */
export declare const COMPONENT_FIXES: {
    '\u2FF1\u4E00\u4E1B': {
        glyphs: {
            丛: string[];
        };
        apply(parts: any, composer: any): any;
    };
    '\u2FF0\u672A\u2FF1\u6210\u516C': {
        glyphs: {
            未: string;
        };
        apply(parts: any, composer: any): any;
    };
    '\u2FFB\u53E3\u571F': {
        glyphs: {
            口: string;
            土: string;
        };
        apply(parts: any, composer: any): any;
    };
    '\u2FF1\u547C\u4E59': {
        glyphs: {};
        apply(parts: any, composer: any): any;
    };
    '\u2FF1\u4E00\u5FC3': {
        glyphs: {};
        apply(parts: any, composer: any): any;
    };
    '\u2FFB\u65E5\u4E3F': {
        glyphs: {
            甲: string;
            屮: string;
        };
        apply(parts: any): any;
    };
    '\u2FFB\u4E00\u6B62': {
        glyphs: {
            止: string[];
        };
        apply(parts: any): any;
    };
    '\u2FF8\u2FF9\u4E05\u4E3F\u4E28': {
        glyphs: {
            丅: string[];
            丿: string[];
            丨: string[];
        };
        apply(parts: any, composer: any, region?: any): any;
    };
    '\u2FF9\u2FFB\u4E5B\u4E85\u31D2': {
        glyphs: {
            乛: string;
            亅: string;
        };
        apply(parts: any, composer: any, region?: any): any;
    };
    '\u2FF5\uD858\uDE6A\u4E05': {
        glyphs: {
            鬲: string;
        };
        apply(parts: any, composer: any): any;
    };
    '\u2FF5\uD858\uDE6A\u5341': {
        glyphs: {
            鬲: string[];
            十: string[];
        };
        apply(parts: any, composer: any): any;
    };
    '\u2FF0\uD840\uDD20\uD840\uDD20': {
        glyphs: {
            𠄠: string;
        };
        apply(parts: any): any;
    };
    '\u2FF1\uD880\uDC01\u53E3': {
        glyphs: {
            𤆖: string;
            吂: string;
        };
        apply(parts: any, composer: any, region?: any): any;
    };
    '\u2FF5\u5182\u4E28': {
        glyphs: {
            円: string;
            丨: string;
        };
        apply(parts: any): any;
    };
    '\u2FF2\u6728\u5341\u6728': {
        glyphs: {};
        apply(parts: any): any;
    };
};
/** `parts`, with the correction a description carries applied where the outlines are the ones it
 *  was read against. */
export declare function componentFix(sequence: any, parts: any, composer: any, region?: any): any;
