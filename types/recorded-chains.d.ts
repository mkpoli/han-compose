/**
 * A single native glyph attested for the exact undecorated spelling in Yi Bai's
 * primary level-0 IDS. A competing host or a variant-only description has no match.
 * Pass the preserved written spelling, or `keyOf(node)` from the parsed sequence.
 * @param {string} key
 */
export declare function recordedChainNative(key: string): {
    char: string;
    source: {
        level: string;
        line: number;
        commit: string;
        rawDescription: string;
        url: string;
    };
} | null;
/**
 * Source history for a raw chain spelling. Complete occurrences and contexts
 * are available in data/recorded-chains.json.gz.
 * @param {string} key
 */
export declare function recordedChainEvidence(key: string): {
    firstCommit: string | null;
    lastCommit: string | null;
    levels: string[];
    guide: {
        repository: string;
        commit: string;
        path: string;
        license: string;
        copyright: string;
        mapping: string;
        codePoints: string[];
    } | null;
} | null;
