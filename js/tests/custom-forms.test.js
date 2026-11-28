import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { addCutForms, componentDrawing, isComponentForm } from '../src/component-forms.js'
import { hasCustomComponent } from '../src/custom-forms.js'
import { compose, createSource } from '../src/loader.js'
import { sourceFor, traitsOf } from '../src/source.js'
import componentDonors from './fixtures/chain-component-donors.json' with { type: 'json' }
import sansChains from './fixtures/sans-chain-turns.json' with { type: 'json' }
import { files, records, shards } from './fixtures/small-export.js'

const data = JSON.parse(gunzipSync(readFileSync(new URL('../data/custom-forms.json.gz', import.meta.url))).toString('utf8'))
// &CDP-8958; is 冐 without ⺜ in both faces; #(-𠃍㇉) has a form written by hand.
const ENTITY = '&CDP-8958;'

it('names the sequences that call for the cut forms', () => {
  for (const text of ['⿰木&CDP-8958;', '⿱#(丿𠃊)卩']) expect(hasCustomComponent(text)).toBe(true)
  // A numbered component has its own forms, a chain the grammar names is a character, and an entity
  // spelled another way is no CHISE reference: none of them asks for the file.
  for (const text of ['⿰木口', '木', '⿱丿乚', '⿰亻{53}', '⿰亻#(H)', '⿰亻&#x4E00;']) expect(hasCustomComponent(text)).toBe(false)
  expect(traitsOf('⿰木&CDP-8958;').custom).toBe(true)
  expect(traitsOf('⿰木口').custom).toBe(false)
})

it('draws a component no code point names from the form cut for it', async () => {
  expect(data.format).toBe('han-compose/custom-forms')
  expect(data.version).toBe(2)
  expect(isComponentForm(ENTITY, 'sans')).toBe(false)
  const handWritten = componentDrawing('#(-𠃍㇉)', 'sans')?.d
  addCutForms(data)
  for (const style of ['sans', 'serif']) {
    expect(isComponentForm(ENTITY, style)).toBe(true)
    expect(componentDrawing(ENTITY, style)?.d).toMatch(/^M/)
  }
  // Kaisho and Fangsong draw only their own forms; a form written by hand is not replaced.
  expect(isComponentForm(ENTITY, 'pen-writing')).toBe(false)
  expect(componentDrawing('#(-𠃍㇉)', 'sans')?.d).toBe(handWritten)
  const source = createSource(async name => files[name] === undefined ? null : new Uint8Array(Buffer.from(files[name])).buffer)
  const { parts } = await compose(source, `⿰木${ENTITY}`, { fontStyle: 'sans' })
  expect(parts.some(part => part.origin === `${data.forms.sans[ENTITY].face}: ${ENTITY}, cut from ${data.forms.sans[ENTITY].from}`)).toBe(true)
})

it('draws what it can when the cut forms cannot be read, and asks again next time', async () => {
  const { customFormsSource } = await import('../src/custom-forms.js')
  let calls = 0
  const failing = customFormsSource({ load: async () => { calls++; return {} } })
  await failing.ready()
  const again = customFormsSource({ load: async () => { calls++; throw new Error('offline') } })
  await again.ready()
  expect(calls).toBe(2)
})

it('serves each component host cuts by place, as an export serves an encoded component', async () => {
  const { customFormsSource } = await import('../src/custom-forms.js')
  const { createSource } = await import('../src/loader.js')
  const { files } = await import('./fixtures/small-export.js')
  const fallback = createSource(async name => files[name] === undefined ? null : new Uint8Array(Buffer.from(files[name])).buffer)
  const source = customFormsSource({ fallback, load: async () => data, style: 'sans' })
  await source.ready()
  const store = source.store()
  const places = store.places(ENTITY)
  expect(places).toEqual(Object.keys(data.hosts.sans[ENTITY]))
  const [first] = store.hosts(ENTITY, places[0])
  // Flattened as the export's entries are: the cut's box and outlines beside the host.
  expect(first.c).toBe(true)
  expect(first.h).toBe(data.hosts.sans[ENTITY][places[0]][0].h)
  expect(first.b).toHaveLength(4)
  expect(first.p.length).toBeGreaterThan(0)
  // The layout reads the component's usual boxes and shape from its form's record.
  const { componentRecord } = await import('../src/component-forms.js')
  expect(componentRecord(ENTITY, 'sans').u[places[0]][2]).toBe(data.hosts.sans[ENTITY][places[0]].length)
  expect(componentRecord(ENTITY, 'sans').f).toHaveLength(71)
})

it('draws a description that names one through the source a page asks for', async () => {
  // The source of such a description is the cut forms over the rest: it names the model files of
  // what is beneath, which a description with an operator asks every source for.
  const base = 'https://example.org/export/'
  const fetch = async url => { const file = files[String(url).slice(base.length)]; return file === undefined ? new Response('', { status: 404 }) : new Response(file) }
  const text = `⿰木${ENTITY}`
  const drawn = await compose(sourceFor(text, { base, fetch }), text, { fontStyle: 'sans' })
  expect(drawn.parts.length).toBeGreaterThan(1)
  const { customFormsSource } = await import('../src/custom-forms.js')
  expect(customFormsSource({ load: async () => data }).modelFiles()).toEqual([])
  expect(customFormsSource({ load: async () => data, fallback: { modelFiles: () => ['identity'] } }).modelFiles()).toEqual(['identity'])
})

it('prefers the selected face’s 之 over a cached Plangothic cut on the public source path', async () => {
  const key = '#(㇇乀)'
  const options = { fontStyle: 'sans', read: async () => data }
  const fallback = await compose(sourceFor(key, options), key)
  expect(fallback.origins).toEqual(['Plangothic P2: #(㇇乀), cut from 𱦍'])

  // Noto Sans CJK JP 2.004 (SIL OFL 1.1), as encoded by format 7.
  const fixture = { ...files, ...shards('g', Object.entries({ ...records, 之: { G: sansChains.之 } })) }
  const exported = createSource(async name => fixture[name] === undefined ? null : new Uint8Array(Buffer.from(fixture[name])).buffer)
  const native = await compose(sourceFor(key, { ...options, exported }), key)
  expect(native.origins).toEqual(['chain #(㇇乀), cut from 之'])
  expect(native.d).not.toBe(fallback.d)
})

it('prefers the native flat turn of 乐 inside a printed row or enclosure', async () => {
  const turn = '#(丿𠃊)', origin = 'chain #(丿𠃊), cut from 乐'
  const fixture = { ...files, ...shards('g', Object.entries({ ...records, 乐: { G: componentDonors.sans.乐 } })) }
  const exported = createSource(async name => fixture[name] === undefined ? null : new Uint8Array(Buffer.from(fixture[name])).buffer)
  for (const ids of ['⿰' + turn + '木', '⿸' + turn + '木']) {
    const source = sourceFor(ids, { fontStyle: 'sans', read: async () => data, exported })
    const drawn = await compose(source, ids)
    expect(drawn.origins).toContain(origin)
    const fallback = await compose(source, ids, { exclude: ['乐'] })
    expect(fallback.origins).toContain('Noto Sans CJK JP: #(丿𠃊), cut from 卬')
  }
})
