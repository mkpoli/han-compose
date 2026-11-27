import { expect, it } from 'bun:test'
import { fill, groupRings, makePart, partOf } from '../src/geometry.js'
import { overlayContextDonors, overlayContextParts } from '../src/rcc-overlays.js'

import { hostChainParts } from '../src/host-chain.js'
import { nativeStroke } from '../src/stroke-donors.js'
// Format-7 outlines from the five pinned fonts, including the FangSong 冖 donor for 乛.
import hosts from './fixtures/rcc-overlay-hosts.json' with { type: 'json' }

const steps = '⿻[x_]#(㇄-𠃑)𠃊'
const em = [0, 0, 1000, 1000]
const contour = Float64Array.of(0, 0, 100, 0, 100, 100, 0, 100)
const native = makePart([{ ops: [...'MLLL'].map(op => [op, 1, false]), light: contour, heavy: contour }])
const composer = { fontStyle: 'sans', stem0: [[80, 140], [80, 140]], excluded: () => false, chainStroke: () => native, drawnGlyph: () => native }

it('places the surname headword’s crossbar through the middle upright', () => {
  const [high, step, center] = overlayContextParts(composer, steps, em)
  expect([high, step, center].map(p => p.rccLeaf)).toEqual([0, 0, 1])
  expect(high.target[0]).toBeLessThan(center.target[0])
  expect(high.target[2]).toBeGreaterThan(step.target[0])
  expect(high.target[1]).toBeGreaterThan(center.target[1] + 500)
  expect(step.target[1]).toBeCloseTo(center.target[1], 0)
})

it('checks the exact spelling and every excluded donor before drawing', () => {
  expect(overlayContextDonors('⿻#(㇄-𠃑)𠃊', 'sans')).toEqual([])
  for (const excluded of [steps, '#(㇄-𠃑)', '𠃊', '㇄', '𠃑']) {
    expect(overlayContextParts({ ...composer, excluded: k => k === excluded }, steps, em)).toBeNull()
  }
  const nine = '⿺九⿸⿻干#(-乛丿)亚'
  expect(overlayContextDonors(nine, 'serif')).toContain('亚')
  expect(overlayContextParts({ ...composer, excluded: k => k === '亚' }, nine, em)).toBeNull()
  expect(overlayContextParts({ ...composer, chainStroke: () => null }, steps, em)).toBeNull()
})


function nativeComposer(fontStyle) {
  const records = hosts[fontStyle]
  const glyphRecord = char => records[char]
  const own = char => glyphRecord(char)?.v === 1
  const face = { fontStyle, glyphRecord, own, excluded: () => false,
    drawnGlyph: char => partOf(records[char]),
    chainStroke: char => own(char) ? partOf(records[char]) : nativeStroke(char, fontStyle, glyphRecord),
    chainParts: (char, room) => hostChainParts(face, char, room, false),
  }
  return face
}

const mask = part => fill(groupRings([part]), 200, em)
const touches = (a, b) => a.some((pixel, i) => pixel && b[i])

it('draws the long 九 foot and the downward terminal of 乛 above 亚 in every face', () => {
  for (const style of Object.keys(hosts)) {
    const face = nativeComposer(style)
    const parts = overlayContextParts(face, '⿺九⿸⿻干#(-乛丿)亚', em)
    expect(parts.map(p => p.rccLeaf)).toEqual([0, 1, 2, 2, 3])
    const [nine, gan, shelf, fall, inside] = parts.map(mask)
    expect(touches(shelf, gan)).toBe(true)
    expect(touches(shelf, fall)).toBe(true)
    expect(touches(shelf, inside)).toBe(false)
    const belowTopBar = shelf.some((ink, i) => ink && i % 200 > 144 && Math.floor(i / 200) > 56)
    expect(belowTopBar, style).toBe(true)
    expect(nine.some((ink, i) => ink && i % 200 > 170 && Math.floor(i / 200) > 178)).toBe(true)
    expect(touches(nine, inside)).toBe(false)
  }
})

it('nests 日 inside 乃 and joins both 鼎 legs to 乃 in each font', () => {
  for (const style of Object.keys(hosts)) {
    const parts = overlayContextParts(nativeComposer(style), '⿱乃⿶⿰#(𠃑-一丨)#(丨-一𠃑)日', em)
    expect(parts.map(p => p.rccLeaf)).toEqual([0, 1, 2, 3])
    const [top, left, right, sun] = parts.map(mask)
    expect(touches(top, left), style + ' left').toBe(true)
    expect(touches(top, right), style + ' right').toBe(true)
    expect(touches(top, sun), style + ' center').toBe(true)
    expect(touches(left, right)).toBe(false)
  }
})

it('draws the two stepped frames and crossing bar of 註册商標 in every face', () => {
  const key = '⿻⿻⺆⺆一'
  for (const style of Object.keys(hosts)) {
    const face = nativeComposer(style)
    const parts = overlayContextParts(face, key, em)
    expect(parts.map(p => p.rccLeaf)).toEqual([0, 1, 2])
    const [first, second, bar] = parts.map(mask)
    expect(touches(first, bar)).toBe(true)
    expect(touches(second, bar)).toBe(true)
    const wide = parts[2].target, high = parts[0].target[3], low = parts[1].target[1]
    const y = Math.floor(200 * (1 - (low + .67 * (high - low)) / 1000))
    const centers = [first, second].flatMap(m => {
      const runs = []
      for (let x = 0; x < 200; x++) {
        if (!m[200 * y + x]) continue
        if (runs.at(-1)?.[1] === x - 1) runs.at(-1)[1] = x
        else runs.push([x, x])
      }
      return runs.map(([l, r]) => (2.5 * (l + r) - wide[0]) / (wide[2] - wide[0]))
    })
    // High-left, high-right, low-left, low-right: their interleaving leaves
    // three separate counters between the roofs and the full-width bar.
    expect(centers).toHaveLength(4)
    centers.forEach((center, i) => expect(Math.abs(center - [.255, .62, .445, .815][i])).toBeLessThan(.035))
    expect(parts[0].target[3]).toBeGreaterThan(parts[1].target[3])
    expect(parts[0].target[1]).toBeGreaterThan(parts[1].target[1])
    expect(overlayContextDonors(key, style)).toEqual(['册'])
    for (const excluded of [key, '⿻⺆⺆', '⺆', '一', '册']) {
      expect(overlayContextParts({ ...face, excluded: ch => ch === excluded }, key, em)).toBeNull()
    }
    expect(overlayContextParts({ ...face, glyphRecord: () => hosts[style]['一'] }, key, em)).toBeNull()
  }
})
