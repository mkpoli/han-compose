/** The path a host lists its outlines under, in `loaders`. */
export declare const HOST_OUTLINES = "host/outlines.json.gz";
/** Whether a sequence names an entity reference, the only keys a host's outlines answer for.
 *  @param {string} sequence */
export declare const hasEntity: (sequence: string) => boolean;
/** The host's records over `fallback`; a reference the file does not hold is left to `fallback`.
 *  @param {{ load: () => Promise<any>, fallback?: any }} options */
export declare const hostSource: ({ load, fallback }: {
    load: () => Promise<any>;
    fallback?: any;
}) => {
    manifest: null;
    readonly layout: any;
    ready(): any;
    modelFiles: (options: any) => any;
    load: (names: any) => any;
    filesOf: (keys: any) => any;
    store(): {
        manifest: null;
        missing: any;
        readonly layout: any;
        identity: (key: any) => any;
        rec: (key: any) => any;
        hosts: (key: any, place: any) => any;
        places: (key: any) => any;
        kin: () => any;
    };
};
/** Registered glyphs supplied by a host for faces whose export lacks a sequence.
 * @param {{ load: () => Promise<any>, fallback?: any, style?: string }} options */
export declare const hostVariantSource: ({ load, fallback, style }: {
    load: () => Promise<any>;
    fallback?: any;
    style?: string;
}) => {
    manifest: null;
    readonly layout: any;
    ready(): any;
    modelFiles: (options: any) => any;
    load: (names: any) => any;
    filesOf: (keys: any) => any;
    store(): {
        manifest: null;
        missing: any;
        readonly layout: any;
        identity: (key: any) => any;
        rec: (key: any) => any;
        hosts: (key: any, place: any) => any;
        places: (key: any) => any;
        kin: () => any;
    };
};
/** @param {string} text */
export declare const hasIdeographicSelector: (text: string) => boolean;
