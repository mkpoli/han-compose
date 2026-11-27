/** @param {string} key @param {string} style */
export declare const rccDonors: (key: string, style: string) => any[];
/** @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region @returns {any[] | null} */
export declare function rccParts(composer: import('./compose.js').Composer, key: string, region: number[]): any[] | null;
/** Split registered native hosts after their final placement and weight are known.
 * @param {any[]} parts */
export declare function editableRccParts(parts: any[]): any[];
/** Combine all contours belonging to one source operand for its editor box.
 * @param {any[]} parts @param {number} count */
export declare function rccLeafBoxes(parts: any[], count: number): number[][] | null;
/** Carry record-local operand numbers into the original IDS. Ordinary pieces
 * between two known groups can also be numbered when they match one for one.
 * @param {any} tree @param {any[]} parts @param {(node: any) => string} keyOf
 * @param {(node: any) => string[]} leafTexts */
export declare function numberRccLeaves(tree: any, parts: any[], keyOf: (node: any) => string, leafTexts: (node: any) => string[]): void;
