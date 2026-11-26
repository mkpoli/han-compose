export declare function traitsOf(sequence: any): {
    empty: boolean;
    loose: boolean;
    tangut: boolean;
    bopomofo: boolean;
    seal: boolean;
    newKorean: boolean;
    shuishu: boolean;
    jurchen: boolean;
    palette: boolean;
    custom: boolean;
    entity: boolean;
    ideographicSelector: boolean;
};
/** A cache key for the traits a source depends on. @param {ReturnType<typeof traitsOf>} traits */
export declare const traitKey: (traits: ReturnType<typeof traitsOf>) => string;
/**
 * The source `sequence` draws from over the export at `base`. `loaders` gives the URL each bundled
 * file is served at, by its path under the package's `data/` (`sources/tangut/outlines.json.gz`),
 * for a page that serves them elsewhere; left out, the page fetches them beside the package.
 * `bundled` draws without the export, as a page does when the export could not be read; `remote`
 * keeps the export even for a sequence bundled outlines would cover, as warming does. `fetch`
 * replaces how the export is read, and `read` how a bundled file is: a page that reads its own assets
 * (a Worker over its deployment's files) answers by path, wherever `loaders` puts them. `exported`
 * is the export's own source (`exportSource`) where the caller keeps one for every sequence it draws
 * from `base`, so the export's files are read once however the sequences differ; how that source
 * reads the export was said when it was built, and `fetch` and `read` here reach the bundled files alone.
 * @param {string} sequence
 * @param {{ base?: string, fontStyle?: string, separate?: boolean, bundled?: boolean, remote?: boolean, loaders?: Record<string, string>, traits?: ReturnType<typeof traitsOf>, exported?: ReturnType<typeof exportSource> | null, fetch?: typeof globalThis.fetch, read?: (path: string, url?: string) => Promise<Response> }} [options]
 */
export declare function sourceFor(sequence: string, { base, fontStyle, separate, bundled, remote, loaders, traits, exported, fetch: get, read }?: {
    base?: string;
    fontStyle?: string;
    separate?: boolean;
    bundled?: boolean;
    remote?: boolean;
    loaders?: Record<string, string>;
    traits?: ReturnType<typeof traitsOf>;
    exported?: ReturnType<typeof exportSource> | null;
    fetch?: typeof globalThis.fetch;
    read?: (path: string, url?: string) => Promise<Response>;
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
/**
 * The export at `base` as a source, its own Unicode fallback reading its shards where the host says
 * they are. A caller drawing many sequences from one export keeps this and hands it to `sourceFor`.
 * @param {string | undefined} base
 * @param {{ loaders?: Record<string, string>, fetch?: typeof globalThis.fetch, read?: (path: string, url?: string) => Promise<Response> }} [options]
 */
export declare function exportSource(base: string | undefined, { loaders, fetch: get, read }?: {
    loaders?: Record<string, string>;
    fetch?: typeof globalThis.fetch;
    read?: (path: string, url?: string) => Promise<Response>;
}): {
    manifest: null;
    readonly layout: any;
    ready(): any;
    modelFiles: (options: any) => any;
    load(names: any): Promise<void>;
    filesOf(keys: any): any;
    store(): {
        manifest: null;
        missing: any;
        readonly layout: any;
        identity: (key: any) => any;
        rec(key: any): any;
        hosts: (key: any, place: any) => any;
        places: (key: any) => any;
        kin: () => any;
    };
};
