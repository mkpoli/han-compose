export type Drawing = import('./index.js').Drawing;
export type SketchLeaf = import('./index.js').SketchLeaf;
export type Loaders = {
    [path: string]: string;
};
export type Answer = {
    status: 'composed';
    drawn: Drawing & {
        leaves?: string[];
        slots?: {
            index: number;
            box: number[];
            leaf?: number;
        }[];
    };
    sketch: SketchLeaf[] | null;
} | {
    status: 'failed';
    error: string;
    unavailable?: boolean;
} | {
    status: 'cancelled';
};
export type WorkerLike = {
    postMessage(message: any): void;
    terminate(): void;
    onmessage: ((event: MessageEvent) => any) | null;
    onerror: ((event: ErrorEvent) => any) | null;
};
/**
 * @typedef {import('./index.js').Drawing} Drawing
 * @typedef {import('./index.js').SketchLeaf} SketchLeaf
 * @typedef {{ [path: string]: string }} Loaders The URL each bundled file is served at, by its path in the package's `data/`.
 * @typedef {{ status: 'composed', drawn: Drawing & { leaves?: string[], slots?: { index: number, box: number[], leaf?: number }[] }, sketch: SketchLeaf[] | null }
 *   | { status: 'failed', error: string, unavailable?: boolean } | { status: 'cancelled' }} Answer
 * @typedef {{ postMessage(message: any): void, terminate(): void, onmessage: ((event: MessageEvent) => any) | null,
 *   onerror: ((event: ErrorEvent) => any) | null }} WorkerLike
 */
/**
 * A drawer over workers made by `makeWorker`, drawing from the export at `base`. `draw(sequence,
 * { separate, fontStyle })` answers `{ status: 'composed', drawn, sketch }` (`sketch` where the
 * layout put each part before the drawing was done), `{ status: 'failed', error, unavailable }`
 * (`unavailable` when the export itself could not be read), or `{ status: 'cancelled' }` when it was
 * replaced or `cancel` was called first; `onSketch` hears the sketch as it comes, before the
 * drawing is done. `separate` draws every operand rather than a glyph that spells the whole
 * description. `warm()` starts the worker on the export's manifest and layout before the first
 * drawing. `config.loaders` tells the worker where each bundled file is served.
 * @param {() => WorkerLike} makeWorker
 * @param {string} base
 * @param {{ loaders?: Loaders, timeout?: number }} [config]
 */
export declare function createDrawer(makeWorker: () => WorkerLike, base: string, config?: {
    loaders?: Loaders;
    timeout?: number;
}): {
    draw: (sequence: string, onSketch?: ((leaves: SketchLeaf[]) => void) | null, { separate, fontStyle, preferExport, loaders }?: {
        separate?: boolean;
        fontStyle?: 'sans' | 'serif' | 'regular' | 'fangsong' | 'pen-writing';
        preferExport?: boolean;
        loaders?: Loaders;
    }) => Promise<Answer>;
    cancel: () => void;
    warm: () => void;
    dispose: () => void;
};
