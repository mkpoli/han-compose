/** One choice per construction of the upper turn. GlyphWiki names are source identities. */
export declare const u26201Forms: {
    id: string;
    text: string;
    witnesses: string[];
    aliases: string[];
}[];
/** @param {string} idOrText */
export declare const resolveYaoForm: (idOrText: string) => {
    id: string;
    text: string;
    witnesses: string[];
    aliases: string[];
} | undefined;
