/** The character an entity writes in full (`&HC-u91d1-full;` is 金), or null for anything else.
 * @param {string} text */
export declare function fullFormOf(text: string): string | null;
/** The entity that writes one character in full. @param {string} char */
export declare const fullFormText: (char: string) => string;
/**
 * One family for each component the table gives a positional form, in the place that form stands
 * (`place`: L, R, T or B): the positional forms, each written as its own character, and the
 * component in full, written as an entity. The plain component leaves the choice to the composer,
 * which draws the positional form there. The full form is a local design: no source registers it.
 */
export declare const fullFormFamilies: readonly {
    id: string;
    place: string;
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
            form: string;
        };
    }[];
    sources: string[];
}[];
