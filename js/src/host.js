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
  // A record with no outline draws nothing, and is left to what is beneath.
  load: async () => ({ records: Object.fromEntries(Object.entries((await load())?.records ?? {}).filter(([, record]) => record?.G)) }),
  matches: (/** @type {string} */ key) => hasEntity(key),
  fallback,
})

/** Registered glyphs supplied by a host for faces whose export lacks a sequence.
 * @param {{ load: () => Promise<any>, fallback?: any }} options */
export const hostVariantSource = ({ load, fallback = null }) => bundledSource({
  load: async () => {
    const data = await load()
    const records = Object.fromEntries(Object.entries(data?.aliases ?? {}).flatMap(([sequence, reference]) => {
      const record = data.records?.[String(reference)]
      return record?.G ? [[sequence, record]] : []
    }))
    return { records }
  },
  matches: (/** @type {string} */ key) => hasIdeographicSelector(key),
  under: true, fallback,
})

/** @param {string} text */
export const hasIdeographicSelector = text => /[\p{Unified_Ideograph}][\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/u.test(text)
