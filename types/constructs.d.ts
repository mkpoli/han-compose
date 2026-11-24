/**
 * Constructs drawn only where the description is a surround's enclosing part. `⿳𠂉一乙` is the 气
 * frame of 𣱪 (⿺⿳𠂉一乙票) as a left-bottom surround. The standalone form below uses
 * 气’s first three strokes followed by an actual 乙 closing stroke.
 */
export declare const SURROUND_CONSTRUCTS: {
    '⿳𠂉一乙': {
        host: string;
        keep: string;
        keepParts: number;
        body: {
            b: number[];
            p: string[][];
        };
    };
};
export declare const CONSTRUCTS: {
    '\u2FF3\uD840\uDC89\u4E00\u4E59': {
        host: string;
        nested: boolean;
        cuts: ({
            host: string;
            label: string;
            contours: number[];
            digest: string;
            box?: undefined;
        } | {
            host: string;
            label: string;
            contours: number[];
            box: number[];
            digest: string;
        })[];
    };
    '\u2FF0\u2FFB\u4E09\u4E28\u5200': {
        host: string;
        keep: string;
        keepParts: number;
        contours: number[];
        digest: string;
    };
    '\u2FF2\uD880\uDC2A\u4E28\u2FF1\u4E36\u4E36': {
        host: string;
        nested: boolean;
        fill: boolean;
        cuts: {
            host: string;
            label: string;
            contours: number[];
            digest: string;
        }[];
    };
    '\u2FF5\u5182\u2E80': {
        host: string;
        hosts: string[];
        nested: boolean;
        like: string;
        draw: typeof fleshParts;
    };
};
/**
 * The flesh form's two parts, the frame and the dots, one for each leaf. Alone it is as tall as the
 * face and keeps its proportions; in a character it takes the place it is given as a glyph of its
 * proportions would, within `STRETCH`. The frame is narrowed to the place's proportions before it
 * is scaled, so its strokes thin only as far as the place is smaller. The dots keep their own
 * proportions: they scale with the frame's width, or between its width and height where the place
 * is wider than the form. Empty where the export lacks a glyph or draws another 冂 or 斗.
 * @param {Record<string, { b: number[], p: any[] } | null> | null} records
 * @param {number[]} region
 * @param {boolean} atRoot
 */
declare function fleshParts(records: Record<string, {
    b: number[];
    p: any[];
} | null> | null, region: number[], atRoot: boolean): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
}[];
/** The characters whose glyphs a construct is drawn from. @param {{ host: string, hosts?: string[], cuts?: { host: string }[] }} spec */
export declare const constructHosts: (spec: {
    host: string;
    hosts?: string[];
    cuts?: {
        host: string;
    }[];
}) => Set<string>;
/** A construct's stored body drawn in `box`, or null where it has none.
 * @param {{ body?: any, host?: string, keep?: string } | null} spec @param {number[]} box */
export declare function constructBody(spec: {
    body?: any;
    host?: string;
    keep?: string;
} | null, box: number[]): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
} | null;
/**
 * A construct's parts. A `cuts` entry draws the composition from its hosts' own outlines: each cut
 * names a glyph, the contours it keeps and the digest of that glyph, and the host's frame gives every
 * cut its place in the face, so the host's spacing between the top and the row holds. Another entry
 * keeps `keepParts` operands and fits a `body` (or the host's own `contours`) into the box the rest
 * filled. A digest names the outline a cut was made for; an export drawing another glyph keeps its
 * own parts. A `draw` entry builds its parts itself from the glyphs of its `hosts`.
 * @param {{ host: string, fill?: boolean, draw?: (records: Record<string, { b: number[], p: any[] } | null> | null, region: number[], atRoot: boolean) => any[], cuts?: { host: string, label: string, contours: number[], digest: string, box?: number[] }[], keep?: string, keepParts?: number, skipTail?: number, body?: any, contours?: number[], digest?: string }} spec
 * @param {any[]} out
 * @param {Record<string, { b: number[], p: any[] } | null> | null} [records] The glyphs the construct is drawn from.
 * @param {number[] | null} [face]
 * @param {boolean} [atRoot] Whether the construct is the whole character; a `fill` construct inside one fills `face`.
 */
