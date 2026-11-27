/**
 * Every character of the export at `base` with the variation sequences it draws, the plain character
 * left out: 者 → [者 U+8005 U+E0101]. Read once a page; an export without the file answers an empty map.
 * @param {string} base The folder holding the export.
 * @param {{ fetch?: (url: string) => Promise<Response> }} [options]
 * @returns {Promise<Map<string, string[]>>}
 */
export declare function variationSequences(base: string, { fetch: get }?: {
    fetch?: (url: string) => Promise<Response>;
}): Promise<Map<string, string[]>>;
export declare const grassIVS: Readonly<{
    connected: "艹󠄀";
    split: "艹󠄂";
    inward: "艹󠄁";
}>;
/** Contextual drawing key for a single grass radical token. @param {string} text */
export declare const grassShape: (text: string) => string | undefined;
/** Attested spellings of the grass radical, grouped by the contextual shape used by the
 * composer. The literal drawings are feature values. Look up each exact sequence in the
 * IVD catalogue for its collection-specific glyph identifiers. */
export declare const grassFamily: {
    id: string;
    subjects: string[];
    reference: string;
    axes: {
        id: string;
        property: string;
        locus: {
            path: never[];
        }[];
        values: string[];
    }[];
    forms: {
        id: string;
        text: string;
        kind: string;
        traits: {
            crossbar: string;
            shape: string;
        };
    }[];
    sources: string[];
};
