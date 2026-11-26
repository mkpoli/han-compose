import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { addCutForms } from '../src/component-forms.js'
import { drawingChain } from '../src/chain-corrections.js'
import { sourceFor } from '../src/source.js'
import catalogue from '../src/recorded-chains.json'
import { parseChain, solveChain } from '../src/stroke-chain.js'
import { compose, createSource } from '../src/loader.js'
import { character, files, records, shards } from './fixtures/small-export.js'

it('resolves the topology of every pinned spelling, including corrected historical descriptions', () => {
  const broken = Object.keys(catalogue.chains).filter(key => solveChain(key)?.broken !== 0)
  expect(broken).toEqual([])
}, 30_000)

const data = { ...files, ...shards('g', Object.entries({ ...records,
  厂: character('厂', [[100, 300, 700, 790]]),
  一: character('一', [[100, 380, 900, 430]]),
  丿: character('丿', [[150, 0, 270, 780]]),
})) }
const source = () => createSource(async name => data[name] === undefined ? null : new Uint8Array(Buffer.from(data[name])).buffer)

it('selects an attested own glyph and respects exclusion of its donor or a constituent', async () => {
  const chain = '#(-一丿)'
  const d = await compose(source(), chain)
  expect(d.origins).toEqual([`chain ${chain}, glyph 厂`])
  const alternate = await compose(source(), chain, { exclude: ['厂'] })
  expect(alternate.origins).toEqual([`chain ${chain}`, `chain ${chain}`])
  expect(compose(source(), chain, { exclude: ['一'] })).rejects.toThrow()
})

it('composes every pinned spelling with a local fixture in all five faces', async () => {
  const chains = Object.keys(catalogue.chains)
  const strokes = new Set(chains.flatMap(key => parseChain(key)?.strokes.map(stroke => stroke.char) ?? []))
  const data = { ...files, ...shards('g', Object.entries({
    ...records,
    ...Object.fromEntries([...strokes].map(char => [char, character(char, [[100, 20, 900, 780]])])),
  })) }
  const failures = []
  const centres = { sans: [80, 82], serif: [68, 33], regular: [49, 53], fangsong: [59, 45], 'pen-writing': [54, 51] }
  for (const [fontStyle, widths] of Object.entries(centres)) {
    const manifest = JSON.parse(data['manifest.json'])
    manifest.constants.stem = widths.map(width => [width, width + 40])
    const fixture = { ...data, 'manifest.json': JSON.stringify(manifest) }
    const local = createSource(async name => fixture[name] === undefined ? null : new Uint8Array(Buffer.from(fixture[name])).buffer)
    for (const raw of chains) {
      try {
        const drawn = await compose(local, raw, { fontStyle })
        if (!drawn.d || drawn.missing?.length) failures.push([fontStyle, raw, 'missing ink'])
      } catch (error) {
        failures.push([fontStyle, raw, error.message])
      }
    }
  }
  expect(failures).toEqual([])
}, 30_000)

it('keeps every stroke of an unencoded chain in its single editable cell', async () => {
  const key = '#(-一丿)'
  const result = await compose(source(), key, { layout: 'cells', separate: true, exclude: ['厂'] })
  expect(result.cells).toBe(true)
  expect(result.parts).toHaveLength(2)
  expect(result.parts.map(p => p.leaf)).toEqual([0, 0])
})

it('prefers the selected face’s 之 over a cached Plangothic cut on the public source path', async () => {
  const key = '#(㇇乀)'
  const cuts = JSON.parse(gunzipSync(readFileSync(new URL('../data/custom-forms.json.gz', import.meta.url))))
  addCutForms(cuts)
  const options = { fontStyle: 'sans', read: async () => cuts }
  const fallback = await compose(sourceFor(key, options), key)
  expect(fallback.origins).toEqual(['Plangothic P2: #(㇇乀), cut from 𱦍'])

  // Noto Sans CJK JP 2.004 (SIL OFL 1.1), as encoded by format 7.
  const zhi = {"b": [31.08, -78.75, 962.97, 838.53], "p": [["MLLL", "hwEHCiINBwoiDeEIhwHhCA==", "5f+JAHr/iQB6/3f/5f93/w=="], ["MLLL", "LgcaDWIIGg1iCIgJLgeICQ==", "bv9CAJIAQgCSAPT/bv/0/w=="], ["MLLLQ5Q3Q5", "wQwHCgQNBwpCDRkKIw6JCWgNWghhC98FBAl+A4EGcgFMBbEAJAXjAKkEWgFyBIEBnwU2Ag4ILgRQCnMGKgy8CMEMvQk=", "J/+JAGT/iQCa/5cAdQAPAHAA9v+LAOX/sADe/9cA0v/gAMP/vADx/0cAZgAWAIsABQCSAMr/jgCE/3UAQv9YACf/RwA="], ["MQ4Q6Q4LLQ4", "/ANkA44ECQKXBqcAWwksAAMLLAAtCywA8QssAPMMLAD7DSwA1A4tAAwPLwD1DgwAxg6g/6QOMP+cDgX/yw0F//IKBf8CCQX/9QWi/7YDVwH6AvkC", "4ABYANIAiwC1AMEAdQDUADEA1ABHANQARwDUADEA1AAdANQAIADXADgA2QAnALwAAgBYAOj/7P/g/8P/+f/D/xYAw/8iAMP/GwDS//7/8f/q/wcA"], ["MLQ4LQ4", "oAHF/nwAcf8LASUAJgL5ARgD6QNnA8AEjARNBD4ElANUA6sBOQKq/6ABxf4=", "1ADD/7z/fwDB/3MAvv9rALT/cwCt/3wA1AAbANIAGADUAPn/1wDS/9QAw/8="]], "v": 1}
  const fixture = { ...files, ...shards('g', Object.entries({ ...records, 之: { G: zhi } })) }
  const exported = createSource(async name => fixture[name] === undefined ? null : new Uint8Array(Buffer.from(fixture[name])).buffer)
  const native = await compose(sourceFor(key, { ...options, exported }), key)
  expect(native.origins).toEqual(['chain #(㇇乀), cut from 之'])
  expect(native.d).not.toBe(fallback.d)
})

it('reads the historical 𢏽(T) and 𤕈(T) components in their attested positions', async () => {
  for (const [old, modern, evidence] of [
    ['#(𠄌一𠃑v^)', '#(𠃑-一𠄌)', 'u2ffb-cdp-8bbf-u531a-01-var-002'],
    ['#(丿丿乀乀^>v,0>3)', '#(-乀-丿乀丿z)', 'small-diamond'],
  ]) {
    expect(drawingChain(old)).toBe(modern)
    const form = await compose(source(), old, { fontStyle: 'fangsong' })
    expect(form.origins[0]).toContain(evidence)
  }
})
