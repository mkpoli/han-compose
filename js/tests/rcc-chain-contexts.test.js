import { expect, it } from 'bun:test'
import { createSource, compose, sketch } from '../src/loader.js'
import { editableRccParts } from '../src/rcc-forms.js'
import { documentSource } from '../src/document-source.js'
import { files, shards } from './fixtures/small-export.js'
import { partOf, pathMask, svgPath } from '../src/geometry.js'
import { rccChainContextParts, rccChainDonors } from '../src/rcc-chain-contexts.js'
// Format-7 glyph records from Noto Sans CJK, TW-Kai and Zhuque FangSong.
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
  for (const [key, expected] of [[water, [0, 1, 3, 2]], [speech, [0, 1, 1, 2, 3, 4]], [horse, [0, 1, 2]], [tiger, [0, 1, 2, 2]]]) {
    expect(rccChainContextParts(separate, key, em).map(p => p.rccLeaf)).toEqual(expected)
  }
})

it('exposes the exact subtraction operands while preserving the assembled preview', async () => {
  const exportFiles = { ...files, ...shards('g', Object.entries(donors.sans).map(([char, G]) => [char, { G }])) }
  const source = createSource(async name => exportFiles[name] ? Uint8Array.from(Buffer.from(exportFiles[name])).buffer : null)
  const component = char => ({ kind: 'component', id: char, char })
  for (const [op, base, cut, inner] of [['⿸', '虍', '七', '노'], ['⿱', '馬', '灬', '乙']]) {
    const key = `${op}㇯${base}${cut}${inner}`
    const normal = await compose(source, key), split = await compose(source, key, { separate: true })
    expect(split.d).toBe(normal.d)
    expect(split.cut).toBe('')
    const operands = split.parts.filter(p => p.operandOnly)
    expect(operands.map(p => p.leaf)).toEqual([0, 1])
    expect(operands[0].d).toBe(operands[1].d)
    const right = component(cut)
    const doc = { root: { id: 'root', kind: 'operator', op, children: [
      { id: 'difference', kind: 'operator', op: '㇯', children: [component(base), right] }, component(inner),
    ] } }
    const made = documentSource(doc, split, await sketch(source, key))
    expect(made.issues).toEqual([])
    const [removed] = made.source.geometry(right).pieces
    expect(removed.d.length).toBeGreaterThan(20)
    expect(removed.cut).toBe(false)
  }
})

it('edits the complete 馬 as a native frame, 𰀁 and four dots at its final weight', async () => {
  const written = '⿹⿷#(-一丨b𠃌)𰀁灬'
  const horseNode = id => ({ id, kind: 'operator', op: '⿹', children: [
    { id: id + 'w', kind: 'operator', op: '⿷', children: [
      { id: id + 'f', kind: 'component', char: '#(-一丨b𠃌)' },
      { id: id + 'i', kind: 'component', char: '𰀁' },
    ] },
    { id: id + 'd', kind: 'component', char: '灬' },
  ] })
  for (const [fontStyle, drawnFace] of [['sans', 'sans'], ['regular', 'regular'], ['fangsong', 'fangsong'], ['regular', 'sans']]) {
    const exportFiles = { ...files, ...shards('g', [['馬', { G: donors[drawnFace].馬 }], ['冖', { G: donors.sans.冖, ink: 2564.9, nl: 1, o: 1 }]]) }
    const source = createSource(async name => exportFiles[name] ? Uint8Array.from(Buffer.from(exportFiles[name])).buffer : null)
    expect(rccChainDonors(written, fontStyle)).toEqual(['馬'])
    for (const [ids, root] of [
      [written, horseNode('a')],
      ['⿱冖' + written, { id: 'under-cover', kind: 'operator', op: '⿱', children: [
        { id: 'cover', kind: 'component', char: '冖' }, horseNode('a'),
      ] }],
      ['⿰' + written + written, { id: 'pair', kind: 'operator', op: '⿰', children: [horseNode('a'), horseNode('b')] }],
      ['⿱三' + written, { id: 'stack', kind: 'operator', op: '⿱', children: [
        { id: 'top', kind: 'component', char: '三' }, horseNode('a'),
      ] }],
    ]) {
      const normal = await compose(source, ids, { fontStyle })
      const split = await compose(source, ids, { fontStyle, separate: true })
      const layout = await sketch(source, ids, { fontStyle })
      expect(normal.parts.some(p => p.origin.includes('glyph 馬'))).toBe(true)
      expect(split.parts.map(p => p.leaf)).toEqual(layout.map(p => p.index))
      expect(split.parts.filter(p => p.origin === '𰀁 from 馬').length).toBeGreaterThan(0)
      expect(documentSource({ root }, split, layout).issues).toEqual([])
      expect(pathMask(split.d, 256)).toEqual(pathMask(normal.d, 256))
    }
    for (const blocked of [written, '馬', '𰀁', '灬', '#(-一丨b𠃌)', '一', '丨', '𠃌']) {
      const source = { ...composer(fontStyle), separate: true, excluded: char => char === blocked }
      expect(rccChainContextParts(source, written, em)).toBeNull()
    }
  }
})


it('recognizes a Noto fallback only for the full editable 馬', () => {
  const written = '⿹⿷#(-一丨b𠃌)𰀁灬'
  const fallback = { ...composer('sans'), fontStyle: 'regular', separate: true,
    place: (part, target, native, origin) => ({ part, source: part.box, target, native, origin }) }
  expect(rccChainContextParts(fallback, horse, em)).toBeNull()
  const split = editableRccParts(rccChainContextParts(fallback, written, em))
  expect(split.map(p => p.rccLeaf)).toEqual([0, 1, 2])
  expect(editableRccParts(split)).toBe(split)
  for (const record of [{ ...donors.sans.馬, v: 2 }, { ...donors.sans.馬, p: [] }]) {
    expect(rccChainContextParts({ ...fallback, glyphRecord: () => record }, written, em)).toBeNull()
  }
})
