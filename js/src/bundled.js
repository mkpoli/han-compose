// @ts-nocheck
// Overlay bundled outline records on an optional host export.
import constants from './constants.json' with { type: 'json' }

/**
 * `under` lets the export answer first, with these records filling only what it lacks.
 */
export function bundledSource({ load, matches, fallback = null, under = false, drawable = record => Boolean(record?.G), alias = key => key }) {
  // `ready()` fills `records`; callers ask for files and records after it resolves.
  let ready = null, records = null
  // `alias` names the record a key falls back to when it has none of its own.
  const keyOf = key => records?.[key] != null ? key : alias(key)
  const owns = key => matches(key) && records?.[keyOf(key)] != null
  // A record with no outline cannot draw, whatever else it says of the key.
  const answers = (key, remote) => owns(key) && !(under && drawable(remote?.rec(key)))
  const source = {
    manifest: null,
    get layout() { return fallback?.layout ?? null },
    ready() {
      return ready ??= Promise.all([load(), fallback?.ready()]).then(([data]) => {
        records = data.records
        source.manifest = fallback?.manifest ?? { constants, spelled: [] }
      }).catch(error => { ready = null; throw error })
    },
    modelFiles: options => fallback?.modelFiles(options) ?? [],
    load: names => fallback ? fallback.load(names) : Promise.resolve(),
    filesOf: keys => fallback ? fallback.filesOf(under ? keys : keys.filter(key => !owns(key))) : new Set(),
    store() {
      const remote = fallback?.store()
      return {
        manifest: source.manifest, missing: remote?.missing ?? new Set(),
        get layout() { return remote?.layout ?? null },
        // A key these records answer is read from its record, as a store without a table reads it.
        identity: key => answers(key, remote) ? undefined : remote?.identity?.(key),
        rec: key => answers(key, remote) ? records[keyOf(key)] ?? null : remote?.rec(key) ?? null,
        hosts: (key, place) => answers(key, remote) ? [] : remote?.hosts(key, place) ?? [],
        places: key => answers(key, remote) ? [] : remote?.places(key) ?? [],
        kin: () => remote?.kin?.() ?? null,
      }
    },
  }
  return source
}
