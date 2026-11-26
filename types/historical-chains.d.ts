/** A historical spelling's verified modern equivalent, or the original spelling.
 * @param {string} text */
export declare function canonicalHistoricalChain(text: string): string;
export type HistoricalGraph = {
    strokes: string[];
    joins: number[][][];
    crossings: number[][];
    evidence: {
        revision: string;
        file: string;
        host: string;
        description: string;
    };
};
/** The attested topology of a chain without a verified modern equivalent.
 * Endpoint 0 is the beginning of a stroke and 1 is its end.
 * @param {string} text */
export declare function historicalChainGraph(text: string): HistoricalGraph | null;
/** A named variant that replaced this historical spelling in the source.
 * The key retains the original Bai-style glyph-variant marker.
 * @param {string} text */
export declare function historicalChainReference(text: string): {
    key: string;
    chain: string;
    revision: string;
    file: string;
    host: string;
} | null;
/** The unique, unqualified historical level-0 host of a standalone chain.
 * Use the font's own outline only where its glyph agrees with the source form.
 * @param {string} text */
export declare function historicalNativeChar(text: string): string | null;
