export type ChainStroke = {
    char: string;
    reversed: boolean;
    cross: number | null;
    at: number[];
};
export type Segment = {
    stroke: number;
    from: number;
    to: number;
    kind: string;
};
/** @typedef {{ char: string, reversed: boolean, cross: number | null, at: number[] }} ChainStroke */
/** @typedef {{ stroke: number, from: number, to: number, kind: string }} Segment */
/**
 * The strokes of a chain, or null where it names one this module has no segments for. Letters are
 * read as the character they spell, longest first.
 * @param {string} text @returns {{ strokes: ChainStroke[], closed: boolean } | null}
 */
export declare function parseChain(text: string): {
    strokes: ChainStroke[];
    closed: boolean;
} | null;
/**
 * A drawing of a chain on a grid: each vertex's x and y line and each line's place, 0 to 1, or null
 * where the joins contradict each other.
 * @param {string} text
 */
export declare function solveChain(text: string): {
    strokes: ChainStroke[];
    segments: Segment[];
    xs: {
        find: (i: number) => number;
        join: (a: number, b: number) => void;
    };
    ys: {
        find: (i: number) => number;
        join: (a: number, b: number) => void;
    };
    points: {
        find: (i: number) => number;
        join: (a: number, b: number) => void;
    };
    x: Map<number, number>;
    y: Map<number, number>;
    broken: number;
} | null;
/**
 * A chain as a component form: its strokes' glyphs joined, or null where the chain has no drawing or
 * a stroke no glyph. @param {string} text @param {(char: string) => any} glyphOf
 * @returns {{ parts: any[], frame: number[], ink: number, solved: any } | null}
 */
export declare function chainForm(text: string, glyphOf: (char: string) => any): {
    parts: any[];
    frame: number[];
    ink: number;
    solved: any;
} | null;
/** Whether a component is a stroke chain no character is read for. @param {any} text */
export declare const isChain: (text: any) => boolean;
/**
 * The box an enclosure's inner part goes into: the grid cells of a chain with ink on the sides the
 * operator closes and, as far as it can be, none on the others. `taken` are boxes other parts hold.
 * Boxes are in the chain's own em units, or null where no cell qualifies.
 * @param {any} solved @param {string} sides The closed sides, of `LRBT`. @param {number[][]} [taken]
 * @returns {number[] | null}
 */
export declare function chainRoom(solved: any, sides: string, taken?: number[][]): number[] | null;
