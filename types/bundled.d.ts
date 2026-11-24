/**
 * `under` lets the export answer first, with these records filling only what it lacks.
 */
export declare function bundledSource({ load, matches, fallback, under, nativeFirst, alias }: {
    alias?: ((key: any) => any) | undefined;
    fallback?: null | undefined;
    load: any;
    matches: any;
    nativeFirst?: boolean | undefined;
    under?: boolean | undefined;
}): {
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
