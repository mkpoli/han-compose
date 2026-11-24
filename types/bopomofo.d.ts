export declare const hasBopomofo: (text: any) => boolean;
declare const loadOutlines: () => Promise<any>;
export declare const bopomofoSource: ({ load, fallback, style }?: {
    fallback?: null | undefined;
    load?: typeof loadOutlines | undefined;
    style?: string | undefined;
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
export {};
