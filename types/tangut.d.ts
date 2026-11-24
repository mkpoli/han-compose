export declare const hasTangut: (text: any) => boolean;
export declare const onlyTangut: (sequence: any) => boolean;
declare const loadOutlines: () => Promise<any>;
export declare function tangutSource({ load, fallback }?: {
    fallback?: null | undefined;
    load?: typeof loadOutlines | undefined;
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
export {};
