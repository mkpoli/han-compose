/** How a loose mark is drawn: `attached` sits over or under the drawing, `kana`, `spacing` and
 *  `hangul` beside it. @param {string} char */
export declare function markKind(char: string): "attached" | "hangul" | "kana" | "spacing";
/** Whether a mark sits beside the drawing, in the margin the character leaves for it. @param {string} char */
export declare const isOutbound: (char: string) => boolean;
/**
 * The box the description draws in when its outbound marks take a margin: the character shrinks toward
 * the corner opposite the marks, leaving them outside its ink. `box` is the marks' box in `frame`
 * (font units, y up). Answers `{ face, scale, side }`; scale 1 leaves `frame` as it is.
 * @param {number[]} frame
 * @param {number[]} box
 */
export declare function markFace(frame: number[], box: number[]): {
    face: number[];
    scale: number;
    side: string;
};
/**
 * The loose marks of a description as placed parts: `placed` records the composer draws with everything
 * else, origin `mark <char>`. `frame` is the character box in font units (y up) the marks that sit
 * beside the drawing use; `attachedFrame` is the box the combining marks sit over, smaller when the
 * character makes room for them. Marks with no outline in the loaded data are left out, so a preview
 * keeps the drawing it has.
 * @param {import('./compose.js').Composer} composer
 * @param {string} marks
 * @param {number[]} [frame]
 * @param {number[]} [attachedFrame]
 */
export declare function markParts(composer: import('./compose.js').Composer, marks: string, frame?: number[], attachedFrame?: number[]): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
}[];
