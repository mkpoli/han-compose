// @ts-check
// Drawing sequences in a worker (`worker.js`) one at a time, the newest only. Asking for another
// sequence while one is being drawn ends that worker and starts a new one, since a drawing in
// progress cannot be interrupted; the files it had loaded stay in the browser's cache, the export's
// files being immutable.

/**
 * @typedef {import('./index.js').Drawing} Drawing
 * @typedef {import('./index.js').SketchLeaf} SketchLeaf
 * @typedef {import('./loader.js').Loaders} Loaders
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
 * drawing. `loaders` tells the worker how to read files a page cannot fetch.
 * @param {() => WorkerLike} makeWorker
 * @param {string} base
 * @param {Loaders} [config]
 */
export function createDrawer(makeWorker, base, config = {}) {
  /** @type {WorkerLike | null} */
  let worker = null
  /** @type {{ id: number, resolve: (answer: Answer) => void, onSketch: ((leaves: SketchLeaf[]) => void) | null, sketch: SketchLeaf[] | null } | null} */
  let pending = null
  /** How long a worker may go silent before the drawer gives up on it. */
  const SILENCE = config.timeout ?? 120_000
  let next = 0
  /** @param {Answer} answer */
  const settle = answer => { const p = pending; pending = null; p?.resolve(answer) }
  function end() {
    worker?.terminate()
    worker = null
  }
  /** The live worker, made once with its message handlers. */
  function connect() {
    if (worker) return worker
    const live = makeWorker()
    worker = live
    live.onmessage = ({ data }) => {
      if (data.id !== pending?.id) return
      if (data.sketch) { pending.sketch = data.sketch; pending.onSketch?.(data.sketch); return }
      settle(data.error === undefined ? { status: 'composed', drawn: data.drawn, sketch: pending?.sketch ?? null }
        : { status: 'failed', error: data.error, ...(data.unavailable ? { unavailable: true } : {}) })
    }
    live.onerror = event => { event?.preventDefault?.(); end(); settle({ status: 'failed', error: String(event?.message ?? 'worker failed') }) }
    return live
  }
  function cancel() {
    if (!pending) return
    end()
    settle({ status: 'cancelled' })
  }
  /** Load the export's manifest and layout now, so a later drawing starts with them. */
  function warm() { connect().postMessage({ id: ++next, warm: true, base, loaders: config.loaders ?? {} }) }
  /**
   * @param {string} sequence
   * @param {((leaves: SketchLeaf[]) => void) | null} [onSketch]
   * @param {{ separate?: boolean, fontStyle?: 'sans' | 'serif' | 'kaisho' }} [options]
   * @returns {Promise<Answer>}
   */
  function draw(sequence, onSketch = null, { separate = false, fontStyle = 'sans', loaders = config.loaders } = {}) {
    cancel()
    const live = connect()
    const id = ++next
    return new Promise(resolve => {
      // A worker that stops answering is ended, as a newer drawing ends it.
      const timer = setTimeout(() => { cancel() }, SILENCE)
      pending = { id, resolve: answer => { clearTimeout(timer); resolve(answer) }, onSketch, sketch: null }
      live.postMessage({ id, sequence, base, separate, fontStyle, loaders: loaders ?? {} })
    })
  }
  return { draw, cancel, warm, dispose: () => { cancel(); end() } }
}
