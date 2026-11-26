/** Whether a face lists any plain sequences. @param {string} style */
export declare const hasPlainVariants: (style: string) => boolean;
/** The base character `key` draws as in `style`, or null where the face registers no plain glyph
 *  for it. @param {string} key @param {string} style */
export declare function plainBase(key: string, style: string): string | null;
/** Whether a sequence holds a variation selector. @param {string} sequence */
export declare const hasVariationSelector: (sequence: string) => boolean;
/**
 * `fallback` with each plain sequence of `style` that it holds no record for answered by its base
 * character's record. A sequence with a record of its own keeps it.
 * @param {{ fallback: any, style: string }} options
 */
export declare function plainVariantSource({ fallback, style }: {
    fallback: any;
    style: string;
}): {
    readonly manifest: any;
    readonly layout: any;
    ready: () => any;
    modelFiles: (/** @type {any} */ options: any) => any;
    load: (/** @type {string[]} */ names: string[]) => any;
    filesOf: (/** @type {string[]} */ keys: string[]) => any;
    store(): {
        manifest: any;
        missing: any;
        readonly layout: any;
        identity: (/** @type {string} */ key: string) => any;
        rec: (/** @type {string} */ key: string) => any;
        hosts: (/** @type {string} */ key: string, /** @type {any} */ place: any) => any;
        places: (/** @type {string} */ key: string) => any;
        kin: () => any;
    };
};
