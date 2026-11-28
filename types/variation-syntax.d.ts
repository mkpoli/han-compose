import { variationExpression } from './variation-expression.js';
export type Expression = ReturnType<typeof variationExpression>;
export type ProductDocument = import('./variation-product.js').ProductDocument;
export type Dimension = import('./variation-product.js').Dimension;
/** Parse a single design or a product of independent design choices.
 * @param {string} input @returns {Expression | ProductDocument} */
export declare function parseVariationSyntax(input: string): Expression | ProductDocument;
/** Write the portable notation, including exact local forms and pinned product domains.
 * @param {Expression | ProductDocument} document */
export declare function formatVariationSyntax(document: Expression | ProductDocument): string;
