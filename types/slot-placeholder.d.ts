/** The stroke width a placeholder is drawn with where no drawing gives one: the font's at weight 400. */
export declare const STROKE = 80;
/**
 * A placeholder in `box` ([x, y, width, height], y down): `{ x, y, width, height, rx, dot, gap, dots }`,
 * the rectangle, the dots' width, their spacing and how many go round.
 * @param {number[]} box
 * @param {number} [stroke]
 */
export declare function placeholder(box: number[], stroke?: number): {
    x: number;
    y: number;
    width: number;
    height: number;
    rx: number;
    dot: number;
    gap: number;
    dots: number;
};