export declare function constructParts(spec: {
    host: string;
    fill?: boolean;
    draw?: (records: Record<string, {
        b: number[];
        p: any[];
    } | null> | null, region: number[], atRoot: boolean) => any[];
    cuts?: {
        host: string;
        label: string;
        contours: number[];
        digest: string;
        box?: number[];
    }[];
    keep?: string;
    keepParts?: number;
    skipTail?: number;
    body?: any;
    contours?: number[];
    digest?: string;
}, out: any[], records?: Record<string, {
    b: number[];
    p: any[];
} | null> | null, face?: number[] | null, atRoot?: boolean): any[];
/**
 * A character whose font glyph draws its body another way: 囪's inside is written 夕-like, and Noto
 * Sans CJK JP draws it as 乂. Its frame, ㇒ and lower bar (contours 0–2) are kept and the 夕 of 囱
 * (contours 0–3) is set in their place. The digests name the outlines the cuts were made for: an
 * export of another font or style keeps the glyph it draws.
 */
export declare const BODY_FORMS: {
    囪: {
        host: string;
        keep: {
            f3b630d190dd20c70130b2b037955a13dc05833fc5f72ddc3a059dac1beee9b2: number[];
        };
        body: {
            '2e76d4d2c8063f3277e1ba9bacba05ff555239d79aa05ab9a8d3979569d0933c': number[];
        };
    };
};
/**
 * A description the font draws from an ideographic variation sequence. 者 U+8005 + VS18 U+E0101 is
 * the dotted 者 in Noto Sans CJK JP 2.004 (NotoSansCJK-Regular.ttc, sha256 b76b0433…) and Noto
 * Serif CJK JP 2.002 (NotoSerifCJK-Regular.ttc, sha256 93069d8e…); VS1 U+FE00 selects the same
 * glyph, and U+FA5B draws it too. The outlines below are that sequence's, not the plain 者's.
 * `digest` is the SHA-256 of the export's own 者 glyph, so an export of another font or style keeps
 * the composer's drawing.
 */
export declare const IVD_FORMS: {
    '⿻者丶': {
        base: string;
        label: string;
        sequence: string;
        forms: {
            sans: {
                font: string;
                digest: string;
                body: {
                    b: number[];
                    p: string[][];
                };
            };
            serif: {
                font: string;
                digest: string;
                body: {
                    b: number[];
                    p: string[][];
                };
            };
        };
    };
};
/**
 * `text` drawn from the variation sequence its font draws it as: one part at the font's own em when
 * `atRoot`, or in `region` when nested. Null where the style has no form, or the export's `base`
 * glyph is not the one the outline was read against, so the composer draws its own parts instead.
 * @param {{ base: string, label: string, sequence: string, forms: Record<string, { font: string, digest: string, body: any }> }} spec
 * @param {string} text
 * @param {{ p: any[] } | null} record
 * @param {string} style
 * @param {number[]} region
 * @param {boolean} atRoot
 */
export declare function ivdParts(spec: {
    base: string;
    label: string;
    sequence: string;
    forms: Record<string, {
        font: string;
        digest: string;
        body: any;
    }>;
}, text: string, record: {
    p: any[];
} | null, style: string, region: number[], atRoot: boolean): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
    fixed: boolean;
}[] | null;
/**
 * `record` drawn with the body of `host`: its own `keep` contours and the `body` contours of the
 * host, carried into its box. Null when either glyph is not the one the cut was made for.
 * @param {{ p: any[] }} record
 * @param {{ p: any[] } | null} host
 * @param {{ host: string, keep: Record<string, number[]>, body: Record<string, number[]> }} spec
 */
export declare function bodyForm(record: {
    p: any[];
}, host: {
    p: any[];
} | null, spec: {
    host: string;
    keep: Record<string, number[]>;
    body: Record<string, number[]>;
}): {
    contours: any[];
    box: number[];
} | null;
/** Join the bundled 𰀉冖木 form's wood to the roof underside. The source cut left
 * the space occupied by the holders' enclosed body between 冖 and 木.
 * @param {string} text @param {string} style @param {any[]} parts @returns {any[]} */
export declare function joinedComponentForm(text: string, style: string, parts: any[]): any[];
export {};
