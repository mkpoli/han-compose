import { expect, it } from 'bun:test'
import { Composer } from '../src/compose.js'
import { compose, createSource, sketch } from '../src/loader.js'
import nativeDonors from './fixtures/bird-donors.json'
import { birdChainChar, birdChainParts } from '../src/bird-chain.js'
import { character, constants, files, records, shards } from './fixtures/small-export.js'

const CHAIN = '#(-𠃌㇉)'
const WU = `⿱丿⿹${CHAIN}一`
const DAO = `⿱丿⿹⿴${CHAIN}丶山`
const exact = [[WU, '乌'], [DAO, '岛'], [`⿳丿⿴${CHAIN}丶几`, '凫'], [`⿳丿⿴${CHAIN}丶木`, '枭'], [`⿳丿⿴${CHAIN}丶衣`, '袅']]
const glyphs = {
  ...records,
  ...Object.fromEntries(exact.map(([, char], i) => [char, character(char, [[238 + i, 463, 742, 713], [123, 41, 837, 155 + i]])])),
  𠃌: character('𠃌', [[100, 740, 900, 800], [840, 0, 900, 800]]),
  '㇉': character('㇉', [[100, 400, 160, 800], [100, 400, 900, 460], [840, 0, 900, 460]]),
  丿: character('丿', [[400, 0, 500, 800]]),
  又: character('又', [[100, 10, 800, 750]]),
  丶: character('丶', [[330, 400, 470, 600]]),
  灬: character('灬', [[75, 10, 950, 200]]),
  一: character('一', [[100, 350, 900, 430]]),
}

const source = (overrides = {}) => {
  const entries = { ...files, ...shards('g', Object.entries({ ...glyphs, ...overrides })) }
  return createSource(async name => entries[name] === undefined ? null : new Uint8Array(Buffer.from(entries[name])).buffer)
}

it('draws attested bird-chain descriptions with the same contours and placement as their characters', async () => {
  const data = source()
  for (const [sequence, char] of exact) {
    for (const face of [null, [100, 90, 700, 540]]) {
      const direct = await compose(data, char, { face })
      const described = await compose(data, sequence, { face })
      expect(described.parts).toEqual(direct.parts)
      expect(described.stroke).toEqual(direct.stroke)
    }
  }
})

it('matches only the complete unmodified descriptions', () => {
  const parser = new Composer({ manifest: { constants } })
  for (const seq of [CHAIN, `⿹⿴${CHAIN}丶山`, `⿱丿⿹⿴[1]${CHAIN}丶山`, `⿱丿⿹⿴${CHAIN}丶灬`, `⿰又${DAO}`]) {
    expect(birdChainChar(parser.parse(seq))).toBeNull()
  }
})

it('keeps the operand drawing for exclusions, separated editing, and missing native glyphs', async () => {
  const data = source()
  const fallback = { ...glyphs.乌, G: { ...glyphs.乌.G, v: 0 } }
  for (const [exported, options] of [[data, { separate: true }], [data, { exclude: ['乌'] }], [source({ 乌: fallback }), {}]]) {
    const drawing = await compose(exported, WU, options)
    expect(drawing.origins).not.toContain('glyph 乌')
    expect(drawing.origins).toContain(`chain ${CHAIN}`)
  }
})

it('places a nested whole glyph through the ordinary component placement', () => {
  const composer = new Composer({ manifest: { constants }, rec: key => glyphs[key] ?? null })
  const region = [60, 90, 650, 710]
  expect(birdChainParts(composer, composer.parse(DAO), region, false)).toEqual(composer.node('岛', region))
})

it('keeps the five editable bird parts in the native 鸡 silhouette on a cold load', async () => {
  const native = nativeDonors.glyphs
  const overrides = Object.fromEntries(Object.entries(native).map(([ch, G]) => [ch, { G }]))
  const target = `⿰又⿱丿⿹⿴${CHAIN}丶灬`
  const data = source(overrides)
  const { parts } = await compose(data, target, { separate: true })
  expect(parts.map(p => p.origin)).toEqual(['host 鸡', 'host 鸡', 'host 鸡', 'host 鸡', 'host 鳮'])
  expect(parts[4].d.match(/M/g)).toHaveLength(4)
  const boxes = (await sketch(source(overrides), target)).map(p => p.box)
  for (const [i, part] of parts.entries()) {
    for (const [j, coordinate] of part.box.entries()) expect(boxes[i][j]).toBeCloseTo(coordinate, 1)
  }
  expect((await compose(data, target)).parts).toEqual(parts)
  const changed = Object.assign({}, overrides.鸡, { G: { ...native.鸡, p: [...native.鸡.p].reverse() } })
  for (const [exported, options] of [[source({ ...overrides, 鸡: changed }), {}], [data, { exclude: ['鸡'] }]]) {
    const drawing = await compose(exported, target, options)
    expect(drawing.origins).not.toContain('host 鸡')
  }
})
