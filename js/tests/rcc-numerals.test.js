import { expect, it } from 'bun:test'
import { numeralDonors, numeralParts } from '../src/rcc-numerals.js'
import { fill, groupRings } from '../src/geometry.js'
import { leaves, parseDescription } from '../src/tree.js'
import { nativeStroke } from '../src/stroke-donors.js'
import { character } from './fixtures/small-export.js'
// Numeral 1 from the pinned Noto Sans CJK, Noto Serif CJK, TW-Kai and Zhuque exports.
import digits from './fixtures/rcc-digits.json' with { type: 'json' }
// Zhuque FangSong 0.212 (SIL OFL 1.1), 題 from the pinned FangSong export.
import topic from './fixtures/fangsong-topic.json' with { type: 'json' }

const em = [0, -120, 1000, 880]
const five = '#(丿◝x4◞◟◜)'
const pairs = [
  ['⿱⿰〧〥△', '⿱⿰⿱丄一' + five + '#(-𠃋丶z)'],
  ['⿱⿰〥〤元', '⿱⿰' + five + '乂元'],
  ['⿵巾１', '⿵巾⿱#(㇀丨)一'],
]
const host = character('日', [[30, 80, 470, 750]]).G
function composer(fontStyle) {
  return { fontStyle, excluded: () => false,
    glyphRecord: char => char === '題' ? topic : ['1', '１'].includes(char) && digits[fontStyle] ? digits[fontStyle] : '一丨丿丄乂刁元日冂1１'.includes(char) ? host : null,
    chainStroke: char => nativeStroke(char === '㇀' ? '◞' : char, fontStyle),
  }
}

it('draws the same printed signs for the RCC numeral and stroke-chain spellings', () => {
  for (const style of ['sans', 'serif', 'fangsong', 'regular', 'pen-writing']) {
    const face = composer(style)
    for (const [current, past] of pairs) {
      const a = numeralParts(face, current, em), b = numeralParts(face, past, em)
      expect(a?.length).toBeGreaterThan(1)
      const ink = fill(groupRings(a), 96, em)
      expect(fill(groupRings(b), 96, em).every((byte, i) => byte === ink[i])).toBe(true)
    }
    const weekday = numeralParts(face, '⿰' + five + '日', em)
    expect(weekday.at(-1).origin).toBe('glyph 日')
    expect(weekday.at(-1).target[0]).toBeGreaterThan(weekday[0].target[0])
  }
})

it('partitions the connected 題 outline to place a literal question mark above its sweep', () => {
  const face = composer('fangsong')
  for (const key of ['⿺是？', '⿺是⿱#(◜◝◞-◜)丶']) {
    const [body, mark] = numeralParts(face, key, em)
    expect(body.origin).toBe('是 from 題')
    expect(body.part.contours).toHaveLength(3)
    expect(mark.origin).toContain('glyph ？')
    expect(mark.target[0]).toBeGreaterThan((em[0] + em[2]) / 2)
    expect(mark.target[1]).toBeGreaterThan(body.target[1])
  }
  expect(numeralParts({ ...face, glyphRecord: () => host }, '⿺是？', em)).toBeNull()
})

it('respects exclusions on source strokes, complete chains, symbols and donor cuts', () => {
  const key = '⿰' + five + '日'
  for (const excluded of ['丿', five, '日', key, '〇']) {
    expect(numeralParts({ ...composer('fangsong'), excluded: c => c === excluded }, key, em)).toBeNull()
  }
  for (const excluded of ['題', '是', '？']) {
    expect(numeralParts({ ...composer('fangsong'), excluded: c => c === excluded }, '⿺是？', em)).toBeNull()
  }
  expect(numeralDonors('⿺是日', 'sans')).toEqual([])
  expect(numeralParts(composer('sans'), '⿺是日', em)).toBeNull()
})

it('assigns editable pieces to the original operands in reading order', () => {
  for (const fontStyle of ['sans', 'serif', 'fangsong', 'regular', 'pen-writing']) {
    const face = { ...composer(fontStyle), separate: true }
    for (const key of [...pairs.flat(), '⿰' + five + '日']) {
      const parts = numeralParts(face, key, em)
      const owners = parts.map(p => p.rccLeaf)
      const expected = leaves(parseDescription(key)).map((_, i) => i)
      expect([...new Set(owners)]).toEqual(expected)
      expect(owners).toEqual([...owners].sort((a, b) => a - b))
    }
  }
  const unknown = { ...composer('sans'), glyphRecord: () => host, separate: true }
  expect(numeralParts(unknown, '⿵巾⿱#(㇀丨)一', em)).toBeNull()
  const fangsong = { ...composer('fangsong'), separate: true }
  for (const key of ['⿺是？', '⿺是⿱#(◜◝◞-◜)丶']) {
    const parts = numeralParts(fangsong, key, em)
    expect(parts.map(p => p.rccLeaf)).toEqual(leaves(parseDescription(key)).map((_, i) => i))
  }
})

it('ignores excluded syntax and loads the FangSong lift donor only when needed', () => {
  const key = '⿱⿰⿱丄一' + five + '#(-𠃋丶z)'
  for (const excluded of ['4', 'x', '#', '-', 'z', '⿱']) {
    expect(numeralParts({ ...composer('fangsong'), excluded: c => c === excluded }, key, em)).not.toBeNull()
  }
  const face = { ...composer('fangsong'), excluded: c => c === '刁' }
  expect(numeralParts(face, key, em)).toBeNull()
  expect(numeralParts({ ...face, glyphRecord: c => c === '㇀' ? host : face.glyphRecord(c) }, key, em)).not.toBeNull()
})
