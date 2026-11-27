import { raster } from './geometry.js';
export declare class LookupError extends Error {
    name: string;
}
/** Share of a donor's overlap a nested stack closes by: at the root the seam closes fully, inside
 *  another node that same overlap crowds what it sits under (⿱一𧘇 under 罒 in ⿱宀⿳罒一𧘇). */
export declare const CLOSED_NESTED = 0.45;
/** `⿰亻⿱亠女` as ['⿰', '亻', ['⿱', '亠', '女']], each operator taking `arity(op)` operands.
 * An operator's zi.tools modifier is retained as the array's `note`. */
export declare function parseTree(sequence: any, arity: any, render?: boolean): any;
/** The text of each leaf of a tree in reading order, an empty slot as ⬚. @param {any} node @returns {string[]} */
export declare function leafTexts(node: any): string[];
/** A node written out again as a sequence, including crossing constraints. */
export declare const keyOf: (node: any) => string;
/** Rebuild operands without losing their operator's crossing constraint. */
export declare const mapOperands: (node: any, visit: any) => any[] & ({
    note: any;
} | {
    note?: undefined;
});
/** An empty slot, as the editor writes it (EMPTY in ids-input's core). The composer lays a tree with empty
 *  slots out as it would a whole one, each empty slot an operand it knows nothing of (the layout
 *  reads its place's defaults, its ink is the unknown operand's), and draws no ink there: the slot
 *  becomes a placeholder in the box its node gave it. han-compose itself draws no empty slots. */
export declare const EMPTY = "\u2B1A";
/** Whether a node is an empty slot, numbered in reading order (`⬚0`, `⬚1`, …) by `compose`. */
export declare const isEmpty: (node: any) => boolean;
/** The operators this port draws beyond the composer's, with rooms and turns of its own choosing: a
 *  preview using them is approximate, and no stored drawing has them. */
export declare const APPROXIMATE: string[];
/** The operators whose result no design can be checked against: a subtraction, an overlay, a
 *  mirrored or turned form, and the two enclosures that crush what they hold. A character built from
 *  one of these is only a guess, so a description carrying any of them is not composed at all.
 *  Repeated characters where the drawing is unreviewable; the rest the layout places predictably. */
export declare const UNPREDICTABLE: string[];
/** Whether `description` may be composed. The description is flat text, so this covers every layer
 *  without walking the tree. @param {string} description */
export declare const composableDescription: (description: string) => boolean;
/** The character whose designed glyph `sequence` is partitioned from, for a caller that must load
 *  its record before sketching. @param {string} sequence */
