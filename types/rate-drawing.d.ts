/** @param {string} text @param {string} style @param {number[]} region @param {boolean} atRoot */
export declare function rateParts(text: string, style: string, region: number[], atRoot: boolean): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
    fixed: boolean;
}[] | null;
/** A reviewed whole-glyph outline in the 1000-unit SVG em. @param {string} text @param {string} style */
export declare function rateDrawing(text: string, style: string): string | null;
