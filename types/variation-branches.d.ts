export type Product = ReturnType<typeof import('./variation-product.js').createVariationProduct>;
export type Branch = {
    id: string;
    product: Product;
};
export type Expression = import('./variation-expression.js').VariationExpression;
export type BranchDocument = {
    version: 1;
    branches: {
        id: string;
        product: import('./variation-product.js').ProductDocument;
    }[];
};
/** @typedef {ReturnType<typeof import('./variation-product.js').createVariationProduct>} Product */
/** @typedef {{id:string,product:Product}} Branch */
/** @typedef {import('./variation-expression.js').VariationExpression} Expression */
/** @typedef {{version:1,branches:{id:string,product:import('./variation-product.js').ProductDocument}[]}} BranchDocument */
/** A finite, ordered sum of independent products. Each branch defines the occurrences available
 * after its parent form is fixed. Counts and indices include the identity of the branch.
 * @param {readonly Branch[]} branches */
export declare function createVariationBranches(branches: readonly Branch[]): Readonly<{
    count: bigint;
    at: (index: bigint) => {
        branch: string;
        expression: import("./variation-expression.js").VariationExpression;
    };
    rank: ({ branch, expression }: {
        branch: string;
        expression: Expression;
    }) => bigint;
    detect: (text: string) => {
        status: string;
        count: bigint;
        candidates: ({
            status: 'exact';
            expression: import("./variation-expression.js").VariationExpression;
            count?: undefined;
            candidates?: undefined;
            branch: string;
            index: bigint;
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
            branch: string;
        })[];
    };
    toJSON: () => BranchDocument;
}>;
/** @param {import('./variation-expression.js').Registry} registry @param {BranchDocument} document */
export declare function variationBranchesFromJSON(registry: import('./variation-expression.js').Registry, document: BranchDocument): Readonly<{
    count: bigint;
    at: (index: bigint) => {
        branch: string;
        expression: import("./variation-expression.js").VariationExpression;
    };
    rank: ({ branch, expression }: {
        branch: string;
        expression: Expression;
    }) => bigint;
    detect: (text: string) => {
        status: string;
        count: bigint;
        candidates: ({
            status: 'exact';
            expression: import("./variation-expression.js").VariationExpression;
            count?: undefined;
            candidates?: undefined;
            branch: string;
            index: bigint;
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
            branch: string;
        })[];
    };
    toJSON: () => BranchDocument;
}>;
