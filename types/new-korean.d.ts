import { isNewKorean } from './tree.js';
export declare const hasNewKorean: typeof isNewKorean;
/** @param {{ load?: () => Promise<any>, fallback?: any }} options */
export declare const newKoreanSource: ({ load, fallback }?: {
    load?: () => Promise<any>;
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