export declare const leafCutChar: (sequence: string) => any;
/** Donor records needed by both the drawing and its leaf boxes, including a nested enclosure. */
export declare const wheatFaceHosts: (sequence: any) => string[];
/** Characters whose glyphs the tree's designed cuts are read from; the loader preloads them. */
export declare const designedSources: (tree: any, style?: string) => any[];
export declare class Composer {
    data: any;
    C: any;
    exclude: Set<any>;
    _forced: Map<any, any>;
    spelled: Set<any>;
    AXIS: any;
    ENCLOSE: any;
    INSIDE: any;
    SLOTS: any;
    face: any;
    separate: boolean;
    fontStyle: string;
    keepBars: boolean;
    hosted: boolean;
    weighted: any;
    staticFace: boolean;
    stem0: any;
    arities: Map<any, any>;
    crossingCache: Map<any, any>;
    expanding: Set<any>;
    beside: WeakSet<WeakKey>;
    approximate: Set<any>;
    coverCache: Map<any, any>;
    missingGlyphs: Set<any>;
    pyramids: WeakMap<WeakKey, any>;
    bases: WeakMap<WeakKey, any>;
    nativeEnclosures: Set<any>;
    normalizer: {
        resolve: (node: import("./normalization.js").RenderNode) => import("./normalization.js").RenderPlan;
    };
    resolutions: Map<any, any>;
    chains: Map<any, any>;
    joints: any[];
    sweeps: any[];
    /** How much smaller than it was laid out the character is drawn, beside marks that take a margin. */
    carried: number;
    handForms: boolean | undefined;
    stroke: any[] | undefined;
    /**
     * `data`: `{ manifest, layout, rec(key), hosts(key, place), places(key), identity?(key), kin?() }`; `exclude`: characters nothing is taken from (a
     * character redrawn to test, with its twins); `face`: the box a whole character fills, when those
     * characters change it (the manifest's is the median of `FULL` with none excluded); `separate`:
     * draw operands as individual pieces where possible, including cuts from a matching whole glyph,
     * so a view that changes one part can address its leaf.
     */
    constructor(data: any, { exclude, face, separate, fontStyle, keepBars }?: {
        exclude?: never[] | undefined;
        face?: null | undefined;
        fontStyle?: string | undefined;
        keepBars?: boolean | undefined;
        separate?: boolean | undefined;
    });
    arity: (ch: any) => any;
    parse: (sequence: any) => any;
    rec: (key: any) => any;
    /**
     * The record of a character under a variation selector: its own outline, laid out as its base is.
     * The export records a variation sequence's outline alone, so what the layout reads of it (its
     * features, its usual boxes, its places) is the base's. Null where the font draws no such sequence
     * or the export records a layout of its own for it.
     */
    variantRecord(key: any): any;
    /** A component form's record, which stands in for the export's; a native form's does only where
     *  the export records nothing. */
    formRecord: (key: any) => any;
    /** What a description's identity is found by: a key's sequence (`s`) and the character it
     *  describes (`e`). A store with an identity table answers from it; without one, and for a
     *  component form, the key's record does. */
    identity: (key: any) => any;
    /** The learned layout. A store reads it when a node first asks, so a lone character is drawn without it. */
    get layout(): any;
    excluded: (ch: any) => boolean;
    /** Whether a node holds a component whose form must replace its encoded outline, at any depth. */
    forced: (node: any, seen?: Set<any>) => any;
    slot: (op: any, i: any) => any;
    /**
     * The pyramid a node draws as, remembered for this drawing. A two-layer pyramid of one part keeps
     * the composer's designed forms for it (品, 森); a description or a slot has no designed form, so
     * its equal cells are the drawing, and every deeper pyramid draws in its cells.
     */
    pyramid(node: any): any;
    /**
     * The pyramid standing on a base that a node draws as, remembered for this drawing: rows of 1, 2,
     * … cells with one part under them, however the stack groups the rows. The rows are the drawing,
     * so a 品-shaped top spreads over the width in flat cells rather than stacking square ones.
     */
    pyramidWithBase(node: any): any;
    /**
     * The parts of a pyramid standing on a base: its cells in the top `layers` of `layers + 1` rows,
     * the base across the rest. The cells spread over the full width, so each is wider than it is
     * tall; the base is drawn as a cell too, so a 木 under a 品 spans the width instead of standing
     * thin in the middle of it. A pyramid of empty slots numbers its cells in reading order, as one
     * drawn alone does.
     */
    baseParts({ cell, layers, base }: {
        base: any;
        cell: any;
        layers: any;
    }, region: any): any[];
    /**
     * The base of a pyramid, drawn as a cell: a plain component fits its box with the wider stretch
     * a cell allows, so a wide, short base row fills its width. Anything else is drawn as usual.
     * @param {any} base @param {number[]} region */
    basePart(base: any, region: number[]): any;
    glyphRecord(ch: any): any;
    /** A forced component replaced in the native glyph: the glyph without the component's outlines,
     *  and the form placed where they were. The rest of the glyph keeps its own design and weight. */
    replaceGlyph(native: any, char: any, tree?: null): any[];
    glyph(ch: any): any;
    /** The glyph a whole character is drawn with: a body the font drew as another shape is replaced
     *  by `BODY_FORMS` where the export carries the glyph that cut was made for. A cut of the glyph
     *  (`pieceOf`) keeps the font's own contours. */
    drawnGlyph(ch: any, contain?: boolean): any;
    /** A piece drawn for `key`, a glyph or a host cut, with the bar rule of `CONTAINED_MIDDLE_BARS`
     *  applied. */
    pieceFor(key: any, piece: any): any;
    /** Whether the variable font draws `ch`: its strokes can be weighted. */
    own(ch: any): boolean;
    /** A source occurrence's rendering identity. A composer is recreated after each loading pass. */
    resolution(node: any): any;
    /** Shared lookup key and metrics for descriptions that name the same form. */
    renderKey(node: any): any;
    /** The encoded glyph supported by the description's normalization evidence. */
    bySequence(key: any): any;
    sequenceOf(ch: any): any;
    atomic(ch: any): boolean;
    /** Outline length: a glyph's, or for an excluded or glyphless character its sequence's operands'. */
    ink(node: any, seen?: Set<any>): any;
    /** Permitted outline count; zero when an operand is unknown. */
    outlines(node: any, seen?: Set<any>): any;
    /** Whether a compound operand has no permitted glyph encoding. */
    unknown(node: any): boolean;
    /** An unreadable linear compound, optionally expanding along a particular axis. */
    unknownAligned(node: any, axis?: null): boolean;
    /** The most strokes a line along `axis` crosses in an operand: down a column for a stack, along a
     *  row for a row, counted on its glyph at 64 px. A sequence with no glyph to read adds its
     *  operands' along that axis, and takes the most of operands side by side across it; an enclosed
     *  or overlaid part adds to its enclosing one. Unknown analyses count as 永. */
    crossings(node: any, axis: any, seen?: Set<any>): any;
    /** The shares of a row or stack: `SHARES_OLD` at the root and wherever its operands are readable,
     *  the crossed shares of `SHARES` for a nested unreadable linear compound. An export from before
     *  the crossed shares keeps the old pair in `SHARES`. */
    sharesOf(op: any, children: any, axis: any, atRoot: any): {
        power: any;
        crossed: any;
        middle: any;
        gap: any;
    };
    /** Whether a sequence names a bare stroke among its operands. */
    stroked(node: any): any;
    place(part: any, target: any, native: any, origin: any): {
        part: any;
        source: any;
        target: any;
        weight: number[];
        native: any;
        origin: any;
    };
    /** A stroke chain (`#(-𠃌㇉)`) joined from the face's own strokes, or null for anything else. */
    chainStroke(ch: any): any;
    recordedParts(node: any, region: any, key: any): {
        part: any;
        source: any;
        target: any;
        weight: number[];
        native: any;
        origin: any;
    }[] | null;
    chain(node: any): any;
    chainParts(node: any, region: any, atRoot?: boolean): any;
    /** A chain holding a part, or such an enclosure holding another (岛 as ⿹⿴#(-𠃌㇉)丶山): each inner
     *  part goes into the cell of the chain its operator names. Null for any other enclosure. */
    chainEnclosure(node: any, region: any): any;
    /** The parts drawing `sequence`, weighted, and the loose `marks` its text carries after it. */
    compose(sequence: any, marks?: string): any;
    /** Whether `tree` is drawn in cells (`compose`'s `layout: 'auto'`): no character spells it as a
     *  whole, it has at least `CELL_LEAVES` leaves, every leaf is a glyph or an empty slot, and every
     *  node is an axis or an enclosure this layout splits without approximation. A description this
     *  dense has no designed host forms; drawn in place, its parts overlap each other. */
    cellsFor(tree: any, marks?: string): boolean;
    /** The parts of `tree` drawn in cells: one glyph (or empty slot) per leaf, in a cell its operator
     *  gives it. An alignment axis below the top shares its cells by the ink of its parts, or by leaf
     *  count when it holds an empty slot; an enclosure always shares by leaf count. Parts keep the
     *  tree's reading order on an axis chosen for the cell's shape, so no cell overlaps another.
     *  `region` is the box the grid fills (the frame's opening for an inner grid); a grid drawn as
     *  part of a larger drawing passes `leafIndices: false`, since its leaves are not its own. */
    cellLayout(tree: any, region?: any, { leafIndices }?: {
        leafIndices?: boolean | undefined;
    }): any[];
    /**
     * Where each leaf of `sequence` goes before anything of it is drawn, from the layout alone: the
     * learned boxes where the composer would ask the network (reading whatever records are loaded, a
     * place's defaults for the rest), even shares of the axis elsewhere, and for an enclosure the
     * region and its `INSIDE`. Answers `{ index, box, empty }` per leaf in reading order, boxes in
     * font units, y up.
     */
    sketch(sequence: any, marks?: string): any;
    /** The face a character takes beside its outbound marks: the whole face where none needs room. @param {string} marks */
    faceBeside(marks: string): any;
    /** The leaves of `sequence` laid out in the current face. */
    sketched(sequence: any): any;
    /** An empty slot's placeholder: no ink, in the box its node gives it, with the slot's number. */
    placeholder(node: any, region: any): {
        part: any;
        source: any;
        target: any;
        weight: number[];
        native: any;
        origin: any;
        empty: number;
    };
    /** Preferred host keys depend on rendering identity, independently of the input spelling. */
    alternatives(node: any, place: any): any[];
    /** The host pieces of `written` in `place`; with `uncut`, also the entries the export lists without
     *  a piece, which the composer weighs before finding it cannot cut them. */
    hostsOf(written: any, place: any, uncut?: boolean): any;
    /** Whether the export lists a host for a node's operands in their places. An export that names
     *  its host places (`files.hosts.places`) can carry some operands only; a node without a list
     *  takes the plain shares. An export without the list is taken to cover what it carries. */
    hasHosts(op: any, children: any): any;
    /** What a host entry's cut is known by before its outlines are read: its box and its contour
     *  count; null for an entry the composer could not cut. An entry carries its piece's outlines
     *  (`p`), or the indices of the host glyph's contours it keeps (`k`). */
    cutOf(h: any): {
        box: any;
        count: any;
    } | null;
    /** A host entry's piece: its own outlines, or the contours it keeps of its host's glyph, read from
     *  the host's record when the piece is chosen. */
    pieceOf(h: any): any;
    /** A ranked host as the callers take it: the entry, and its piece read when first asked for. */
    chosen(h: any): {
        record: any;
        readonly piece: any;
    };
    /** The parts drawing `node` in `region`, with the correction its description carries, where the
     *  component is one the font cuts wrong (`COMPONENT_FIXES`). */
    node(node: any, region: any, atRoot?: boolean, sideBySide?: boolean): any;
    /** The parts a nested construct draws `node` with in `region`: null for a description that is no
     *  such construct, and for one left to the composer, where a glyph it is drawn from is excluded or
     *  missing or the export draws another. */
    constructed(node: any, region: any, atRoot?: boolean): any[] | null;
    fitMetricKeInterior(parts: any, tree: any): void;
    /** A narrow borrowed cut of 口 or 日 may have been stretched already. Use
     * the leaf's native proportions when fitting it in the space taken by 百. */
    baiSeat(inner: any, room: any): any[] | null;
    /** The right-side 口 of TW-Kai 加 is slightly taller than wide. */
    baiMouth(inner: any, target: any): {
        part: any;
        source: any;
        target: any;
        weight: number[];
        native: any;
        origin: any;
    } | null;
    counterInFrame(node: any, region: any, nested: any): {
        part: any;
        source: any;
        target: any;
        weight: number[];
        native: any;
        origin: any;
    }[] | null;
    /** The enclosed form of 首 keeps its native head, shoulder and eye together. */
    enclosedShou(): {
        part: {
            contours: any[];
            box: number[];
        };
        heightShare: number;
    } | null;
    /** Select a verified low hook only after the face's contextual forms have had priority. */
    hookFrame(node: any, region: any, atRoot: any): {
        parts: {
            part: any;
            source: any;
            target: any;
            weight: number[];
            native: any;
            origin: any;
            fixed: boolean;
        }[];
        room: any[];
        previous: any[];
        counterFit: {
            part: {
                contours: any[];
                box: number[];
            };
            source: number[];
            origin: string;
        };
    } | {
        parts: {
            part: any;
            source: any;
            target: any;
            weight: number[];
            native: any;
            origin: any;
            fixed: boolean;
        }[];
        room: any[];
        previous: any[];
        counterFit: {
            part: {
                contours: any[];
                box: number[];
            };
            source: any[];
            factor: number;
        };
    } | {
        previous?: undefined;
        counterFit?: undefined;
        parts: {
            part: any;
            source: any;
            target: any;
            weight: number[];
            native: any;
            origin: any;
            fixed: boolean;
        }[];
        room: any[];
    } | null;
    /** Keep the established root ink extent, including overshoot after stroke weighting.
     * A fresh composer isolates the ordinary layout's joints and weight adjustments.
     * The result is local to this loader pass, since more source shards can arrive. */
    hookInkBounds(node: any): any;
    /** Place the enclosing strokes and map their opening into the same cell. */
    lowerLeftFrame(node: any, region: any, counterEntry?: null): {
        frame: {
            part: any;
            source: any;
            target: any;
            weight: number[];
            native: any;
            origin: any;
        };
        room: any[];
    } | null;
    /** Reuse the 木 and the opening from the manuscript form. The dot in 术 sits
     * beside an ordinary 木 and keeps the export's existing glyph or layout. */
    woodFrame(node: any, region: any): {
        frame: any;
        room: any[];
    } | null;
    /** Three native cuts for the described wheat enclosure. 麺 supplies the frame and right-hand 面,
     *  榛 the narrow 𡗗. The sweep is 处’s in Zhuque and 麵’s in TW-Kai. */
    wheatFaceParts(node: any, region: any): any[] | null;
    /** R+06D8, 出土文獻與古文字教程 p. 15. The two sides of 棘 flank a shorter 企. */
    thornRowParts(node: any, region: any): {
        part: any;
        source: any;
        target: any;
        weight: number[];
        native: any;
        origin: any;
        fixed: boolean;
    }[] | null;
    /** Fit the two editable operands in the opening of the face's own む. */
    muKoParts(node: any, region: any): {
        part: any;
        source: any;
        target: any;
        weight: number[];
        native: any;
        origin: any;
        fixed: boolean;
    }[] | null;
    diamondSyllable(node: any, region: any): {
        part: any;
        source: any;
        target: any;
        weight: number[];
        native: any;
        origin: any;
        fixed: boolean;
    }[] | null;
    /** Keep each copy of a repeated glyph at the same size across both rows. */
    penGrid(node: any, region: any, atRoot: any): any[] | null;
    /** Preserve the weight of the encoded pyramid when extracting its six editable leaves. */
    yuanParts(node: any, region: any): {
        part: any;
        source: any;
        target: any;
        weight: number[];
        native: any;
        origin: any;
    }[] | null;
    /** The six vessel variants share the native drawing inside each ordinary stack’s ink bounds. */
    qiParts(node: any, region: any): {
        part: any;
        source: any;
        target: any;
        weight: number[];
        native: any;
        origin: any;
        fixed: boolean;
    }[] | null;
    drawNode(node: any, region: any, atRoot?: boolean, sideBySide?: boolean): any;
    /** The letters of one Bopomofo syllable stacked in the block, centered and separated by a small
     *  gap. The letters come from the bundled Bopomofo outlines; without this a three-letter spelling
     *  shares by ink and the ㄙ, ㄨ and ㄥ fill the cell unevenly.
     *  @param {(string | any[])[]} children @param {number[]} region */
    bopomofoBlock(children: (string | any[])[], region: number[]): any[];
    /** Two syllables in one block, set at the split the manuscript's blocks keep: the upper takes
     *  the top 54%, the lower the rest, and the lower reaches a little into the upper's band so the
     *  pair closes up rather than standing apart as two characters. @param {(string | any[])[]} children @param {number[]} region */
    hangulBlock(children: (string | any[])[], region: number[]): any[];
    /** A run of conjoining jamo that no glyph spells, stood in its syllable's 配置: the initial
     *  above a horizontal vowel or beside a vertical one, the final below, and the 아래아 a dot of
     *  its own under the initial. Every letter is drawn from its own outline, so the run carries the
     *  drawing's ink and weight like any other component.
     *  @param {string} run @param {number[]} region */
    runLeaf(run: string, region: number[]): any;
    /** A syllable carrying tone marks: it keeps only the part of the box the marks leave free, at the
     *  right, and the marks stand at the left as the tone of the syllable is written.
     *  @param {string} base @param {string} tones @param {number[]} region */
    toneLeaf(base: string, tones: string, region: number[], cell?: boolean): any[];
    /** The brush exports have no 𮇇. The two upper strokes of their own 米
     * sit on either side of the tall stem of their enclosing 木. */
    brushRiceFrame(rice: any, [left, right]: [any, any]): {
        record: {
            h: string;
        };
        piece: any;
    } | null;
    /** A designed enclosing form of a whole operand, where the export has no cut of it: 电 as ⿺'s
     *  enclosing part from 𫌷. Answers a host-like `{ record, piece }`, or null. */
    enclosureForm(op: any, node: any, counterEntry?: null): {
        record: {
            h: string;
        };
        piece: any;
    } | {
        record: {
            h: any;
        };
        piece: {
            contours: any[];
            box: number[];
        };
    } | null;
    /** Intersect a donor's interior with the ink-free space above its foot.
     * A rectangular replacement fills corners the original inner glyph left open. */
    clearLowerLeftRoom(piece: any, char: any): any;
    /** The kin an enclosing part is drawn as (`_kin`): of the characters written over the same lower
     *  part that many hold in that place (走 for 足, 麥 for ⿱𡗗夂), the one with most hosts there, as
     *  `{ char, own }` with the outer's own tree; null when the outer is written otherwise, has no such
     *  kin, or the export has no kin table (`data.kin`). */
    kin(op: any, outer: any): {
        char: any;
        own: any[];
    } | null;
    /** An enclosing part drawn as its kin's (`_kin_outer`): 足 round 羽 in 䟳 as 走's sweep, cut from a
     *  host, under 口 in 土's place; ⿱𡗗夂 round 面 as 麥's sweep, under 𡗗 in 來's place. Null when
     *  no host cuts. */
    kinOuter(op: any, outer: any, kin: any, inner: any, box: any, innerBox: any): any[] | null;
    /** An upper part drawn into a kin's upper room, its foot lowered as far as it stands short of the
     *  lower part where the kin's own upper part stands (`_settled`): 𡗗's 人 ends above 夊 where 來's
     *  legs reach into it in 麥. Each part's own gap counts, so a part ending lower than its
     *  neighbours is not lowered into the sweep by their median. Its proportions stay within `STRETCH`.
     *  The parts move in place, so a joint or sweep recorded on them follows. */
    settle(upper: any, kinTop: any, lower: any): void;
    /** The upper part of an enclosing character written over a lower part (`_upper`), as the first
     *  character holding it on the left draws it, narrow as it stands over a sweep (⻊'s 口), cut along
     *  KanjiVG: `{ part, source }`, or null. */
    upperOf(outer: any): any;
    /** Seat the inner group where the designed character sets its own: ⿺爪口's 口 in 巴's place in
     *  爬, so the inner part keeps clear of the sweep. */
    seatInDesignedFrame(op: any, children: any, groups: any): void;
    /** The designed tail of `node`'s pressed enclosure, or null where the face draws none. */
    tailForm(node: any): {
        contours: any[];
        box: number[];
    } | null;
    /** Preserve the font's designed shape while retaining one adjustable piece per leaf. */
    enclosureParts(node: any, region: any): any;
    /** The leaf boxes of a partitioned designed glyph, in the sketch's own units, so a document view
     *  frames each piece by the box the drawing gives it. */
    leafCutSketch(sequence: any): any;
    /** The designed glyph of a description whose operands interlock, partitioned one piece per leaf;
     *  a face the partition does not name draws the whole glyph, which still reads as the character. */
    leafParts(node: any, region: any): any;
    /** The font's designed glyph of a description written with a variant component, partitioned one
     *  piece per leaf. The export has no cut for it: the operands' strokes overlap, so the parts do
     *  not separate into contours the way a host cut expects. */
    variantParts(node: any, region: any): any;
    /** Place an arbitrary inner operand in the room designed for these native enclosures. */
    yanStackedDays(outer: any, contents: any): "" | boolean | undefined;
    /** Any ⿸ whose contents begin ⿱儿: the native legs join the enclosing bar. */
    legEnclosure(children: any, region: any): any[] | null;
    /**
     * ⿸ whose upper-left operand is a bare stroke no character is described with there (丿, 丶, 丨).
     * Such a stroke's glyph runs across the whole face and encloses nothing, so the layout a real
     * enclosure gets sets it over the cell and its operand wherever the stroke leaves room. Here the
     * stroke goes to the upper left and the operand, drawn smaller, to the lower right.
     * @param {(string | any[])[]} children @param {number[]} region
     */
    strokeEnclosure(children: (string | any[])[], region: number[]): any;
    /**
     * A falling stroke at the upper left, as 久, 夂 and 𫝄 draw it: the face's own such stroke,
     * falling from the top of the cell down the left side of the part at the lower right. Where the
     * part's top edge starts as a bar (ス, 口, 日, a frame) the stroke runs through that corner.
     * @param {string} outer @param {any} glyph The stroke's own glyph.
     * @param {string | any[]} inner @param {number[]} region
     * @param {(room: number[]) => number[]} held
     */
    fallingEnclosure(outer: string, glyph: any, inner: string | any[], region: number[], held: (room: number[]) => number[]): any;
    /** The stroke this face draws by itself in one of the donors, as [donor, piece]: a donor's
     *  stroke that is an outline of its own.
     *  @param {(string | number)[][]} donors Each a character and its stroke's number. */
    strokeOf(donors: (string | number)[][]): (string | number | {
        contours: any[];
        box: number[];
    })[] | null;
    yanEnclosure(children: any, region: any): any[] | null;
    leafOwners(tree: any): {
        owners: any;
        split: boolean;
    } | null;
    /** Two identical reflections or half-turns restore the subtree, before lookup and layout. */
    cancelTransforms(node: any): any;
    /** The same yan enclosure can put its contents inside 厂 before grouping the upper strokes. */
    normalizeYan(node: any): any;
    /** Whole-character lookup for attested overlays; nested editing keeps its leaves. */
    standaloneExpandedOverlay(node: any): any;
    /** Whole-character lookup for attested expanded pyramid-glyphs; nested editing keeps its leaves. */
    standalonePyramid(node: any): string | null;
    /** A complete attested grid uses its designed glyph, including separated previews. */
    standaloneRepeatedGrid(node: any): string | null;
    /** Canonicalize attested grids before lookup; preserve the editor's tree and leaf order. */
    normalizeRepeatedGrids(node: any): any;
    repeatedGrid(node: any): {
        tree: (string | string[])[];
        order: number[];
    } | null;
    /** These host aliases use their expanded form for glyph lookup and parent layout features. */
    requestedEnclosure(node: any): {
        tree: (string | any[])[];
        innerIndex: number;
    } | null;
    /** A flat stack or row holding a pair the faces draw as one prepared form takes that pair as one
     *  operand: ⿳八⿻王丷X draws 金 with its roof opened into 八 (the form ⿱八⿻王丷) over X. A
     *  sequence that is itself a form or an encoded character keeps its own drawing. Leaf order is
     *  unchanged, so editable leaf indices still hold. */
    normalizeFormRuns(node: any): any;
    /** Normalize the rendering tree only; the source tree still owns editable leaf indices. */
    normalizeRequestedEnclosures(node: any): any;
    /** Layout and first inner leaf for two-part descriptions with a disconnected outer part. */
    splitEnclosure(node: any): {
        tree: any[];
        innerIndex: number;
    } | null;
    /**
     * How often the export cut `key` out of a character as one body, by its own key and by the name
     * of the character that spells it. Cuts on the left or the top are not counted, as `instance`
     * cannot use them, nor is the spelling character's own glyph: that a pair is a character of its
     * own (沐 for 氵木) says nothing about whether a font sets it as one body inside a wider one.
     */
    bodySupport(key: any): any;
    /** A bare bar: one contour, far wider than it is tall. A stack's bar spans the whole character
     *  (the 一 of 寅, the base 一 of 𡩬), so it belongs to no narrower body inside it. */
    isBar(node: any): boolean;
    /**
     * A flat stack holding a run the export cuts as one body (亠厶 of ⿳亠厶十, the 𠫓 of 充 and 育),
     * regrouped so that run is one operand. The run then shares the stack as one body and divides its
     * own row, instead of each of the three operands taking a third of the stack and the body's two
     * halves standing as far apart as the operand beside them. Answers the rewritten node, or null
     * where no run is more of a body than the whole stack.
     */
    groupedStack(node: any): any[] | null;
    /** Rendering rewrites for split enclosures and compound corners (原 in 愿). */
    respelled(node: any): any;
    /** Whether `node` is a row (⿰ or ⿲) writing an enclosing description. Such a row keeps the row's
     *  layout: the enclosure takes its share of the cell and frames what it holds there, and the
     *  other operand keeps its own column. A host's piece is a whole row in the donor's proportions,
     *  which give the enclosure the donor's frame and the partner the donor's column. */
    rowHoldsEnclosure(node: any): boolean;
    /** Whether a host cut would replace a row that writes an enclosing description, or the enclosing
     *  description written in that row. */
    keepsRowLayout(op: any, node: any): boolean;
    /** A row writing an enclosing description laid out where a donor drew the same row: the donor's
     *  row frame gives the row's width, its cuts give each operand's share, and each operand is drawn
     *  from its own description. The rows the learned boxes would draw for such a description are the
     *  export's defaults (it has no glyph shape to read), which give the enclosure more of the cell
     *  than the font gives it beside its partner. Falls back when no one donor holds every operand. */
    enclosureRow(op: any, children: any, region: any): any;
    /** The drawn part closest to what `node` needs at `index` of `op` inside `box`, as [record, piece]. */
    host(op: any, index: any, node: any, siblings: any, box: any, isPlaced?: boolean): any;
    /** A designed left form from a character's glyph, for a component whose host cuts the export lacks. */
    designedCut(node: any, cutsByPart?: {
        氵: (string | {
            '345749510c894ac303898cacbbd71bc35880cb6179990632d00b1ffe463f2d71': number[];
        })[];
        䒑: (string | {
            '56b0a45b06ac33ea462799b1ba3cc806f464d5a09236012da3ed1616e523aef2': number[];
        })[];
        𦉪: (string | {
            de5606e4968f68067080c0219e1634cc3622f007c35c8936df34e55186b7f88f: number[];
        })[];
    }): {
        record: {
            h: any;
        };
        piece: {
            contours: any[];
            box: number[];
        };
    } | null;
    /** Whether the export carries the left column's 身, cut from 射, 躬 or 躭. */
    hasLeftBody(node: any, place?: string): boolean;
    ranked(op: any, index: any, node: any, siblings: any, box: any, isPlaced?: boolean): any;
    /** A fallback cut with a detached bar the native cuts lack is left out (`_native_shapes`). */
    nativeShapes(ranked: any): any;
    /** Both operands' boxes in the em, as the learned layout sets them. A construct that is drawn has
     *  no character of its own, and is read as the character it is a shape of (`like`). */
    predict(op: any, children: any): number[][];
    /**
     * The description of a character the font draws as a rectangular grid of parts: a stack of rows,
     * each a row of the same length, as 㸚 is ⿱⿰㐅㐅⿰㐅乂. A designer may draw one row of such a grid
     * smaller than another, and inside a frame that reads as two rows out of balance; drawing the
     * description gives every row its own cell.
     * @param {any} node @returns {any[] | null}
     */
    gridTree(node: any): any[] | null;
    /**
     * A frame the font draws as a left half and a right half cut down the middle: each half takes a
     * side of the cell and the enclosed part takes the space between them.
     * @param {any} glyph @param {string} char @param {number[]} region @returns {any[] | null}
     */
    frameHalves(glyph: any, char: string, region: number[]): any[] | null;
    /** A frame drawn as two halves with its inner part between them (𦥑 in ⿴𦥑囟 reads as ⿲), or
     *  null for any other enclosure. */
    splitFrame(op: any, children: any, region: any): any[] | null;
    /** Whether `op` over `children` is a frame `splitFrame` draws as two halves. */
    splitsFrame(op: any, children: any): boolean;
    /** The boxes the learned layout gives a node's operands (`_learned_boxes`), carried into `region`
     *  when nested; null when one has no extent. */
    learnedBoxes(op: any, children: any, region: any): number[][] | null;
    learned(op: any, children: any, region: any, ownParts?: boolean): any;
    /** A whole character's operands each taken unscaled from where a designer put them (`_transplant`). */
    transplant(op: any, children: any): any;
    /** The box a short two-part stack takes at the top of a tall column (`SHORT_STACK_PART`,
     *  `SHORT_STACK`), leaving the rest of the column empty; null for a stack that fills its column.
     *  The stack is drawn in the top `SHORT_STACK` of the column, where the layout gives its parts
     *  room, rather than stretched down the whole column. */
    shortStackBox(node: any, box: any): any[] | null;
    /** The lower part of a short stack (`shortStackBox`) drawn `SHORT_STACK_GAP` of the column's
     *  height under the upper one. The layout spaces the two over a full column, so the gap has to
     *  close with them at the top, and the stack's own pair opens to the gap 徵 sets. */
    closeShortStack(parts: any, column: any): void;
    /** The enclosing operand as `shares` draws it over `region`: its designed form where it has one,
     *  its own drawing otherwise. */
    enclosing(op: any, children: any, region: any): any;
    /** A glyph round the lower left of another part, pressed left and its foot drawn out under that
     *  part from the box the layout gives it: the swept pieces and that box mapped into `region`.
     *  Null where `outer` is no single glyph, the layout places nothing, or the glyph has no foot to
     *  sweep. */
    sweptUnder(children: any, outer: any, region: any): {
        swept: any[];
        held: any[];
    } | null;
    /** Operands sharing the region along an aligned operator by `SHARES`; an enclosed one in the room its
     *  enclosing part leaves. */
    shares(op: any, children: any, region: any, atRoot?: boolean): any;
    /** `child` drawn into `box` as one of the aligned operands of a row; in a narrow row
     *  (`narrowRow`) it fills its cell (`fillCell`). */
    row(child: any, box: any, narrow: any, sideBySide: any, pair?: boolean): any;
    /** Whether the cells of the aligned operands `children` are as narrow as a row of three's: three
     *  operands, or a pair written as an operand of a row along its own axis (the four columns of
     *  ⿰⿰週末⿰農場). A pair in a stack beside a row, or in the room of an enclosure, is neither. */
    narrowRow(children: any): boolean;
    /** What `node` drew for `child` in a narrow row's cell, filling the cell: a whole glyph may
     *  change its proportions up to `ROW_STRETCH`. A character is drawn from its description where
     *  the cell would squeeze its glyph; in a pair beside another part, when those parts cover under
     *  `CELL_FILLED` of the cell (辶 under 周 in a quarter column, 曲 and 辰 apart in theirs), the glyph
     *  fills it after all, so one column of the row is not smaller than the next. */
    fillCell(child: any, group: any, box: any, pair?: boolean): any;
    /** A whole glyph a stack's middle band cannot compress: bars and covers (一, 冖, 丷) lie flat
     *  enough to be one, a full character such as 六 or 水 does not. */
    middleWhole(child: any): boolean;
    /** A sequence drawn whole somewhere in the font, in any place but the left or the top (`_instance`). */
    instance(node: any, region: any): {
        part: any;
        source: any;
        target: any;
        weight: number[];
        native: any;
        origin: any;
    } | null;
    /** Overlays the export holds both pieces of, sharing an operand of comparable ink. */
    overlayTeachers(children: any): {
        ch: any;
        pieces: any[];
        written: any[];
        frame: any;
    }[];
    /** An overlay drawn whole in another character, where KanjiVG groups exactly its components and
     *  draws its two operands across each other (`kanjivg_cuts.groups_like`): the top of 脊 in 鶺 for
     *  ⿻人⿰二二, 束 in 整 for ⿻木口. The export lists such groups under `OVERLAY_GROUPS` by their
     *  components, sorted and joined; a group whose operands do not cross is a stack or a row of
     *  them (呆 for ⿻木口) and is passed over. The one needing the least stretch is taken, if within
     *  `STRETCH`. Null where the export lists none.
     *  @param {(string | any[])[]} children @param {number[]} region */
    overlayGroup(children: (string | any[])[], region: number[]): {
        part: any;
        source: any;
        target: any;
        weight: number[];
        native: any;
        origin: any;
    } | null;
    /** Operands drawn across each other (⿻): whole from a character that draws them so
     *  (`overlayGroup`), else where characters overlaying like operands put them. */
    overlay(children: any, region: any): any;
    /** A side-by-side pair in the two cells a stroke down the middle of an opening makes (山's in 幽). */
    cells(op: any, outer: any, region: any, inner: any): any[] | null;
    /** ⿾ its operand mirrored left to right, ⿿ turned half round, about the region's centre. */
    flipped(op: any, child: any, region: any, atRoot: any): any;
    /** ㇯ a character less a component or a stroke KanjiVG names in it (鹿 less 比, 兵 less 丶): its
     *  own glyph without the outlines the export lists for that name (`G.ls`, written by
     *  `kanjivg_cuts.Cutter.taken`), fitted to the region. Null where the export lists none, and
     *  where the drawing is asked for part by part.
     *  @param {(string | any[])[]} children @param {number[]} region */
    less(children: (string | any[])[], region: number[]): {
        part: any;
        source: any;
        target: any;
        weight: number[];
        native: any;
        origin: any;
    }[] | null;
    /** The middle left-falling stroke of 豕 branches from a single contour. Follow its outline
     *  from one junction on the curved spine to the other; the closing segment restores the spine. */
    pigStroke(region: any): ({
        part: any;
        source: any;
        target: any;
        weight: number[];
        native: any;
        origin: any;
    } | {
        part: any;
        source: any;
        target: any;
        weight: number[];
        native: any;
        origin: any;
        cut: boolean;
    })[] | null;
    /** ㇯ the first operand less the second: its own outlines where the export cut them, else the
     *  glyph without what KanjiVG names so (`less`, which knows no index), else what is left of its
     *  description, else the second operand cut out of it. */
    subtracted(node: any, region: any, atRoot: any): any[];
    /**
     * What is left of a character when parts are taken out of it (㇯馬灬, ㇯㇯卿𠂎卩, ㇯[1]王一), drawn from the
     * character's own outlines: each part that stays is the cut the export made of it in that
     * character, set where it lies there. A part that lies inside one of the character's operands
     * is taken out of that operand in the same way, in the operand's place. Where the export has no
     * cut of a part that stays, the glyph without what KanjiVG names so is drawn (`less`), and
     * failing that what is left of the description is composed, the place of each part taken out
     * left empty. Null where the character has no description or does not hold
     * the part.
     * @param {any[]} node @param {number[]} region @param {boolean} [atRoot]
     * @returns {any[] | null}
     */
    remainder(node: any[], region: number[], atRoot?: boolean): any[] | null;
    /**
     * A description with a part written `key` taken out, as [description, whether it was found, how
     * many more to pass]: the parts written `key` are counted in reading order, into the characters
     * that hold one, and the one `skip` of them passes is taken. Its place is left null, and a
     * character that holds it in its own description becomes that character less the part, the
     * index counted inside it.
     * @param {any} tree @param {string} key @param {any} part @param {number} [skip]
     * @returns {[any, boolean, number]}
     */
    without(tree: any, key: string, part: any, skip?: number): [any, boolean, number];
    /** How many parts written `key` a character's description holds, in itself or in an operand's,
     *  a part that is `key` counted once and not looked into. */
    count(ch: any, key: any, depth?: number): any;
    get partial(): boolean;
    fit(outer: any, inner: any, region: any, stem: any, C: any, options: any): boolean;
    collide(outer: any, inner: any, region: any, size: any): number;
    /** The largest empty box inside `region` the placed enclosing part closes on its closed sides,
     *  `ROOM_MARGIN` stroke widths clear of its ink (`_room`). On an open side the box stops at the
     *  part's own ink, so an enclosed part sits between the arms (凵, 門) rather than over their tips. */
    room(op: any, outer: any, region: any, size?: number): any[] | null;
    roomFromInk(op: any, outer: any, region: any, size?: number): any[] | null;
    /** `room` opened out over the sides `op` closes, where it is short of `FIT_FLOOR` of the region: a
     *  part centred in the room alone would sit away from a short arm. */
    held(room: any, op: any, region: any, size?: number): any[];
    /** Whether `ch` is a roof in a ⿵ rather than a frame: the opening its ink closes is narrower
     *  than half its width, as the slot between 入's legs is, so the part below hangs under it rather
     *  than sitting inside. */
    roof(ch: any, region: any): boolean;
    /** A stack's neighbouring operands, remembered so their ink can be settled after weighting. */
    recordJoints(op: any, groups: any): void;
    /** Two stacked operands whose bands share an edge but whose ink, lightened by `balance`, leaves a
     *  seam: raise the lower one until its ink meets the upper's. A gap wider than `FACING` down the
     *  stack is the layout's own, and stays. */
    settleJoints(): void;
    /** A part held over a swept foot is fitted before the drawing is weighted. In a small cell
     *  `balance` thickens both and the clearance closes: where the part's ink then comes within
     *  `ROOM_MARGIN` of a stroke of the swept glyph's, the part is fitted again, no larger than it
     *  stood and inside the box its ink stood in. Its weight is not set again, so a part made smaller here keeps
     *  strokes that much thinner than `balance` gave it. Runs before `settleJoints`, which closes a
     *  stack on the ink this leaves. */
    settleSweeps(): void;
    /** The height a cut keeps in a stack band the layout has no usual box for: the height its own
     *  proportion gives at the band's width, where the band is taller than `HOST_EXTENT` times that;
     *  zero where the band already fits it. */
    cutBand(box: any, source: any): number;
    /** Neighbouring parts moved apart where they face each other closer than `FACING` (`_space`), or,
     *  down a stack, closed on each other where the donor drew them into each other: two cuts from
     *  different glyphs meet where the layout put their boxes, which leaves the seam 芙 has no 夫 for
     *  and the gap below the 一 of ⿱一𧘇. The gap the donor itself drew says which stacks the designer
     *  closed, and the pair is settled one way or the other, never squeezed apart and then drawn back.
     *  A median gap can look clear while one stroke reaches into the other (𠂊's hook into 巾's bar);
     *  where the nearest ink overlaps, the pair is settled by that overlap instead. */
    space(axis: any, groups: any, nested?: boolean): void;
    /** The shallow 𦉪十 under 羔口. In the single-outline faces the frame's two legs
     *  share the lintel and the 十 occupies the full opening below. */
    gaoMouthFoot(box: any, style: any): any;
    /** The parts of each operand, flattened, each part remembering the operand it came from in
     *  `branch`: the index within this node first, then the indices of the nodes below it. A caller
     *  that needs a node's own operands reads `branch[0]` before this runs on the node above. */
    flatten(groups: any): any;
    /** Whether a component is 冖-shaped: a root, or a sequence ending in one. */
    isCover(ch: any, seen?: Set<any>): any;
    /** A roof below a stacked part (冖, 雨) sits on it: the roof's bar is its upper edge, and the part
     *  above rests on the bar, as 學 and 覺 set the 冖 on the 𦥑. Raise the roof where the layout left
     *  a seam narrower than `FACING`; a wider gap is the layout's own. */
    closeUnderCover(op: any, children: any, groups: any): void;
    /** A bar directly under a cover (宀, 冖, 穴, 雨) is drawn at `COVER_BAR` of the cover's width,
     *  centred on it; bars lower in the part and non-cover stacks are left alone. */
    fitUnderCover(op: any, children: any, groups: any): void;
    /** The parts of the child's topmost operand, when the child is a vertical stack drawn as more
     *  than one operand. A child drawn as one piece has no operand to read, and a row (⿰, ⿲) has no
     *  single top. */
    topOperand(child: any, parts: any): any;
    /** Under a cover (宀, 冖) the component the child leads with carries the cover's width, the way
     *  the net 罒 does under the roof of 𡩲 and the block 旧 under the roof of 𭓿: a leading component
     *  with a wide flat top is drawn at `COVER_BAR` of the cover's width, centred on it, keeping the
     *  proportions it was drawn with: it loses as much height as width and stays against the cover.
     *  The rest of the child grows up into the room it gives up, from the child's own foot, so the
     *  stack reaches the cover as it does in the glyph and nothing passes below the child. 穴 and 雨
     *  hang a middle stroke where a component meeting it is drawn as it is. */
    clearUnderCover(op: any, children: any, groups: any): void;
    /** The last operand of the child under a cover closed on to the one above it, where it tapers to
     *  a point at the top, so it tucks under what it meets rather than running into it. The operand is
     *  the one cut the stack placed itself, read from its own stack's gap. */
    hang(rest: any): void;
    /** `below` raised until its top reaches the bottom of `above` by the overlap the donor drew, where
     *  it is a single cut a designer drew overlapping the component above it (`gap` below zero: 夫 as
     *  芙 cuts it, the lower half of 衣 as 袁 does). The overlap a donor records comes from either side,
     *  so a flat-topped operand stays where it is: there the gap is as likely to be a 艹 or a 亠
     *  hanging into the component below it, and raising a bar on to the bar above it welds the two. It
     *  grows no further than `STRETCH` allows: a wide gap is a sign the stack is not the one the donor
     *  drew. Two cuts whose boxes already meet still take the overlap, so a peak that merely touches a
     *  bar above it tucks under it. Answers whether the pair is settled. */
    closed(below: any, above: any, share?: number): boolean;
    /** A cover shortens what it covers, and the designer's own drawing leaves a band of white between
     *  the operands of the stack it holds: the 心 of 𡩬 stands clear of the 皿 under it. A pair drawn
     *  with less than `COVER_CLEAR` of the stack's height between them is drawn back until the band
     *  opens, each operand giving up no more than `COVER_TRIM` of its own height however many of its
     *  neighbours ask. The stack keeps the top and bottom the layout gave it, so only the crowding
     *  goes. Three kinds of pair are left alone: one whose boxes already cross, where there is no
     *  band to open and drawing back would only shrink both; one whose lower operand tapers to a
     *  point — the 八 of 㝙 — which stands clear of the bar above it already; and the pair the join
     *  is about to close. */
    openUnderCover(op: any, children: any, groups: any): void;
    /** A cover's side strokes mark how far what it covers may reach beside them: where the child
     *  rises alongside them — the 爿 of 㝲, the 爪 of 𭓹 — it stays within the cover's own ink. Only
     *  ink that high is measured, so the splayed foot of 木 in 宋 asks for nothing and that drawing
     *  stands; where a child does ask, the whole of it narrows about the cover's middle, foot
     *  included, rather than shearing at the line the measurement was taken on. Covers lower in a
     *  stack hold their children the same way. */
    containUnderCover(op: any, children: any, groups: any): void;
    /** A description often names the halves of one shape apart: the ⿳罒一𧘇 of 𡩲 ends in a 衣 drawn
     *  without its dot, whose middle bar the 一 spells on its own. Where the foot and the bar above it
     *  are one body by `joinedPair`, the foot is drawn over the whole of that bar rather than hung
     *  below it. A flat-topped foot — the base 一 of 𡩬 — keeps the room the stack gave it, so does a
     *  foot its donor drew clear, and so does one hanging from an operand with a body of its own
     *  rather than from a bar. */
    joinUnderCover(op: any, children: any, groups: any): void;
    /** A static face has one weight; a part shrunk into a compound keeps its own and thins. The
     *  export's grown heavy master can lift such a part to the stroke the parts at their own size
     *  draw, so only thinner parts take a weight and none is thinned below the face's 400. */
    staticBalance(group: any): void;
    balance(group: any): void;
}
/** The three bands a three-band stack over a compound foot takes, after the dictionary glyph's 羔
 *  over 口 over 𦉪十: the top 0.64 of the region wide and 0.38 of its height, the mouth 0.30 and
 *  0.15 meeting the top, the foot the same width and the rest. */
