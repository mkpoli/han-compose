/** Restore contact at the chain's declared endpoints where a tapered tip or a
 * slanted cap falls short of the nominal bar intersection. A stroke keeps its
 * other endpoint in place. Both masters carry the same endpoint displacement,
 * limited to its value at the cap for control points beyond the two ends.
 * @param {any[]} parts @param {any} solved @param {number[]} box */
export declare function fitChainJoins(parts: any[], solved: any, box: number[]): any[];
