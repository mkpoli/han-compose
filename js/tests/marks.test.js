import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { descriptionEnd, isMark, isMarks, marksOf, normalizeMarks, parseDescription as parse, splitDescription, tokens, writeDescription, withMarks } from '../src/tree.js'
import { traitsOf } from '../src/source.js'
import { repeatedPart, repeatedText } from '../src/repeat-part.js'
import { partScript } from '../src/part-script.js'
import { drawingSvg } from '../src/drawing-svg.js'
import { bopomofoSource } from '../src/bopomofo.js'
import { unicodeSource } from '../src/unicode.js'
import { hasUnicodeGlyph } from '../src/unicode.js'
import { onlyBundled } from '../src/local.js'
import { compose, sketch } from '../src/loader.js'

const data = name => JSON.parse(gunzipSync(readFileSync(new URL(`../data/sources/${name}/outlines.json.gz`, import.meta.url))))
const bopomofo = data('bopomofo')
const unicode = name => JSON.parse(gunzipSync(readFileSync(new URL(`../data/unicode/outlines/${name.slice('unicode/'.length)}.json.gz`, import.meta.url))))
const source = () => unicodeSource({ load: unicode, fallback: bopomofoSource({ load: async () => bopomofo }) })

describe('loose marks', () => {
  it('reads combining marks, modifier letters, tone marks and superscripts, and nothing else', () => {
    for (const char of ['\u0301', '\u0323', 'ˊ', 'ˇ', 'ˉ', '˙', '˪', '˫', '˥', '꜀', '゛', '゙', '〮', '〯', '¹', '⁴', 'ʰ']) {
      expect([char, isMark(char)]).toEqual([char, true])
    }
    for (const char of ['木', 'a', '^', '~', '+', '1', '？', '⬚', '⿰']) expect([char, isMark(char)]).toEqual([char, false])
    expect(isMarks('ˊˇ')).toBe(true)
    expect(isMarks('ˊ木')).toBe(false)
    expect(isMarks('')).toBe(false)
  })

  it('keeps them at the end of a description, on the whole of it', () => {
    expect(splitDescription('⿰亻木ˊ')).toEqual({ base: '⿰亻木', marks: 'ˊ' })
    expect(splitDescription('⿰ㄅㄚˇ¹')).toEqual({ base: '⿰ㄅㄚ', marks: 'ˇ¹' })
    expect(splitDescription('⿰ㄅˊ')).toEqual({ base: '⿰ㄅˊ', marks: '' })
    expect(splitDescription('木ˊ')).toEqual({ base: '木', marks: 'ˊ' })
    expect(splitDescription('')).toEqual({ base: '', marks: '' })
    expect(marksOf('木ˊ')).toBe('ˊ')
    expect(marksOf({ op: '⿰', parts: ['亻', '木'], marks: 'ˊ' })).toBe('ˊ')
    expect(withMarks('木', 'ˊ')).toBe('木ˊ')
    expect(withMarks({ op: '⿰', parts: ['亻', '木'] }, 'ˊ')).toEqual({ op: '⿰', parts: ['亻', '木'], marks: 'ˊ' })
  })

  it('hoists marks an edit would leave inside back to the root, in reading order', () => {
    const tree = { op: '⿰', parts: ['亻', { op: '⿱', parts: ['七', '木'], marks: 'ˇ' }] }
    expect(normalizeMarks(tree)).toEqual({ op: '⿰', parts: ['亻', { op: '⿱', parts: ['七', '木'] }], marks: 'ˇ' })
    const both = { op: '⿰', parts: ['木', { op: '⿱', parts: ['七', '口'], marks: 'ˇ' }], marks: 'ˊ' }
    expect(normalizeMarks(both)).toEqual({ op: '⿰', parts: ['木', { op: '⿱', parts: ['七', '口'] }], marks: 'ˇˊ' })
  })

  it('gives the whole description one token in the field, marks included', () => {
    const spans = tokens('⿰亻木ˊ')
    expect(spans[0]).toMatchObject({ path: [], start: 0, end: 4, text: '⿰' })
    expect(spans.map(token => token.text)).toEqual(['⿰', '亻', '木', 'ˊ'])
    expect(spans.at(-1)).toMatchObject({ path: [], start: 3, end: 4, text: 'ˊ' })
    expect(tokens('木ˊ').map(token => token.text)).toEqual(['木', 'ˊ'])
  })
})

