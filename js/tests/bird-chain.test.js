import { expect, it } from 'bun:test'
import { pathMask, pathRings, pointsBox } from '../src/geometry.js'
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

it('keeps the shop sign’s five editable bird parts on a cold load', async () => {
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

it('fits the Sans four-dot row under the standalone frame', async () => {
  const data = source(Object.fromEntries(Object.entries(nativeDonors.glyphs).map(([ch, G]) => [ch, { G }])))
  const foot = `⿹⿴${CHAIN}丶灬`
  const size = 512
  for (const sequence of [foot, `⿱丿${foot}`]) {
    const { parts } = await compose(data, sequence, { separate: true })
    const dots = parts.at(-1)
    const frameInk = pathMask(parts.at(-3).d, size), dotInk = pathMask(dots.d, size)
    let clearance = Infinity
    for (let x = 0; x < size; x++) {
      let lastInk = -1
      for (let y = 0; y < size; y++) {
        const pixel = y * size + x
        if (frameInk[pixel]) lastInk = y
        if (!dotInk[pixel]) continue
        if (lastInk >= 0) clearance = Math.min(clearance, y - lastInk - 1)
        break
      }
    }
    // The smallest vertical gap in Noto Sans 鳮 is 23 units for a
    // 260-unit dot row. Allow for raster rounding at half an em.
    const expected = 23 / 260 * dots.box[3] * size / 1000
    expect(Math.abs(clearance - expected)).toBeLessThan(2)
  }
})

it('places the four right-falling marks on the ascending row of the R+0919 sign', async () => {
  const data = source(Object.fromEntries(Object.entries(nativeDonors.glyphs).map(([ch, G]) => [ch, { G }])))
  const sequence = `⿰又⿱丿⿹⿴${CHAIN}丶灬`
  const { parts } = await compose(data, sequence)
  const [left, crest, frame, , row] = parts
  const dots = pathRings(row.d).map(pointsBox)
  expect(dots).toHaveLength(4)
  expect(dots[0][2]).toBeLessThan(left.box[0] + left.box[2])
  expect(frame.box[1] - crest.box[1]).toBeGreaterThan(frame.box[3] / 5)
  for (let i = 1; i < dots.length; i++) {
    expect(dots[i][0]).toBeGreaterThan(dots[i - 1][0])
    expect(dots[i][3]).toBeGreaterThan(dots[i - 1][3])
  }
  // In the sign all four dots descend to the right, including the one under 又.
  for (const ring of pathRings(row.d)) {
    const [, bottom, , top] = pointsBox(ring)
    const middle = (top + bottom) / 2
    const high = [], low = []
    for (let j = 0; j < ring.length; j += 2) (ring[j + 1] > middle ? high : low).push(ring[j])
    expect(Math.min(...low) + Math.max(...low)).toBeGreaterThan(Math.min(...high) + Math.max(...high))
  }
})
