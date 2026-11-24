/**
 * The drawn parts grouped by the leaf of `leaves` each belongs to: `{ index, parts, box }[]`, `index`
 * the leaf's place in reading order, `parts` the indices into `pieces`, and `box` the box around
 * them. Null when the pieces cannot be told apart by leaf: one piece spans two leaves (the composer
 * drew the whole description as one glyph), or a filled leaf has no piece. A leaf drawn in several
 * pieces groups them together.
 * @param {{ box: number[], leaf?: number }[]} pieces
 * @param {{ index: number, box: number[], empty?: boolean }[]} leaves
 * @returns {{ index: number, parts: number[], box: number[] }[] | null}
 */
export declare function groupParts(pieces: {
    box: number[];
    leaf?: number;
}[], leaves: {
    index: number;
    box: number[];
    empty?: boolean;
}[]): {
    index: number;
    parts: number[];
    box: number[];
}[] | null;
