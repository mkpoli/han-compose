// @ts-check
// Outlines a host supplies for entity references (`&CDP-8BD0;`, `&GW-u58ec-var-001;`): glyphs of a
// set the host knows and no export or bundled file draws. One record per reference, in the export's
// record format, read from the file the host lists as `host/outlines.json.gz`.
import { bundledSource } from './bundled.js'

/** The path a host lists its outlines under, in `loaders`. */
export const HOST_OUTLINES = 'host/outlines.json.gz'

/** Whether a sequence names an entity reference, the only keys a host's outlines answer for.
 *  @param {string} sequence */
export const hasEntity = sequence => /&[A-Za-z][A-Za-z0-9+_-]*;/.test(sequence)

/** The host's records over `fallback`; a reference the file does not hold is left to `fallback`.
 *  @param {{ load: () => Promise<any>, fallback?: any }} options */
export const hostSource = ({ load, fallback = null }) => bundledSource({
  load: async () => ({ records: (await load())?.records ?? {} }),
  matches: (/** @type {string} */ key) => hasEntity(key),
  fallback,
})
