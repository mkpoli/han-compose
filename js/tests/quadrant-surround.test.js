import { expect, test } from 'bun:test'
import { Composer } from '../src/compose.js'
import { drawnBox, scaleOf } from '../src/geometry.js'
import { compose, createSource } from '../src/loader.js'
import { character, files, shards } from './fixtures/small-export.js'

const cross = [[450, 0, 550, 1000], [0, 450, 1000, 550]]
const inners = [[[0, 0, 60, 800]], [[0, 0, 800, 60]],
  [[0, 0, 800, 60], [370, 60, 430, 300]], [[0, 0, 400, 800]]]
async function composer(outer, inner, op = '⿺', turn = '') {
  const records = { '\uE000': character('\uE000', outer), '\uE001': character('\uE001', inner) }
  const input = { ...files, ...shards('g', Object.entries(records)) }
  const source = createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
  await source.ready()
  await source.load(source.filesOf(Object.keys(records)))
  await compose(source, `${op}\uE000${turn}\uE001`, { face: [0, 0, 1000, 1000] })
  return new Composer(source.store(), { face: [0, 0, 1000, 1000], hosted: false })
}

for (const op of ['⿺', '⿸', '⿹', '⿽']) for (const [i, inner] of inners.entries()) {
  for (const region of [[0, 0, 1000, 1000], [100, 200, 500, 800]]) {
    test(`${op} cross with inner ${i} in ${region}`, async () => {
      const c = await composer(cross, inner, op)
      const parts = c.node([op, '\uE000', '\uE001'], region)
      c.balance(parts)
      const [outer, inside] = parts
      expect(outer.target).toEqual(c.node('\uE000', region)[0].target)
      expect(outer.weight).toEqual([0, 0])
      const room = c.room(op, [outer], region), box = drawnBox(inside)
      expect(box[0]).toBeGreaterThan(room[0])
      expect(box[1]).toBeGreaterThan(room[1])
      expect(box[2]).toBeLessThan(room[2])
      expect(box[3]).toBeLessThan(room[3])
      const [sx, sy] = scaleOf(inside)
      expect(sx).toBeCloseTo(sy, 10)
      expect(c.collide([outer], [inside], region, 256)).toBe(0)
      const cx = (outer.target[0] + outer.target[2]) / 2, cy = (outer.target[1] + outer.target[3]) / 2
      expect(['⿺', '⿸'].includes(op) ? box[0] > cx : box[2] < cx).toBe(true)
      expect(['⿺', '⿽'].includes(op) ? box[1] > cy : box[3] < cy).toBe(true)
    })
  }
}
for (const [op, bar] of [['⿸', [0, 900, 1000, 1000]], ['⿺', [0, 0, 1000, 100]]]) {
  test(`${op} T junction`, async () => {
    const c = await composer([cross[0], bar], inners[2])
    const parts = c.quadrantSurround(op, ['\uE000', '\uE001'], c.face)
    expect(parts).not.toBeNull()
    expect(c.collide(parts.slice(0, 1), parts.slice(1), c.face, 256)).toBe(0)
  })
}
for (const [i, outer] of [
  [[0, 0, 100, 1000], [0, 900, 1000, 1000]],
  [[0, 0, 100, 1000], [0, 0, 1000, 100]],
  [...cross, [0, 0, 1000, 100]], [...cross, [0, 0, 300, 300]],
].entries()) test(`ordinary frame or complex shape ${i}`, async () => {
  const c = await composer(outer, inners[0])
  for (const op of ['⿺', '⿸', '⿹', '⿽', '⿻', '⿴'])
    expect(c.quadrantSurround(op, ['\uE000', '\uE001'], c.face)).toBeNull()
})

for (const op of ['⿺', '⿸', '⿹', '⿽']) for (const turn of ['⿾', '⿿']) {
  test(`${op} keeps a ${turn} operand inside its quadrant`, async () => {
    const c = await composer(cross, [[0, 0, 100, 800], [0, 0, 600, 100]], op, turn)
    const parts = c.quadrantSurround(op, ['\uE000', [turn, '\uE001']], c.face)
    const room = c.room(op, parts.slice(0, 1), c.face), box = drawnBox(parts[1])
    expect(box[0]).toBeGreaterThan(room[0])
    expect(box[1]).toBeGreaterThan(room[1])
    expect(box[2]).toBeLessThan(room[2])
    expect(box[3]).toBeLessThan(room[3])
    expect(c.collide(parts.slice(0, 1), parts.slice(1), c.face, 256)).toBe(0)
  })
}

test('an excluded cross does not supply its glyph', async () => {
  const c = await composer(cross, inners[0])
  const excluded = new Composer(c.data, { exclude: ['\uE000'] })
  expect(excluded.quadrantSurround('⿺', ['\uE000', '\uE001'], c.face)).toBeNull()
})

test('an excluded inner uses normal component resolution', async () => {
  const c = await composer(cross, inners[0])
  const excluded = new Composer(c.data, { exclude: ['\uE001'] })
  const nodes = []
  excluded.node = (node, region) => { nodes.push(node); return c.node('\uE001', region) }
  expect(excluded.quadrantSurround('⿺', ['\uE000', '\uE001'], c.face)).not.toBeNull()
  expect(nodes).toEqual(['\uE001'])
})
