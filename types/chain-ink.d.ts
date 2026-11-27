/** Standalone ink box at the published export's em size.
 * @param {any} manifest @param {string} key */
export declare function exportInkBox(manifest: any, key: string): number[];
/** Original standalone ink frame when the regular composition is available.
 * @param {any} composer @param {string} key */
export declare function recordedInkBox(composer: any, key: string): number[] | null;
/** Preserve a previously drawable form's ink extent at its original em scale.
 * @param {any} composer @param {string} key @param {any[]} parts */
export declare function fitRecordedInk(composer: any, key: string, parts: any[]): void;
