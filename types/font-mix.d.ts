import { compose } from './loader.js';
export declare const FONT_STYLES: readonly ['sans', 'serif', 'woodblock', 'fangsong', 'regular', 'pen-writing'];
export type FontStyle = typeof FONT_STYLES[number];
export type FontMix = {
    shares: Partial<Record<FontStyle, number>>;
    weight?: number;
};
/** @typedef {typeof FONT_STYLES[number]} FontStyle */
/** @typedef {{ shares: Partial<Record<FontStyle, number>>, weight?: number }} FontMix */
/** Validate before requesting any export. Shares are relative, and weight is a stroke-width multiplier.
 * @param {FontMix} mix */
export declare function activeFaces({ shares, weight }: FontMix): {
    style: "fangsong" | "pen-writing" | "regular" | "sans" | "serif" | "woodblock";
    share: number;
}[];
/** Compose from any combination of the five face exports, in a browser or on the server.
 * @param {Partial<Record<FontStyle, Parameters<typeof compose>[0]>>} sources
 * @param {string} sequence @param {FontMix} mix @param {Parameters<typeof compose>[2]} [options] */
export declare function composeMixed(sources: Partial<Record<FontStyle, Parameters<typeof compose>[0]>>, sequence: string, mix: FontMix, options?: Parameters<typeof compose>[2]): Promise<import("./index.js").Drawing | {
    d: string;
    cut: string;
    slots: any;
    missing: any[];
    normalization: {
        capped: boolean;
    };
    stroke: any[] | null;
    parts: any;
    origins: any;
    kanjivg: any;
    approximate: any[];
    cells?: boolean | undefined;
}>;
