import { expect, it } from 'bun:test'
import { COMPONENT_FIXES, componentFix } from '../src/component-fixes.js'
import { makePart, placed, pointsBox } from '../src/geometry.js'
import { compose, createSource } from '../src/loader.js'
import { character, files, shards } from './fixtures/small-export.js'

function rectPart(origin, source, target, boxes) {
  const contours = boxes.map(([x0, y0, x1, y1]) => {
    const light = Float64Array.from([x0, y0, x1, y0, x1, y1, x0, y1])
    return { ops: [['M', 1], ['L', 1], ['L', 1], ['L', 1]], light, heavy: light.slice(), width: null }
  })
  return placed(makePart(contours, source), source, target, 0, origin)
}

function sourceFor(chars) {
  const entries = [...chars].map(ch => [ch, character(ch, [[120, 40, 700, 740]])])
  const source = { ...files, ...shards('g', entries) }
  return createSource(async name => source[name] ? Uint8Array.from(Buffer.from(source[name])).buffer : null)
}

it('composes missing 𡥦 recursively from its three 子 in both rows', async () => {
  const source = sourceFor('子')
  for (const separate of [false, true]) {
    const drawing = await compose(source, '⿱𡥦𡥦', { fontStyle: 'pen-writing', separate })
    expect(drawing.parts.map(p => p.origin)).toEqual(Array(6).fill('cells 子'))
    const single = await compose(source, '𡥦', { fontStyle: 'pen-writing', separate })
    expect(single.parts.map(p => p.origin)).toEqual(Array(3).fill('glyph 子'))
  }
})

it('keeps a supplied glyph for 𠮚', async () => {
  const drawing = await compose(sourceFor('𠮚'), '𠮚', { fontStyle: 'pen-writing' })
  expect(drawing.parts.map(p => p.origin)).toEqual(['glyph 𠮚'])
})

it('keeps the original leaf owners in cell layout', async () => {
  const drawing = await compose(sourceFor('子'), '⿱𡥦𡥦', { layout: 'cells' })
  expect(drawing.parts.map(p => p.leaf)).toEqual([0, 0, 0, 1, 1, 1])
})

it('respects excluded components of a missing character', async () => {
  await expect(compose(sourceFor('口丶'), '𠮚', { exclude: ['口'] })).rejects.toThrow()
})

it('centers 丶 inside 口 in both FangSong and Pen for ⿴口丶', () => {
  const em = [0, 0, 1000, 1000]
  const mouth = rectPart('glyph 口', em, em, [em])
  const dot = rectPart('learned 丼', [0, 0, 200, 200], [450, 650, 650, 850], [[0, 0, 200, 200]])
  for (const fontStyle of ['fangsong', 'pen-writing']) {
    const [, placedDot] = componentFix('⿴口丶', [mouth, dot], {
      fontStyle, roomFromInk: () => [200, 200, 800, 800],
    })
    expect((placedDot.target[0] + placedDot.target[2]) / 2).toBeCloseTo(500, 5)
    expect((placedDot.target[1] + placedDot.target[3]) / 2).toBeCloseTo(500, 5)
  }
})

it('shears 口 to match 工 slant in FangSong and Regular for ⿱工口', () => {
  const em = [0, 0, 1000, 1000]
  const gong = rectPart('glyph 工', em, [0, 500, 1000, 1000], [[100, 100, 900, 200]])
  const mouth = rectPart('learned 台', em, [100, 0, 900, 450], [[100, 700, 900, 800]])
  const [, fsMouth] = componentFix('⿱工口', [gong, mouth], { fontStyle: 'fangsong', excluded: () => true }, em)
  const pts = fsMouth.part.contours[0].light
  // Shearing by a negative slope lowers the right side relative to the left side.
  expect(pts[3]).toBeLessThan(pts[1])
  expect(pointsBox(pts)[3]).toBeGreaterThan(pointsBox(pts)[1])
  const [regGong, regMouth] = componentFix('⿱工口', [gong, mouth], { fontStyle: 'regular' }, em)
  expect(regGong.part.contours[0].light[3]).toBeLessThan(regGong.part.contours[0].light[1])
  expect(regMouth.part.contours[0].light[3]).toBeLessThan(regMouth.part.contours[0].light[1])
})

it('tucks 火 up into 大’s leg arch for both FangSong and Pen 𤍾', () => {
  const em = [0, 0, 1000, 1000]
  const parts = ['learned 禁', 'glyph 大', 'host 炎'].map(o => rectPart(o, em, em, [em]))
  for (const key of ['⿱林𤆍', '⿱林⿱大火']) {
    for (const fontStyle of ['fangsong', 'pen-writing']) {
      const [forest, big, fire] = COMPONENT_FIXES[key].apply(parts, { fontStyle }, em)
      expect(forest.target[1]).toBeGreaterThan(550)
      expect(fire.target[3]).toBeGreaterThan(big.target[1] + 100)
      expect(fire.target[3]).toBeLessThan(big.target[3])
    }
  }
})
