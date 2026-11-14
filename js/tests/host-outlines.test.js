import { afterEach, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import { compose } from '../src/loader.js'
import { sourceFor, traitsOf } from '../src/source.js'
import { HOST_OUTLINES, hasEntity, hostSource } from '../src/host.js'

const palette = JSON.parse(gunzipSync(readFileSync(new URL('../data/sources/palette/outlines.json.gz', import.meta.url))))
const [borrowed] = Object.values(palette.records)
const NAME = '&GW-u58ec-var-001;'
const real = globalThis.fetch
afterEach(() => { globalThis.fetch = real })

describe('outlines a host supplies', () => {
  it('draw an entity reference as a component', async () => {
    const source = hostSource({ load: async () => ({ records: { [NAME]: borrowed } }) })
    const drawn = await compose(source, `⿰${NAME}⬚`, { separate: true })
    expect(drawn.origins).toContain(`glyph ${NAME}`)
    expect(drawn.parts[0].d.length).toBeGreaterThan(10)
  })
  it('leave a reference the file does not hold, and every other component, to what is beneath', async () => {
    const beneath = {
      manifest: { constants: {} }, layout: null,
      ready: async () => {}, load: async () => {}, filesOf: keys => new Set(keys),
      store: () => ({ manifest: {}, layout: null, missing: new Set(), rec: key => ({ marker: key }), hosts: () => [], places: () => [] }),
    }
    const source = hostSource({ load: async () => ({ records: { [NAME]: borrowed } }), fallback: beneath })
    await source.ready()
    const store = source.store()
    expect(store.rec(NAME)).toBe(borrowed)
    expect(store.rec('&CDP-8BD0;')).toEqual({ marker: '&CDP-8BD0;' })
    expect(store.rec('木')).toEqual({ marker: '木' })
    expect([...source.filesOf([NAME, '木'])]).toEqual(['木'])
  })
  it('are read only for a sequence that names an entity, at the URL the host lists', async () => {
    expect(hasEntity(`⿰${NAME}木`)).toBe(true)
    expect(hasEntity('⿰木&')).toBe(false)
    expect(traitsOf(`⿰${NAME}⬚`).entity).toBe(true)
    const asked = []
    globalThis.fetch = async url => {
      asked.push(String(url))
      return String(url) === 'http://host/outlines' ? new Response(gzipSync(JSON.stringify({ records: { [NAME]: borrowed } }))) : real(url)
    }
    const loaders = { [HOST_OUTLINES]: 'http://host/outlines' }
    const drawn = await compose(sourceFor(`⿰${NAME}⬚`, { bundled: true, loaders }), `⿰${NAME}⬚`, { separate: true })
    expect(asked).toContain('http://host/outlines')
    expect(drawn.origins).toContain(`glyph ${NAME}`)
    asked.length = 0
    const tangut = '\u{17000}'
    await compose(sourceFor(tangut, { bundled: true, loaders }), tangut)
    expect(asked).not.toContain('http://host/outlines')
  })
  it('leave a record with no outline to what is beneath', async () => {
    const beneath = {
      manifest: { constants: {} }, layout: null,
      ready: async () => {}, load: async () => {}, filesOf: keys => new Set(keys),
      store: () => ({ manifest: {}, layout: null, missing: new Set(), rec: key => ({ marker: key }), hosts: () => [], places: () => [] }),
    }
    for (const records of [{ [NAME]: { k: NAME, G: null } }, null, 'no records']) {
      const source = hostSource({ load: async () => ({ records }), fallback: beneath })
      await source.ready()
      expect(source.store().rec(NAME)).toEqual({ marker: NAME })
    }
  })
  it('change nothing where the host lists no file', async () => {
    const source = sourceFor(`⿰${NAME}⬚`, { bundled: true })
    await source.ready()
    expect(source.store().rec(NAME)).toBeNull()
  })
})
