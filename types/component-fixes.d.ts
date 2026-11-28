import { penGrassKu } from './grass-ku.js';
/** Close the gap after 忄 without stretching its dots or the neighbouring glyph. */
declare function heartColumnSpacing(parts: any, composer: any): any;
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
export declare const WEALTH_IDS = "\u2FFA\u8FB6\u2FF1\u5B80\u2FF1\u2FF0\u738B\u5C14\u2FF2\u96B9\u8C9D\u62DB";
/**
 * The seven leaf boxes of `⿺辶⿱宀⿱⿰王尔⿲隹貝招` across all five faces, with
 * clearance on interior edges when nested inside a larger `face`.
 * @param {string} key
 * @param {string} style
 * @param {number[]} region
 * @param {number[] | null} [face]
 * @returns {number[][] | null}
 */
export declare function wealthBoxes(key: string, style: string, region: number[], face?: number[] | null): number[][] | null;
export declare const INCOME_IDS = "\u2FF1\u2FF0\u65E5\u6597\u2FFA\u8FB6\u2FF0\u96B9\u91D1";
/**
 * The five leaf boxes of `⿱⿰日斗⿺辶⿰隹金` mapped into `region` for `style`, with clearance on
 * any edge that sits strictly inside `face` (when nested beside or below another component).
 * @param {string} key
 * @param {string} style
 * @param {number[]} region
 * @param {number[] | null} [face]
 * @returns {number[][] | null}
 */
export declare function incomeBoxes(key: string, style: string, region: number[], face?: number[] | null): number[][] | null;
export declare function enclosedZeroTarget(zero: any, opening: any): any[];
/**
 * The corrections, by description. `glyphs` ties each to the outlines it was read against.
 * A correction that cannot find the parts it names leaves the drawing as it is.
 */
export declare const COMPONENT_FIXES: {
    '\u2FF2\u5B50\u5B50\u5B50': {
        glyphs: {};
        apply(parts: any, composer: any): any;
    };
    '\u2FF1\u6797\uD850\uDD8D': {
        glyphs: {};
        apply(parts: any, composer: any, region: any): any;
    };
    '\u2FF1\u6797\u2FF1\u5927\u706B': {
        glyphs: {};
        apply(parts: any, composer: any, region: any): any;
    };
    '\u2FF1\u5DE5\u53E3': {
        glyphs: {};
        apply(parts: any, composer: any, region: any): any;
    };
    𢀛: {
        glyphs: {};
        apply(parts: any, composer: any, region: any): any;
    };
    '\u2FF4\u53E3\u4E36': {
        glyphs: {};
        apply(parts: any, composer: any): any;
    };
    "\u2FFA\u8FB6\u2FF1\u5B80\u2FF1\u2FF0\u738B\u5C14\u2FF2\u96B9\u8C9D\u62DB": {
        glyphs: {};
        apply(parts: any, composer: any, region: any): any;
    };
    '\u2FF0\uD874\uDCC2\u5C24': {
        glyphs: {
            那: string;
        };
        apply(parts: any, composer: any, region: any): any;
    };
    '\u2FF0\u864D\u5202': {
        glyphs: {};
        apply(parts: any, composer: any, region: any): any;
    };
    '\u2FF2\uD840\uDCA4\u65E5\u5343': {
        glyphs: {};
        apply(parts: any, composer: any): any;
    };
    '\u2FF0\u821F\u908A': {
        glyphs: {};
        apply(parts: any, composer: any, region: any): any;
    };
    '\u2FF1\u9FB9\u5E78': {
        glyphs: {};
        apply(parts: any, composer: any): any;
    };
    "\u2FF1\u2FF0\u65E5\u6597\u2FFA\u8FB6\u2FF0\u96B9\u91D1": {
        glyphs: {};
        apply(parts: any, composer: any, region: any): any;
    };
    '\u2FF1\u6295\u77F3': {
        glyphs: {};
        apply(parts: any, composer: any): any;
    };
    '\u2FF0\u8C9D\u4E26': {
        glyphs: {
            賦: string;
        };
        apply(parts: any, composer: any): any;
    };
    '\u2FF0\u6C34\u884C': {
        glyphs: {};
        apply(parts: any, composer: any): any;
    };
    '\u2FF8\u5382\uD853\uDFC1': {
        glyphs: {
            𤿁: string[];
        };
        apply(parts: any, composer: any): any;
    };
    '\u2FF5\u95E8\u6597': {
        glyphs: {
            闭: string;
        };
        apply(parts: any, composer: any, region: any): any;
    };
    '\u2FF5\u95E8T': {
        glyphs: {
            闭: string;
        };
        apply(parts: any, composer: any, region: any): any;
    };
    '\u2FF0\uD82C\uDCA6\u65B9': {
        glyphs: {};
        apply(parts: any, composer: any, region: any): any;
    };
    '\u2FF1\u8279\u5800': {
        glyphs: {
            堀: string;
            䕋: string;
            䓛: string;
        };
        apply: typeof penGrassKu;
    };
    '\u2FF0\u8EAB\u82B1': {
        glyphs: {};
        apply(parts: any, composer: any): any;
    };
    '\u2FF0\u9B5A\u9042': {
        glyphs: {};
        apply(parts: any, composer: any): any;
    };
    '\u2FF0\u5FC4\u5B9F': {
        glyphs: {};
        apply: typeof heartColumnSpacing;
    };
    '\u2FF0\u5FC4\u5BE6': {
        glyphs: {};
        apply: typeof heartColumnSpacing;
    };
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
    '\u2FF0\u821F\u82D7': {
        glyphs: {};
        apply(parts: any, composer: any): any;
    };
    '\u2FF0\u8ECA\u30C8': {
        glyphs: {
            ト: string;
        };
        apply(parts: any, composer: any): any;
    };
    '\u2FF0\u751F\u610F': {
        glyphs: {};
        apply(parts: any, composer: any): any;
    };
    '\u2FF3\u5405\u5DE5\u5405': {
        glyphs: {
            工: string;
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
    '\u2FF4\u56D7\u3007': {
        glyphs: {};
        apply(parts: any, composer: any): any;
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
export {};
