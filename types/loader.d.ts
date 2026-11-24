export { LookupError } from './compose.js';
export declare function unpack(buffer: any): Promise<string>;
/**
 * A source of the export's files. `read(name)` answers a file's bytes (an ArrayBuffer) by its name
 * in the export (`manifest.json`, `layout.json`, `g/07/07a3.json`), or null where there is no such
 * file; `fromUrl` builds one over HTTP.
 */
export declare function createSource(read: any, { concurrency }?: {
    concurrency?: number | undefined;
}): {
    manifest: null;
    /** The learned layout: null until a drawing has loaded it (`modelFiles`). */
    readonly layout: any;
    ready(): any;
    /** The files a description holding an operator reads beside its records: the identity table,
     *  and the learned layout unless `layout` is false, as for a description that sets no parts
     *  beside each other. They load like any file, by name. */
    modelFiles: ({ layout: learned }?: {
        layout?: boolean | undefined;
    }) => any[];
    /** Loads files by name, each once; a shard the export lacks reads as empty. */
    load(names: any): Promise<any[]>;
    /** The files holding the records of `keys`, to load before drawing. */
    filesOf: (keys: any) => Set<string>;
    /** The data a composer reads, noting each file it asked for that is not loaded. */
    store(): {
        manifest: null;
        missing: Set<any>;
        readonly layout: any;
        rec: (key: any) => any;
        hosts: (key: any, place: any) => any;
        places: (key: any) => any;
        kin: () => any;
        identity: (key: any) => any;
    };
};
/** A source over HTTP: `base` is the folder holding the export, `suffix` what each name carries there
 *  (`.gz`). `load` reads a Unicode shard of the package for a character the export lacks, where a
 *  host serves those files itself; without it the package's own copy is read. */
export declare function fromUrl(base: any, { suffix, fetch: get, load }?: {
    fetch?: ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) | undefined;
    load?: any;
    suffix?: string | undefined;
}): {
    manifest: null;
    readonly layout: any;
    ready(): any;
    modelFiles: (options: any) => any;
    load(names: any): Promise<void>;
    filesOf(keys: any): any;
    store(): {
        manifest: null;
        missing: any;
        readonly layout: any;
        identity: (key: any) => any;
        rec(key: any): any;
        hosts: (key: any, place: any) => any;
        places: (key: any) => any;
        kin: () => any;
    };
};
/** The largest description drawn. Every sequence BabelStone lists fits: the deepest nest six levels
 *  (𰻞, 𦧄) and the largest holds 21 operators (𦧄). */
export declare const LIMITS: {
    nodes: number;
    depth: number;
};
/** The most layers a pyramid preview draws. Each layer adds a cell, so 64 layers is 2,080 cells. */
export declare const PYRAMID_LAYERS = 64;
/** How many operators a tree has, and how deep they nest: a parsed tree (['⿰', …]) or the editor's
 *  (`{ op, parts }`). */
export declare function size(tree: any): {
    nodes: any;
    depth: number;
};
export declare const tooLarge: (tree: any) => boolean;
/** A box in font units (y up) as the drawing's SVG box has it: [x, y, width, height], y down. */
export declare const svgBox: (b: any) => any[];
/**
 * Where each leaf of `sequence` goes before it is drawn (`Composer.sketch`), once the manifest and the
 * layout have loaded: `[{ index, box, empty }]`, boxes as `svgBox` gives them.
 */
export declare function sketch(source: any, sequence: any, { fontStyle }?: {
    fontStyle?: string | undefined;
}): Promise<any>;
/**
 * `sequence` drawn by the composer: `{ d, cut, slots, stroke, parts, origins, kanjivg, approximate }`,
 * `d` the SVG path of its outlines in a 1000-unit box (y down, nonzero fill), `cut` the path of what
 * ㇯ takes away (empty when nothing is), `slots` each empty slot (⬚) as `{ index, box }`, numbered in
 * reading order, in the box the layout gave it (as `svgBox` gives it), `stroke` the stroke widths
 * the drawing is weighted to, across x and y, `parts` each drawn part's origin, box, path `d` and
 * whether it is a cut, `origins` where each part came from, `kanjivg` whether a part was cut along
 * KanjiVG's groups or a hand form read from it, and `approximate` the operators it uses that the
 * composer itself does not draw. `exclude` lists characters nothing is taken from, `face` the box a
 * whole character fills without them, and `separate` draws operands as individual pieces where possible,
 * including cuts from a matching whole glyph (falling back to the whole glyph when the operands cannot be drawn).
 * `layout` is `'composed'`, `'cells'`, or `'auto'`: cells lays each leaf out in its own cell and
 * rejects loose marks, while auto uses cells for a description of eight or more leaves that names no
 * character as a whole, since the composer's host cuts then overlap its parts. A cell drawing has
 * `cells: true` and its parts' `origin` reads `cells <char>`.
 * Throws LookupError when a part can be drawn no way or the sequence is larger than `LIMITS`.
 */
export declare function compose(source: any, sequence: any, { exclude, face, separate, fontStyle, layout, keepBars }?: {
    exclude?: never[] | undefined;
    face?: null | undefined;
    fontStyle?: string | undefined;
    keepBars?: boolean | undefined;
    layout?: string | undefined;
    separate?: boolean | undefined;
}): Promise<{
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
