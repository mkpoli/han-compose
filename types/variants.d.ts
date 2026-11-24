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
