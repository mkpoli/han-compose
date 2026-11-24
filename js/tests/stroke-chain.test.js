import { expect, it } from 'bun:test'
import { compose, createSource } from '../src/loader.js'
import { chainForm, chainRoom, parseChain, solveChain } from '../src/stroke-chain.js'
import { character, files, records, shards } from './fixtures/small-export.js'

const strokes = {
  𠃌: character('𠃌', [[100, 740, 900, 800], [840, 0, 900, 800]]),
  '㇉': character('㇉', [[100, 400, 160, 800], [100, 400, 900, 460], [840, 0, 900, 460]]),
  又: character('又', [[100, 0, 900, 800]]), 丿: character('丿', [[400, 0, 500, 800]]),
  丶: character('丶', [[300, 300, 600, 500]]), 灬: character('灬', [[100, 0, 900, 200]]),
}
const entries = { ...files, ...shards('g', Object.entries({ ...records, ...strokes })) }
const source = () => createSource(async name => entries[name] === undefined ? null : new Uint8Array(Buffer.from(entries[name])).buffer)
const BIRD = '#(-𠃌㇉)'
/** The x or y line each vertex of stroke `i` stands on. */
const along = (solved, i, axis) => solved.strokes[i].at.map(v => solved[axis].get(solved[axis === 'x' ? 'xs' : 'ys'].find(v)))

it('reads strokes, reversal, crossing, break and closing', () => {
  expect(parseChain('#(-𠃌㇉)').strokes.map(s => [s.char, s.reversed])).toEqual([['𠃌', true], ['㇉', false]])
  expect(parseChain('#(-𠃌𠃊x0)').strokes[1].cross).toBe(0)
  expect(parseChain('#(-丨b𠃌)').strokes.map(s => s.char)).toEqual(['丨', '𠃌'])
  expect(parseChain('#(-𠃊𠃍z)').closed).toBe(true)
  expect(parseChain('#(SHP)').strokes.map(s => s.char)).toEqual(['𠃊', '丿'])
  expect(parseChain('#(木)')).toBeNull()
})

it('sets the frame of 乌 with its bar under the counter and its wall outside it', () => {
  const solved = solveChain(BIRD)
  const [x, y] = ['x', 'y'].map(axis => [along(solved, 0, axis), along(solved, 1, axis)])
  // Both strokes leave the top-left corner.
  expect([x[0][0], y[0][0]]).toEqual([x[1][0], y[1][0]])
  // y runs down: the second bar lies below the end of 𠃌.
  expect(y[1][1]).toBeGreaterThan(y[0][2])
  expect(x[1][2]).toBeGreaterThan(x[0][1])
})

it('crosses the strokes a chain says cross and closes a closed one', () => {
  expect(solveChain('#(-𠃌𠃊x0)').cost).toBeLessThan(40)
  const box = solveChain('#(-𠃊𠃍z)')
  expect(box.points.find(box.strokes[0].at[2])).toBe(box.points.find(box.strokes[1].at[2]))
})

it('gives each enclosure its own counter', () => {
  const solved = solveChain(BIRD)
  const inside = chainRoom(solved, 'LRBT'), under = chainRoom(solved, 'RT', [inside])
  expect(under[3]).toBeLessThanOrEqual(inside[1])
})

it('draws no chain with a stroke it has no glyph for', () => {
  expect(chainForm(BIRD, () => null)).toBeNull()
})

it('draws a chain alone and inside a description', async () => {
  const alone = await compose(source(), BIRD)
  expect(alone.parts.map(p => p.origin)).toEqual([`chain ${BIRD}`, `chain ${BIRD}`])
  const { parts } = await compose(source(), `⿰又⿱丿⿹⿴${BIRD}丶灬`)
  const box = end => parts.find(p => p.origin.endsWith(end)).box
  const frame = parts.filter(p => p.origin === `chain ${BIRD}`)
  expect(frame).toHaveLength(2)
  const [, dy, , dh] = box('丶'), [, fy] = box('灬')
  // 丶 in the upper counter, 灬 under the bar.
  expect(dy + dh).toBeLessThan(fy)
})
