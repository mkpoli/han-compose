export type Locus = {
    path: number[];
    strokes?: number[];
};
export type VariationAxis = {
    id: string;
    property: string;
    unit?: string;
    witness?: string;
    examples?: Record<string, string>;
    locus: Locus[];
    values: string[];
};
export type VariationForm = {
    id: string;
    text: string;
    aliases?: string[];
    traits?: Record<string, string>;
};
export type VariationFamily = {
    id: string;
    subjects: string[];
    reference?: string;
    evidenceOnly?: boolean;
    axes?: VariationAxis[];
    forms: VariationForm[];
};
/**
 * Index a JSON catalogue. A spelling can occur in several independent families and multiple
 * source records can describe the same glyph. A family lists only witnessed combinations.
 * @template {VariationFamily} F
 * @param {readonly F[]} families
 */
export declare function createVariationRegistry<F extends VariationFamily>(families: readonly F[]): Readonly<{
    families: readonly F[];
    familiesFor: (text: string) => readonly F[];
    /** Find forms with the requested set of observed features.
     * @param {string} familyId @param {Record<string,string>} traits */
    match(familyId: string, traits: Record<string, string>): VariationForm[];
    /** Each applicable family and its exact forms at this occurrence. A bare subject can have none.
     * @param {string} sequence @param {readonly number[]} path */
    at(sequence: string, path: readonly number[]): {
        family: F;
        forms: VariationForm[];
    }[];
    /** Write a form at one occurrence. Siblings retain their source spelling, even when parsing
     * would normalize their stroke chain or slot marker.
     * @param {string} sequence @param {readonly number[]} path @param {string} familyId @param {string} formId
     * @param {{asReplacement?:boolean}} [options] Explicitly replace a component using a source criterion. */
    select(sequence: string, path: readonly number[], familyId: string, formId: string, { asReplacement }?: {
        asReplacement?: boolean;
    }): string;
}>;
export type IvdCollection = {
    collection: string;
    pattern: string;
    url: string;
};
/** @typedef {{collection:string, pattern:string, url:string}} IvdCollection */
/** Read IVD_Collections.txt. The registrant's Perl pattern is retained verbatim.
 * @param {string} input @returns {IvdCollection[]} */
export declare function ivdCollections(input: string): IvdCollection[];
/** Read the Unicode IVD_Sequences.txt fields. Collections sharing an IVS each keep their own
 * glyph identifier. A registration alone describes no component-level features.
 * @param {string} input @param {string} edition @param {IvdCollection[]} [collections] */
export declare function ivdFamilies(input: string, edition: string, collections?: IvdCollection[]): {
    id: string;
    subjects: string[];
    source: {
        name: string;
        edition: string;
        collections?: IvdCollection[] | undefined;
    };
    forms: {
        id: string;
        text: string;
        registrations: {
            collection: string;
            identifier: string;
        }[];
    }[];
}[];
export type UcvEntry = {
    id: string;
    kind: 'unifiable' | 'not-unifiable';
    components?: string;
    forms: {
        glyph: string;
        text?: string;
        of?: string;
    }[];
};
/** @typedef {{id:string, kind:'unifiable'|'not-unifiable', components?:string, forms:{glyph:string,text?:string,of?:string}[]}} UcvEntry */
/** Read a compiled IWDS catalogue. Keep the entire entry, including its examples, notes,
 * negative criteria and the published order. A contextual pattern with a slot identifies a
 * drawing in the source; the exact drawing can be written as a GlyphWiki entity.
 * @template {UcvEntry} E
 * @template S,G
 * @param {{entries:E[], source:S, groups:G}} data */
export declare function ucvFamilies<E extends UcvEntry, S, G>(data: {
    entries: E[];
    source: S;
    groups: G;
}): {
    id: string;
    evidenceOnly: boolean;
    subjects: string[];
    forms: {
        id: string;
        text: string;
        glyph: string;
    }[];
    entry: E;
    source: S;
    groups: G;
}[];
