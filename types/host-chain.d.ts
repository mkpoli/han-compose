/** @param {any} node @param {string} style */
export declare function chainHost(node: any, style: string): string;
/** A one-leaf grid uses the same native frame as ordinary standalone composition.
 * @param {import('./compose.js').Composer} composer @param {string} written @param {number[]} region */
export declare function standaloneHostParts(composer: import('./compose.js').Composer, written: string, region: number[]): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
}[] | null;
/** Place the complete native glyph so its bearings and weight survive layout.
 * Editable leaves take the final contours and transform of that same placement.
 * @param {import('./compose.js').Composer} composer @param {any} glyph @param {number[]} region
 * @param {string} host @param {string[]} leaves @param {number[][] | ((glyph: any) => any[])} groups */
export declare function partitionChainHost(composer: import('./compose.js').Composer, glyph: any, region: number[], host: string, leaves: string[], groups: number[][] | ((glyph: any) => any[])): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
}[] | {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
    rccLeaf: number;
    rccLeafCount: number;
    leafParts: (final: any) => any[][];
}[];
/** @param {string} key @param {string} style */
export declare function hostContextDonors(key: string, style: string): any[];
/** @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region */
export declare function hostContextParts(composer: import('./compose.js').Composer, key: string, region: number[]): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
}[] | null;
/** Apply registered span adjustments once, when the final slot is known and
 * before the composer chooses weights for the resulting proportions.
 * @param {any[]} parts */
export declare function fitNestedHostChains(parts: any[]): void;
/** Select the frame only after the exact donor has been identified. Layout
 * may adjust its coordinates before the editable operands are cut.
 * @param {any} record @param {string} style @param {boolean} allowNoto */
export declare function horseFrameCut(record: any, style: string, allowNoto: boolean): {
    face: string;
    frame: (/** @type {any} */ glyph: any) => {
        contours: any[];
        box: number[];
    };
} | null;
/** The same flat foot serves as its own component and as the second operand in 乐.
 * @param {any} record @param {string} style */
export declare function leFrameCut(record: any, style: string): {
    face: string;
    indices: (number | number[][])[];
} | null;
/** Place a leaf drawn from an attested host whose frame has its own contours.
 * @param {import('./compose.js').Composer} composer
 * @param {any} node @param {number[]} region @param {boolean} atRoot @param {string} [written] */
export declare function hostChainParts(composer: import('./compose.js').Composer, node: any, region: number[], atRoot: boolean, written?: string): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
}[] | {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
    fixed: boolean;
    standaloneNativeSize: boolean;
}[] | {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
    strokeSpans: number[][][];
    hookRun: number[] | undefined;
}[] | null;
