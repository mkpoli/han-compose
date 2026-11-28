export { FONT_STYLES, composeMixed } from './font-mix.js';
import { APPROXIMATE, EMPTY } from './compose.js';
import { createDrawer } from './client.js';
import { LIMITS, LookupError, PYRAMID_LAYERS, compose, createSource, fromUrl, size, sketch, svgBox, tooLarge } from './loader.js';
export { APPROXIMATE, EMPTY };
export { LIMITS, LookupError, PYRAMID_LAYERS, compose, createSource, createDrawer, fromUrl, size, sketch, svgBox, tooLarge };
export { unicodeSource, hasUnicodeGlyph, UNICODE_COVERAGE } from './unicode.js';
export { unpack } from './loader.js';
export { componentDrawing, componentParts } from './component-forms.js';
export { documentSource, composeDocumentSource } from './document-source.js';
export { documentView } from './document-view.js';
export { placeholder, STROKE } from './slot-placeholder.js';
export { drawingSvg, EMOJI_CUT_MATRIX, emojiTransform } from './drawing-svg.js';
export { groupParts } from './group-parts.js';
export { pyramidOnBase, pyramidRows } from './pyramid-rows.js';
export { parseDescription, splitDescription, writeDescription, isNode, isEmpty, isComponent, isLetter, isMark, isMarks } from './tree.js';
export { pyramidSequence, pyramidCount } from './pyramid-sequence.js';
export { emojiPrefix, emojiSlots } from './emoji.js';
export { tokens } from './tokens.js';
export { characterScript, treeScript } from './scripts.js';
export { partScript } from './part-script.js';
export type Drawing = {
    /**
     * The SVG path of the ink, nonzero fill.
     */
    d: string;
    /**
     * The path of what ㇯ takes away, masked out of `d`.
     */
    cut?: string;
    /**
     * Each empty slot, in reading order, in the box the layout gives it.
     */
    slots?: {
        index: number;
        box: number[];
        leaf?: number;
    }[];
    /**
     * The leaves of the sequence in reading order, an empty slot as ⬚.
     */
    leaves?: string[];
    /**
     * The stroke widths the drawing is weighted to, across x and y.
     */
    stroke?: number[] | null;
    /**
     * Operators drawn by rooms and turns of this port's own choosing.
     */
    approximate?: string[];
    /**
     * Whether a part was cut along KanjiVG's groups, so the drawing is shared alike (CC BY-SA 3.0).
     */
    kanjivg?: boolean;
    /**
     * Each drawn part: the leaf it stands under, where it came from, its box and its path, and the source stroke groups it was cut along. An operandOnly piece belongs to an editable subtraction and is already accounted for in the visible path.
     */
    parts?: {
        leaf: number;
        origin: string;
        box: number[];
        d: string;
        cut?: boolean;
        operandOnly?: boolean;
        strokes?: [number, number[]][];
    }[];
    /**
     * Where each drawn part came from, in reading order.
     */
    origins?: string[];
    /**
     * Whether operand normalization hit its limit.
     */
    normalization?: {
        capped: boolean;
    };
    /**
     * Whether the composition uses cell layout.
     */
    cells?: boolean;
    /**
     * Characters the drawing needed but the export could not draw.
     */
    missing?: string[];
    /**
     * Each Emoji part, drawn as text in its box; `part` is its piece in `parts` when the parts could be told apart.
     */
    emoji?: {
        text: string;
        box: number[];
        leaf: number;
        part: number;
        flip?: [boolean, boolean];
        cut?: boolean;
        restored?: boolean;
    }[];
};
export type SketchLeaf = {
    /**
     * The leaf's place in reading order.
     */
    index: number;
    /**
     * [x, y, width, height] in the drawing's box, y down.
     */
    box: number[];
    /**
     * Whether the leaf is an empty slot.
     */
    empty: boolean;
};
export type PreviewOptions = {
    /**
     * Relative shares of the face exports and an independent stroke weight.
     */
    mix?: import('./font-mix.js').FontMix;
    signal?: AbortSignal;
    onSketch?: (leaves: SketchLeaf[]) => void;
};
/**
 * The ink of a sequence in a 1000-unit box, y down, as a drawing fills it.
 * @typedef {object} Drawing
 * @property {string} d The SVG path of the ink, nonzero fill.
 * @property {string} [cut] The path of what ㇯ takes away, masked out of `d`.
 * @property {{ index: number, box: number[], leaf?: number }[]} [slots] Each empty slot, in reading order, in the box the layout gives it.
 * @property {string[]} [leaves] The leaves of the sequence in reading order, an empty slot as ⬚.
 * @property {number[] | null} [stroke] The stroke widths the drawing is weighted to, across x and y.
 * @property {string[]} [approximate] Operators drawn by rooms and turns of this port's own choosing.
 * @property {boolean} [kanjivg] Whether a part was cut along KanjiVG's groups, so the drawing is shared alike (CC BY-SA 3.0).
 * @property {{ leaf: number, origin: string, box: number[], d: string, cut?: boolean, operandOnly?: boolean, strokes?: [number, number[]][] }[]} [parts] Each drawn part: the leaf it stands under, where it came from, its box and its path, and the source stroke groups it was cut along. An operandOnly piece belongs to an editable subtraction and is already accounted for in the visible path.
 * @property {string[]} [origins] Where each drawn part came from, in reading order.
 * @property {{ capped: boolean }} [normalization] Whether operand normalization hit its limit.
 * @property {boolean} [cells] Whether the composition uses cell layout.
 * @property {string[]} [missing] Characters the drawing needed but the export could not draw.
 * @property {{ text: string, box: number[], leaf: number, part: number, flip?: [boolean, boolean], cut?: boolean, restored?: boolean }[]} [emoji] Each Emoji part, drawn as text in its box; `part` is its piece in `parts` when the parts could be told apart.
 */