export declare function stackBands(region: any): {
    top: any[];
    mouth: any[];
    foot: any[];
};
/** The middle band of a three-band stack, narrowed to `MIDDLE_ACROSS` of the region when it is an
 *  enclosed box; bars and covers own the full width the way the font draws them. */
export declare function narrowMiddleBand(child: any, groups: any, region: any): void;
/** `part` with the middle horizontal of a `CONTAINED_MIDDLE_BARS` character cut back to its right vertical:
 *  the font lets 丑's third stroke run past that vertical, and the textbooks keep it inside. Answers
 *  `part` itself where it holds no separate middle bar and vertical to cut. */
/** Where a 丑's middle bar starts and ends across the glyph, as shares of its ink width: the font
 *  draws it from 222 to 764 in a glyph spanning 62 to 938. */
export declare const BAR_FROM = 0.18;
export declare const BAR_TO = 0.8;
/** How far inside the right vertical's outer edge the bar is cut, as a share of the part's width:
 *  the font ends 丑's bar at 764 with the vertical reaching 783, about 2% of the glyph. */
export declare const BAR_INSET = 0.02;
/**
 * Where the top edge of the placed parts starts, when it starts as a bar (`BAR_BAND` and the
 * constants beside it): the left end of a box's or a frame's top stroke, or of a bar that leads
 * the part. Null for a part led by a stem, a dot or a slanted stroke, and for an edge that starts
 * in the right half.
 * @param {any[]} parts @param {number[]} box
 * @param {number[]} stems The drawing's upright and level stroke widths.
 * @returns {number[] | null} The edge's left end, the bar's top and the top of the corner at that
 *   end, which may stand over the bar, as [x, y, tip].
 */
