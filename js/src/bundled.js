// @ts-nocheck
// Overlay bundled outline records on an optional host export.
import constants from './constants.json' with { type: 'json' }

export function bundledSource({ load, matches, fallback = null }) {
  // `ready()` fills `records`; callers ask for files and records after it resolves.
  let ready = null, records = null
  const owns = key => matches(key) && records?.[key] != null
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
    filesOf: keys => fallback ? fallback.filesOf(keys.filter(key => !owns(key))) : new Set(),
    store() {
      const remote = fallback?.store()
      return {
        manifest: source.manifest, layout: source.layout, missing: remote?.missing ?? new Set(),
        rec: key => owns(key) ? records[key] ?? null : remote?.rec(key) ?? null,
        hosts: (key, place) => owns(key) ? [] : remote?.hosts(key, place) ?? [],
        places: key => owns(key) ? [] : remote?.places(key) ?? [],
      }
    },
  }
  return source
}
