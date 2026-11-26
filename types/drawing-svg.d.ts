/** The filter that turns an emoji's ink into a hole in what ㇯ subtracts it from. */
export declare const EMOJI_CUT_MATRIX = "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0";
/** Font size that draws an emoji's ink the shorter side of its box across: Noto Emoji's glyphs fill
 *  the em square, 2,080 of its 2,048 units against an advance of 2,784, so a size of 1 draws 0.73 of
 *  the box, and 1/0.73 the whole box. */
export declare const EMOJI_SCALE = 1.36;
/** Where an emoji stands in its box: `{ x, y, size }`, its middle and its font size, all finite.
 *  @param {{ box?: number[] } | null | undefined} item @returns {{ x: number, y: number, size: number }} */
export declare function emojiPlace(item: {
    box?: number[];
} | null | undefined): {
    x: number;
    y: number;
    size: number;
};
/** Reflect an emoji around the centre of its layout box; a box that is not four finite numbers has no reflection.
 * @param {{ box?: number[], flip?: [boolean, boolean] }} item */
export declare function emojiTransform(item: {
    box?: number[];
    flip?: [boolean, boolean];
}): string;
export type DrawingForSvg = {
    d: string;
    cut?: string;
    slots?: {
        index: number;
        box: number[];
    }[];
    stroke?: number[] | null;
    parts?: {
        d: string;
        cut?: boolean;
        leaf?: number;
        operandOnly?: boolean;
    }[];
    transforms?: (string | null)[];
    emoji?: {
        text: string;
        box: number[];
        part?: number;
        flip?: [boolean, boolean];
        cut?: boolean;
        restored?: boolean;
    }[];
};
/**
 * @typedef {object} DrawingForSvg
 * @property {string} d
 * @property {string} [cut]
 * @property {{ index: number, box: number[] }[]} [slots]
 * @property {number[] | null} [stroke]
 * @property {{ d: string, cut?: boolean, leaf?: number, operandOnly?: boolean }[]} [parts]
 * @property {(string | null)[]} [transforms]
 * @property {{ text: string, box: number[], part?: number, flip?: [boolean, boolean], cut?: boolean, restored?: boolean }[]} [emoji]
 */
/**
 * A drawing as a file of its own: an SVG of its ink in `ink` on `background` (none for a transparent
 * one), `padding` the share of the 1000-unit box added on each side, `size` its width and height in
 * pixels. Empty slots are left out unless `placeholders`, which draws each as the editor does, in the
 * ink at half strength.
 * @param {DrawingForSvg} drawing
 * @param {{ background?: string | null, ink?: string, padding?: number, size?: number, placeholders?: boolean, idPrefix?: string }} [options]
 * @returns {string}
 */
export declare function drawingSvg(drawing: DrawingForSvg, { background, ink, padding, size, placeholders, idPrefix }?: {
    background?: string | null;
    ink?: string;
    padding?: number;
    size?: number;
    placeholders?: boolean;
    idPrefix?: string;
}): string;
