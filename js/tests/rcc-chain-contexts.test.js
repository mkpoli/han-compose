import { expect, it } from 'bun:test'
import { partOf, pathMask, svgPath } from '../src/geometry.js'
import { rccChainContextParts, rccChainDonors } from '../src/rcc-chain-contexts.js'
// The format-7 Noto Sans CJK and TW-Kai records retain the primary faces' own strokes.
import donors from './fixtures/rcc-early-strokes.json' with { type: 'json' }

const water = '⿰氵⿱亠⿶#(𠃍-𠃊一)凵'
const tiger = '⿱⺊⿸#(-乛丿)노'
const horse = '⿱⿷#(-一丨b𠃌)𰀁乙'
const speech = '⿰讠⿹⿸⿻#(-亅一)一犬丶'
const em = [0, -120, 1000, 880]
const composer = fontStyle => ({
  fontStyle,
  excluded: () => false,
  glyphRecord: ch => donors[fontStyle][ch],
  chainStroke: ch => partOf(donors[fontStyle][ch]),
})

it('preloads the same native sources for both attested forms of the Korean entries', () => {
  for (const face of ['sans', 'serif', 'regular', 'fangsong', 'pen-writing']) {
    expect(rccChainDonors(tiger, face)).toEqual(rccChainDonors('⿸㇯虍七노', face))
    expect(rccChainDonors(horse, face)).toEqual(rccChainDonors('⿱㇯馬灬乙', face))
  }
  expect(rccChainDonors(tiger, 'fangsong')).toEqual(['虍', '凵', '丄'])
  expect(rccChainDonors(horse, 'regular')).toEqual(['馬', '乙'])
  expect(rccChainDonors('⿷#(-一丨b𠃌)𰀁', 'fangsong')).toEqual([])
})

it('rejects an excluded donor or operand before fetching contextual outlines', () => {
  for (const [key, excluded] of [[tiger, '虍'], [tiger, '노'], [horse, '𠃌'], [horse, '𰀁'], [water, '凵'], [speech, '犬']]) {
    const composer = {
      fontStyle: 'fangsong',
      excluded: char => char === excluded,
      glyphRecord: () => { throw new Error('unexpected donor lookup') },
    }
    expect(rccChainContextParts(composer, key, em)).toBeNull()
  }
})

it('requires the recorded donor outline and its own face', () => {
  for (const v of [0, 1]) {
    const composer = { fontStyle: 'fangsong', excluded: () => false, glyphRecord: () => ({ v, p: [] }) }
    expect(rccChainContextParts(composer, horse, em)).toBeNull()
  }
})

it('suspends both inner uprights from 亠 in the dictionary’s water character', () => {
  for (const face of ['sans', 'regular']) {
    const [, roof, inner, outer] = rccChainContextParts(composer(face), water, em)
    const size = 256, lid = pathMask(svgPath([roof]), size), uprights = pathMask(svgPath([inner]), size)
    const overlap = [...lid.keys()].filter(i => lid[i] && uprights[i]).map(i => i % size)
    expect(overlap.some(x => x < size * 0.64)).toBe(true)
    expect(overlap.some(x => x > size * 0.64)).toBe(true)
    expect(outer.target[0]).toBeLessThan(inner.target[0])
    expect(outer.target[1]).toBeLessThan(inner.target[1])
    expect(outer.target[3]).toBeLessThan(inner.target[3])
  }
})

it('uses the same cut body and lower stroke for both source transcriptions', () => {
  for (const [key, current] of [[tiger, '⿸㇯虍七노'], [horse, '⿱㇯馬灬乙']]) {
    const draw = id => svgPath(rccChainContextParts(composer('sans'), id, em))
    expect(draw(key)).toBe(draw(current))
  }
})

it('places the short crossbar high across the hook and the separate dot to its left', () => {
  const [, hook, roof, crossbar, dog, dot] = rccChainContextParts(composer('sans'), speech, em)
  expect(crossbar.target[0]).toBeLessThan(hook.target[0])
  expect(crossbar.target[2]).toBeGreaterThan(roof.target[0])
  expect(crossbar.target[1]).toBeGreaterThan(dot.target[3])
  expect(dot.target[2]).toBeLessThan(dog.target[0])
})

it('retains component pen widths inside the narrow slots in Sans', () => {
  const face = composer('sans')
  const [speechRadical, hook, , , dog] = rccChainContextParts(face, speech, em)
  const [drops, , inner] = rccChainContextParts(face, water, em)
  expect([drops.origin, speechRadical.origin, dog.origin]).toEqual(['氵 from 汴', '讠 from 讨', '犬 from 狀'])
  const rowWidths = (part, y) => {
    const size = 200, mask = pathMask(svgPath([part]), size)
    const row = Array.from(mask.slice(y * size, (y + 1) * size), ink => ink ? '#' : ' ').join('')
    return [...row.matchAll(/#+/g)].map(match => match[0].length)
  }
  expect(rowWidths(speechRadical, 90)).toEqual([15])
  expect(rowWidths(hook, 90)).toEqual([16])
  expect(rowWidths(dog, 150)).toEqual([14, 13])
  expect(rowWidths(inner, 90)).toEqual([16, 16])
})

it('associates each editable outline with its original IDS leaf', () => {
  const separate = { ...composer('sans'), separate: true }
  for (const [key, expected] of [[water, [0, 1, 3, 2]], [speech, [0, 1, 1, 2, 3, 4]], [horse, [0, 1, 2]]]) {
    expect(rccChainContextParts(separate, key, em).map(p => p.rccLeaf)).toEqual(expected)
  }
  for (const key of [tiger, '⿸㇯虍七노', '⿱㇯馬灬乙']) {
    expect(rccChainContextParts(separate, key, em)).toBeNull()
  }
  expect(rccChainContextParts({ ...separate, fontStyle: 'pen-writing' }, horse, em)).toBeNull()
})
