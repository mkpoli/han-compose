export type Registry = import('./variation-expression.js').Registry;
export type Expression = ReturnType<typeof import('./variation-expression.js').variationExpression>;
export type Option = {
    family: string;
    form: string;
    text: string;
    source?: never;
} | {
    source: string;
    text: string;
    family?: never;
    form?: never;
};
export type Domain = {
    path: number[];
    options: Option[];
};
export type Dimension = {
    path: number[];
    family: string;
    forms?: string[];
} | {
    path: number[];
    families: string[];
} | Domain;
export type ProductDocument = {
    version: 1;
    expression: Expression;
    dimensions: Dimension[];
};
/**
 * The Cartesian product of independently adjustable occurrences. Sites are ordered by operand
 * path; the rightmost site varies fastest. Counts and ranks are arbitrary-precision integers.
 * @param {Registry} registry @param {Expression} expression @param {readonly Dimension[]} dimensions
 */
export declare function createVariationProduct(registry: Registry, expression: Expression, dimensions: readonly Dimension[]): Readonly<{
    count: bigint;
    at: (index: bigint) => import("./variation-expression.js").VariationExpression;
    rank: (expr: Expression) => bigint;
    detect: (text: string) => {
        readonly status: 'unknown';
    } | {
        status: 'exact';
        index: bigint;
        expression: import("./variation-expression.js").VariationExpression;
        count?: undefined;
        candidates?: undefined;
    } | {
        index?: undefined;
        expression?: undefined;
        status: 'ambiguous';
        count: bigint;
        candidates: {
            path: number[];
            options: ({
                family: string;
                form: string;
                text: string;
                source?: never;
            } | {
                source: string;
                text: string;
                family?: never;
                form?: never;
            })[];
        }[];
    };
    toJSON: () => ProductDocument;
}>;
/** Reopen the saved expression and its ordered, pinned domains.
 * @param {Registry} registry @param {ProductDocument} document */
export declare function variationProductFromJSON(registry: Registry, document: ProductDocument): Readonly<{
    count: bigint;
    at: (index: bigint) => import("./variation-expression.js").VariationExpression;
    rank: (expr: Expression) => bigint;
    detect: (text: string) => {
        readonly status: 'unknown';
    } | {
        status: 'exact';
        index: bigint;
        expression: import("./variation-expression.js").VariationExpression;
        count?: undefined;
        candidates?: undefined;
    } | {
        index?: undefined;
        expression?: undefined;
        status: 'ambiguous';
        count: bigint;
        candidates: {
            path: number[];
            options: ({
                family: string;
                form: string;
                text: string;
                source?: never;
            } | {
                source: string;
                text: string;
                family?: never;
                form?: never;
            })[];
        }[];
    };
    toJSON: () => ProductDocument;
}>;