describe('reading loose marks', () => {
  it('holds them on the description they trail, and writes them back', () => {
    expect(parse('⿰木口\u0301')).toEqual({ op: '⿰', parts: ['木', '口'], marks: '\u0301' })
    expect(parse('木\u0301')).toBe('木\u0301')
    expect(writeDescription(parse('⿰木口\u0301\u0302'))).toBe('⿰木口\u0301\u0302')
  })
  it('leaves an empty draft with marks reading as its slots', () => {
    expect(traitsOf('⿰⬚⬚\u0301').empty).toBe(true)
    expect(traitsOf('⿰⬚⬚\u0301').loose).toBe(true)
  })
  it('repeats and classifies a marked part', () => {
    expect(repeatedPart('⿰木口\u0301', 'part')).toEqual({ op: '⿰', parts: ['木', '口'], marks: '\u0301' })
    expect(repeatedText(parse('⿰木口\u0301'), 'part')).toBe('⿰木口\u0301')
    expect(partScript('⿰木口\u0301')).toBe('han')
  })
  it('keeps a tone mark on a stroke chain, and reads on after it', () => {
    expect(parse('⿰#(H)\u302E木')).toEqual({ op: '⿰', parts: ['一\u302E', '木'] })
    expect(descriptionEnd([...'#(H)\u302E木'], 0)).toBe(5)
  })
  it('refuses half of a surrogate pair as a component', () => {
    expect(() => parse('⿰木\ud840')).toThrow(SyntaxError)
  })
  it('splits a mark that ends a component', () => {
    expect(splitDescription('⬚\u0301')).toEqual({ base: '⬚\u0301', marks: '' })
    expect(splitDescription('⿰가\u302E木\u0301')).toEqual({ base: '⿰가\u302E木', marks: '\u0301' })
  })
})