/**
 * Where the layout puts each leaf before the drawing is done.
 * @typedef {object} SketchLeaf
 * @property {number} index The leaf's place in reading order.
 * @property {number[]} box [x, y, width, height] in the drawing's box, y down.
 * @property {boolean} empty Whether the leaf is an empty slot.
 */
/**
 * @typedef {object} PreviewOptions
 * @property {import('./font-mix.js').FontMix} [mix] Relative shares of the face exports and an independent stroke weight.
 * @property {AbortSignal} [signal]
 * @property {(leaves: SketchLeaf[]) => void} [onSketch]
 */
/** A sequence larger than the composer draws (`LIMITS`). */
export declare class TooLargeError extends Error {
    name: string;
}
/** The export could not be read at all: unreachable, refused by CORS, not there, or `base` is no URL. */
export declare class UnavailableError extends Error {
    name: string;
}
export type WorkerLike = import('./client.js').WorkerLike;
export type FontMix = import('./font-mix.js').FontMix;
export type FontStyle = import('./font-mix.js').FontStyle;
/** @typedef {import('./client.js').WorkerLike} WorkerLike */
/** @typedef {import('./font-mix.js').FontMix} FontMix */
/** @typedef {import('./font-mix.js').FontStyle} FontStyle */
/**
 * A `preview` for an IDS editor: `draw(sequence, options)` answers the drawing, empty slots (⬚) and
 * Emoji included, or rejects with a `TooLargeError` (larger than `LIMITS`), an `UnavailableError`
 * (the export could not be read), an `AbortError` (its signal aborted), or a `LookupError` saying what
 * could not be drawn. Drawing runs in a Worker made by `worker`, one sequence at a time; a newer
 * request ends the one before, and the files it loaded stay in the browser's cache. A sequence drawn
 * once is answered from memory; `warm()` starts the Worker on the export before the first drawing.
 * `loaders` gives the URL each bundled file is served at, where a page serves the package's `data/`
 * somewhere of its own.
 *
 * The sequence reaches the composer as text, empty slots as ⬚. An Emoji part (👩‍💻) has no outlines:
 * it takes a slot of the draft, draws as text in the box the layout gave it, and comes back in the
 * drawing's `emoji`, with `restored` and `cut` saying what ㇯ does to it.
 *
 * `preferExport` draws from the export even where the bundled outlines would cover the sequence.
 * @param {{ base: string, separate?: boolean, fontStyle?: 'sans' | 'serif' | 'woodblock' | 'regular' | 'fangsong' | 'pen-writing',
 *   faceBases?: Partial<Record<import('./font-mix.js').FontStyle, string>>, preferExport?: boolean, worker?: () => WorkerLike, loaders?: Record<string, string>, timeout?: number }} options
 * @returns {((sequence: string, options?: PreviewOptions) => Promise<Drawing>) & { warm: () => void }}
 */
export declare function composerPreview({ base, faceBases, separate, fontStyle, preferExport, loaders, timeout, worker }: {
    base: string;
    separate?: boolean;
    fontStyle?: 'sans' | 'serif' | 'woodblock' | 'regular' | 'fangsong' | 'pen-writing';
    faceBases?: Partial<Record<import('./font-mix.js').FontStyle, string>>;
    preferExport?: boolean;
    worker?: () => WorkerLike;
    loaders?: Record<string, string>;
    timeout?: number;
}): ((sequence: string, options?: PreviewOptions) => Promise<Drawing>) & {
    warm: () => void;
};
export declare const dataUrls: {
    'sources/tangut/outlines.json.gz': string;
    'sources/bopomofo/outlines.json.gz': string;
    'sources/new-korean/outlines.json.gz': string;
    'sources/small-seal/outlines.json.gz': string;
    'sources/shuishu/outlines.json.gz': string;
    'sources/jurchen/outlines.json.gz': string;
    'sources/palette/outlines.json.gz': string;
    'numbered-sans-outlines.json.gz': string;
    'numbered-five-context.json': string;
    'custom-forms.json.gz': string;
};
