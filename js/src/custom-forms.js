// @ts-nocheck
// Components no code point names, cut from the characters that write them (ids-input's
// scripts/build_custom_cuts.py): a form for each, and a library of every host cut by place, which the
// composer reads as it reads an encoded component's hosts. Loaded once a sequence names one.
import { addCutForms } from './component-forms.js'
import constants from './constants.json' with { type: 'json' }
import { customAt, strokeChain } from './tree.js'
import { pageLoader } from './unicode.js'

export const CUSTOM_FORMS = 'custom-forms.json.gz'
/** Whether a sequence names a component the file may hold: a CHISE entity (&CDP-8958;) or a zi.tools
 *  stroke chain (#(丿𠃊)) the grammar gives no character. @param {string} text */
export function hasCustomComponent(text) {
  const chars = [...text]
  for (let at = 0; at < chars.length; at++) {
    const found = customAt(chars, at)
    if (found && found.kind !== 'numbered' && !(found.kind === 'chain' && strokeChain(chars, at))) return true
  }
  return false
}

let loaded = null
/** The file, read once: its forms joined to the component forms. A file that cannot be read, or reads
 *  empty, is asked for again by the next drawing. @param {() => Promise<any>} load */
async function read(load) {
  loaded ??= load().then(data => {
    if (!data?.forms) throw new Error(`${CUSTOM_FORMS}: no forms`)
    addCutForms(data)
    return data
  })
  return loaded.catch(() => { loaded = null; return null })
}

/** An export host entry as the composer takes it (`loader.js`): the cut's fields beside the entry's. */
const cutEntry = h => h.c === null ? { ...h } : { ...h, ...h.c, c: true }

/**
 * A source over `fallback` that answers the hosts of the components the file holds, in `style`, and
 * names their places in the manifest's host list; everything else is the fallback's. A description
 * that needs none of them still draws when the file cannot be read.
 * @param {{ fallback?: any, load?: () => Promise<any>, style?: string }} options
 */
export function customFormsSource({ fallback = null, load = () => pageLoader(CUSTOM_FORMS), style = 'sans' } = {}) {
  let hosts = {}, ready = null
  const lists = new Map()
  /** Read the file and the fallback, then name the library's places in the manifest. Kept once the
   *  file has been read; asked again by the next drawing when it could not be. */
  async function prepare() {
    const [data] = await Promise.all([read(load), fallback?.ready()])
    hosts = data?.hosts?.[style] ?? {}
    const manifest = fallback?.manifest ?? { constants, spelled: [] }
    const listed = manifest.files?.hosts?.places
    // An export that names its host places lists only those; the library's are added to them.
    source.manifest = listed ? { ...manifest, files: { ...manifest.files, hosts: { ...manifest.files.hosts,
      places: [...listed, ...Object.entries(hosts).flatMap(([key, byPlace]) => Object.keys(byPlace).map(place => `${place}\t${key}`))] } } }
      : manifest
    source.layout = fallback?.layout ?? null
    if (!data) ready = null
  }
  const source = {
    manifest: null, layout: null,
    ready: () => ready ??= prepare().catch(error => { ready = null; throw error }),
    modelFiles: options => fallback?.modelFiles(options) ?? [],
    load: names => fallback ? fallback.load(names) : Promise.resolve(),
    filesOf: keys => fallback ? fallback.filesOf(keys.filter(key => !hosts[key])) : new Set(),
    store() {
      const remote = fallback?.store()
      return {
        manifest: source.manifest, layout: source.layout, missing: remote?.missing ?? new Set(),
        rec: key => remote?.rec(key) ?? null,
        hosts: (key, place) => {
          if (!hosts[key]) return remote?.hosts(key, place) ?? []
          const id = `${place}\t${key}`
          if (!lists.has(id)) lists.set(id, (hosts[key][place] ?? []).map(cutEntry).sort((a, b) => a.r - b.r))
          return lists.get(id)
        },
        places: key => hosts[key] ? Object.keys(hosts[key]) : remote?.places(key) ?? [],
      }
    },
  }
  return source
}
