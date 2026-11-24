/** `layout.json` read into networks: per seed, its layers as `{ rows, cols, data }` and biases. */
export declare function readLayout(json: any): {
    ops: any;
    defaults: any;
    shape: number;
    seeds: any;
};
/** Both operands' boxes for the features `x`, in font units. */
export declare function forward(layout: any, x: any): number[][];
/** The features of two operands under `op` (`compose_layout.features`): `records` are their bucket
 *  records (or null), `places` their places. */
export declare function features(layout: any, op: any, records: any, places: any): any;
