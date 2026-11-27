/** @type {Record<string, number[]>} */
export declare const columnClearance: Record<string, number[]>;
/** Settle independently placed columns after their final stroke weights are known.
 * @param {any[][][]} rows @param {any[]} parts @param {string} style */
export declare function settleColumns(rows: any[][][], parts: any[], style: string): void;
