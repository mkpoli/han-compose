export type Document = import('./variation-expression.js').VariationExpression | import('./variation-product.js').ProductDocument | import('./variation-branches.js').BranchDocument;
export type Family = import('./variation-registry.js').VariationFamily;
export type Catalogue<F extends Family> = {
    families: readonly F[];
    familiesFor: (text: string) => readonly F[];
};
export type Archive<F extends Family> = {
    format: 'han-compose/variation-archive';
    version: 1;
    document: Document;
    families: F[];
};
export type CompiledProduct = {
    toJSON: () => import('./variation-product.js').ProductDocument | import('./variation-branches.js').BranchDocument;
};
/** @typedef {{toJSON:() => import('./variation-product.js').ProductDocument | import('./variation-branches.js').BranchDocument}} CompiledProduct */
/** Archive a design or a space together with the family records required to reopen it.
 * Embedded outline and provenance fields are copied as JSON; linked resources retain their URLs.
 * @template {Family} F @param {Catalogue<F>} registry @param {Document | CompiledProduct} document @returns {Archive<F>} */
export declare function archiveVariation<F extends Family>(registry: Catalogue<F>, document: Document | CompiledProduct): Archive<F>;
/** Restore from archived records alone. A host can use the returned registry for drawing or editing.
 * @template {Family} F @param {Archive<F>} archive */
export declare function openVariationArchive<F extends Family>(archive: Archive<F>): {
    registry: Readonly<{
        families: readonly F[];
        familiesFor: (text: string) => readonly F[];
        match(familyId: string, traits: Record<string, string>): import("./variation-registry.js").VariationForm[];
        at(sequence: string, path: readonly number[]): {
            family: F;
            forms: import("./variation-registry.js").VariationForm[];
        }[];
        select(sequence: string, path: readonly number[], familyId: string, formId: string, { asReplacement }?: {
            asReplacement?: boolean;
        } | undefined): string;
    }>;
    document: import("./variation-branches.js").BranchDocument | import("./variation-product.js").ProductDocument | import("./variation-expression.js").VariationExpression;
};