export declare function topEdgeStart(parts: any[], box: number[], [upright, level]: number[], size?: number): number[] | null;
/** The left and right ends of a placed stroke's ink where it crosses the line `share` of the way
 *  down its box: the box's own sides where the line meets no ink. */
export declare function strokeCross(part: any, share: any, size?: number): any[];
/** The middle of that crossing. */
export declare function strokeMiddle(part: any, share: any, size?: number): number;
/** Whether the inner parts' ink comes within `reach` of the enclosing part's. */
export declare function near(outer: any, inner: any, region: any, reach: any, size?: number): boolean;
/** The share of the inner parts' ink lying on the enclosing part's. */
export declare function collision(outer: any, inner: any, region: any, size?: number): number;
/**
 * The enclosed parts moved and scaled together to the largest size at which their ink fits the
 * enclosing part's opening, clear of its ink by `ROOM_MARGIN` stems, nearest where they stand
 * (`_fit_inside`). Answers whether a placement was found.
 */
export declare function fitInside(outer: any, inner: any, region: any, stem: any, C: any, { size, room, anchor, bounds }?: {
    anchor?: null | undefined;
    bounds?: null | undefined;
    room?: null | undefined;
    size?: number | undefined;
}): boolean;
/**
 * A glyph drawn round the lower left of another part as a designer draws it there (`_swept`): its
 * strokes pressed left of `edge`, the stroke sweeping along its foot drawn out under the other part.
 */
export declare function sweptPart(p: any, edge: any, C: any, tail?: null): any[] | null;
/**
 * A glyph drawn as one outline with its counters (Klee One's 电), pressed as a designer presses a
 * box round another part: the box keeps `share` of the width and the foot is drawn out to the right
 * edge, as Kureedo draws 巴 round 三 in 𠀧 (⿺巴三). Every contour takes the same x map, so the
 * counters stay inside the outline and the box keeps its windows.
 */
export declare function pressedEnclosure(p: any, sweep: any, share?: number, tail?: null): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
} | null;
/** The Möbius map along a pressed enclosure's foot: `s` runs from 0 at the box's right edge to 1 at
 *  the glyph's right, and the stretch starts `FOOT_RATIO` times its mean, easing to the reciprocal
 *  at the tip. */
export declare const footMap: (s: any, ratio?: number) => number;
export { raster };