describe('drawing loose marks', () => {
  it('draws a tone mark after the whole syllable, at the upper right', async () => {
    const local = source()
    const plain = await compose(local, '⿰ㄅㄚ')
    const marked = await compose(local, '⿰ㄅㄚˊ')
    expect(marked.origins).toEqual(['glyph ㄅ', 'glyph ㄚ', 'mark ˊ'])
    expect(marked.parts).toHaveLength(3)
    const mark = marked.parts[2]
    // Boxes are [x, y, width, height], y down in the drawing's 1000-unit box.
    expect(mark.origin).toBe('mark ˊ')
    expect(mark.box[0] + mark.box[2]).toBeGreaterThan(700)
    expect(mark.box[1]).toBeLessThan(200)
    expect(mark.d.length).toBeGreaterThan(0)
    expect(marked.d.length).toBeGreaterThan(plain.d.length)
    const svg = drawingSvg(marked)
    expect(svg).not.toMatch(/NaN|Infinity|<text/)
  })

  it('keeps a run of marks in their order and inside the drawing', async () => {
    const local = source()
    const drawn = await compose(local, '⿰ㄅㄚ˥˧')
    expect(drawn.origins).toEqual(['glyph ㄅ', 'glyph ㄚ', 'mark ˥', 'mark ˧'])
    for (const part of drawn.parts) {
      expect(part.box[0]).toBeGreaterThanOrEqual(0)
      expect(part.box[1]).toBeGreaterThanOrEqual(0)
      expect(part.box[0] + part.box[2]).toBeLessThanOrEqual(1000)
      expect(part.box[1] + part.box[3]).toBeLessThanOrEqual(1000)
    }
  })

  it('shrinks the character to leave a mark that sits beside it outside the ink', async () => {
    const local = source()
    const box = parts => {
      const boxes = parts.map(part => part.box)
      return [Math.min(...boxes.map(b => b[0])), Math.min(...boxes.map(b => b[1])),
        Math.max(...boxes.map(b => b[0] + b[2])), Math.max(...boxes.map(b => b[1] + b[3]))]
    }
    const base = drawn => drawn.parts.filter(part => !part.origin.startsWith('mark '))
    const plain = await compose(local, '⿰ㄅㄚ')
    const marked = await compose(local, '⿰ㄅㄚˇ')
    const plainBox = box(base(plain)), markedBox = box(base(marked))
    // The character gives the tone mark the upper right and shrinks toward the lower left.
    expect(markedBox[1]).toBeGreaterThan(plainBox[1] + 80)
    expect(markedBox[3]).toBeLessThanOrEqual(plainBox[3])
    const mark = box(marked.parts.filter(part => part.origin === 'mark ˇ'))
    const overlaps = Math.min(markedBox[2], mark[2]) > Math.max(markedBox[0], mark[0])
      && Math.min(markedBox[3], mark[3]) > Math.max(markedBox[1], mark[1])
    expect(overlaps).toBe(false)
    // A combining mark over the drawing keeps the character its size.
    const attached = await compose(local, '⿰ㄅㄚ\u0301')
    expect(box(base(attached))[3]).toBeCloseTo(plainBox[3], 0)
    // A Hangul tone mark takes the left of its own syllable, so that syllable shrinks to the right.
    const hangul = await compose(local, '⿰ㄅㄚ〮')
    const syllable = box(hangul.parts.filter(part => part.origin === 'glyph ㄚ'))
    const plainSyllable = box(plain.parts.filter(part => part.origin === 'glyph ㄚ'))
    const left = box(hangul.parts.filter(part => part.origin === 'mark 〮'))
    expect(syllable[0]).toBeGreaterThan(plainSyllable[0] + 40)
    expect(left[2]).toBeLessThanOrEqual(syllable[0])
    // The mark stays on the syllable it follows, not on the whole description.
    expect(left[0]).toBeGreaterThan(500)
  })

  it('attaches a combining mark over the drawing and a Hangul tone mark at the left', async () => {
    const local = source()
    const acute = await compose(local, '⿰ㄅㄚ\u0301')
    const over = acute.parts.at(-1)
    expect(over.origin).toBe('mark \u0301')
    // Centered: the mark's box straddles the middle of the 1000-unit box.
    expect(over.box[0]).toBeLessThan(500)
    expect(over.box[0] + over.box[2]).toBeGreaterThan(500)
    expect(over.box[3]).toBeLessThan(250)
    const tone = await compose(local, '⿰ㄅㄚ〮')
    const left = tone.parts.at(-1)
    expect(left.origin).toBe('mark 〮')
    // At the left of ㄚ itself.
    const syllable = tone.parts.find(part => part.origin === 'glyph ㄚ')
    expect(left.box[0] + left.box[2]).toBeLessThanOrEqual(syllable.box[0])
  })

  it('fits long mark runs inside the drawing box', async () => {
    const local = source()
    for (const sequence of ['⿰ㄅㄚ' + '\u0301'.repeat(16), '⿰ㄅㄚ' + '\u0301'.repeat(4) + 'ˊ', '⿰ㄅㄚ〯〯〯']) {
      const drawn = await compose(local, sequence)
      for (const part of drawn.parts) {
        const [x, y, width, height] = part.box
        expect([sequence, part.origin, x >= 0 && y >= 0 && x + width <= 1000 && y + height <= 1000]).toEqual([sequence, part.origin, true])
      }
    }
  })

  it('sketches the description alone and judges bundled data with the marks', async () => {
    const local = source()
    expect(await sketch(local, '⿰ㄅㄚˊ')).toHaveLength(2)
    expect(onlyBundled('⿰ㄅㄚˊ')).toBe(true)
    expect(hasUnicodeGlyph('ˊ')).toBe(true)
    expect(onlyBundled('⿰ㄅㄚˊ木')).toBe(false)
  })
})
