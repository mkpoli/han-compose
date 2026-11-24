/** The code points the export covers, as `[first, last]` ranges in order: what a page lists when it
 *  needs every character the fallback can draw. */
export declare const UNICODE_COVERAGE: [number, number][];
/** Whether this exact component has a bundled outline. Selectors require an explicit export glyph. */
export declare function hasUnicodeGlyph(key: any): boolean;
/**
 * The URL of a file under the package's `data/`. A file at the top of the folder keeps the
 * `new URL(…, import.meta.url)` form, which Vite turns into an asset of the build; Vite reads that form
 * as a glob of the folder's top level only, so a nested file (`unicode/outlines/…`, `sources/…`) came
 * out `undefined` and was fetched as `src/undefined`. A nested one is resolved against the folder
 * instead; a build that moves the package's files passes `loaders` for those, as it always had to.
 * @param {string} path @returns {URL}
 */
export declare const dataFile: (path: string) => URL;
/** A bundled file's parsed JSON, as the page reads it: the file under the package's `data/`. */
export declare const pageLoader: (path: any) => Promise<any>;
/** A bundled file fetched at `url`. Node's `fetch` reads no `file:` URL, so an installed package's
 *  own file is read from disk there. @param {string | URL} url @returns {Promise<Response>} */
export declare const fetchBundled: (url: string | URL) => Promise<Response>;
declare const readShard: (name: any) => Promise<any>;
/** Add missing glyphs to an export, or draw bundled glyphs alone with geometric layout. `load`
 *  answers a bundled file's parsed JSON by its path under `data/`. */
export declare function unicodeSource({ fallback, load }?: {
    fallback?: null | undefined;
    load?: typeof readShard | undefined;
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
export {};
