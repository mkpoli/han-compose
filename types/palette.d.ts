/** @param {string} text */
export declare const hasPaletteGlyph: (text: string) => boolean;
/** @param {{ load?: () => Promise<any>, sans?: (() => Promise<any>) | null, style?: string, fallback?: any, under?: boolean }} options */
export declare const paletteSource: ({ load, sans, style, fallback, under }?: {
    load?: () => Promise<any>;
    sans?: (() => Promise<any>) | null;
    style?: string;
    fallback?: any;
    under?: boolean;
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
