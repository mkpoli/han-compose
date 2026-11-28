export type Path = number[];
export type Expansion = {
    path: Path;
    subject: string;
    ids: string;
    source: string;
};
export type Choice = {
    path: Path;
    subject: string;
    text: string;
    family: string;
    form: string;
    source?: never;
} | {
    path: Path;
    subject: string;
    text: string;
    source: string;
    family?: never;
    form?: never;
};
export type VariationExpression = {
    version: 1;
    base: string;
    expansions: Expansion[];
    choices: Choice[];
};
export type Registry = {
    familiesFor: (text: string) => readonly {
        id: string;
        evidenceOnly?: boolean;
        forms: readonly {
            id: string;
            text: string;
            aliases?: readonly string[];
        }[];
    }[];
};
export type Branch = {
    children: Map<number, Branch>;
    choice?: Choice;
    expansion?: Expansion;
    query?: boolean;
};
/** Begin a storable expression for a literal character, reference or IDS.
 * @param {string} base @returns {VariationExpression} */
export declare function variationExpression(base: string): VariationExpression;
/** Fully expanded editable spelling, including active choices. @param {VariationExpression} expression */
export declare const expandedVariation: (expression: VariationExpression) => string;
/** Write the result as ordinary IDS, expanding encoded operands only on the route to an explicit
 * choice. Supplying a catalogue also checks each family's identity and spelling.
 * @param {VariationExpression} expression @param {Registry} [registry] */
export declare const realizeVariation: (expression: VariationExpression, registry?: Registry) => string;
/** Literal operand before its own choice or expansion, taking all ancestor edits into account.
 * @param {VariationExpression} expression @param {Path} path */
export declare const variationSubject: (expression: VariationExpression, path: Path) => string;
/** Record the decomposition used to address descendants of an occurrence.
 * @param {VariationExpression} expression @param {Path} path @param {Omit<Expansion,'path'>} witness */
export declare function expandVariation(expression: VariationExpression, path: Path, witness: Omit<Expansion, 'path'>): VariationExpression;
/** Assign a documented family form to one occurrence, retaining its exact spelling in the record.
 * @param {Registry} registry @param {VariationExpression} expression @param {Path} path @param {string} family @param {string} form */
export declare function chooseVariation(registry: Registry, expression: VariationExpression, path: Path, family: string, form: string): VariationExpression;
/** Assign any complete operand to a site and retain its local source reference.
 * @param {VariationExpression} expression @param {Path} path @param {{text:string,source:string}} replacement @param {Registry} [registry] */
export declare function replaceVariation(expression: VariationExpression, path: Path, replacement: {
    text: string;
    source: string;
}, registry?: Registry): VariationExpression;
/** Remove one choice. A descendant depending on that choice must be cleared explicitly first.
 * @param {VariationExpression} expression @param {Path} path */
export declare function clearVariation(expression: VariationExpression, path: Path): VariationExpression;
/** Remove the witness at a site and every annotation below it, retaining the site's own choice.
 * @param {VariationExpression} expression @param {Path} path */
export declare function collapseVariation(expression: VariationExpression, path: Path): VariationExpression;
