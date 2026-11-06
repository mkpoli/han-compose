// @ts-nocheck
// Overlay bundled outline records on an optional host export.
import constants from './constants.json' with { type: 'json' }

/**
 * `under` lets the export answer first, with these records filling only what it lacks.
 */
export function bundledSource({ load, matches, fallback = null, under = false }) {
  // `ready()` fills `records`; callers ask for files and records after it resolves.
  let ready = null, records = null
  const owns = key => matches(key) && records?.[key] != null
  // A record with no outline cannot draw, whatever else it says of the key.
  const answers = (key, remote) => owns(key) && !(under && remote?.rec(key)?.G)
  const source = {
    manifest: null, layout: null,
    ready() {
      return ready ??= Promise.all([load(), fallback?.ready()]).then(([data]) => {
        records = data.records
        source.manifest = fallback?.manifest ?? { constants, spelled: [] }
        source.layout = fallback?.layout ?? null
      }).catch(error => { ready = null; throw error })
    },
    load: names => fallback ? fallback.load(names) : Promise.resolve(),
    filesOf: keys => fallback ? fallback.filesOf(under ? keys : keys.filter(key => !owns(key))) : new Set(),
    store() {
      const remote = fallback?.store()
      return {
        manifest: source.manifest, layout: source.layout, missing: remote?.missing ?? new Set(),
        rec: key => answers(key, remote) ? records[key] ?? null : remote?.rec(key) ?? null,
        hosts: (key, place) => answers(key, remote) ? [] : remote?.hosts(key, place) ?? [],
        places: key => answers(key, remote) ? [] : remote?.places(key) ?? [],
      }
    },
  }
  return source
}
