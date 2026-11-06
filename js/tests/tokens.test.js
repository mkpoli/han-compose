import { describe, expect, it } from 'bun:test'
import { tokens } from '../src/tokens.js'

describe('the tokens of a field', () => {
  it('maps nested subtrees with UTF-16 ranges', () => {
    const text = '⿰⿱木𠀀\u{E0100}水'
    const spans = tokens(text)
    expect(spans.map(t => t.path)).toEqual([[], [0], [0, 0], [0, 1], [1]])
    expect(text.slice(spans[1].start, spans[1].end)).toBe('⿱木𠀀\u{E0100}')
    expect(spans[3].text).toBe('𠀀\u{E0100}')
    expect(spans.map(t => t.text).join('')).toBe(text)
  })
  it('keeps a conjoining Hangul run whole', () => {
    const cluster = String.fromCodePoint(0x1100, 0x1161, 0x11eb), text = `⿰${cluster}木`
    const spans = tokens(text)
    expect(spans.map(token => token.text)).toEqual(['⿰', cluster, '木'])
    expect(spans.at(-1)).toMatchObject({ path: [1], start: 1 + cluster.length, end: text.length })
  })
  it('gives an unfinished slot no width, and an invalid draft no tokens', () => {
    expect(tokens('⿰木').at(-1)).toMatchObject({ path: [1], start: 2, end: 2, text: '' })
    expect(tokens('⿰木木木')).toEqual([])
    expect(tokens('⿰木!').map(token => token.text)).toEqual(['⿰', '木', '!'])
    expect(tokens('')).toEqual([])
  })
  it('gives a written slot its own character', () => {
    expect(tokens('⿰⬚口').map(token => [token.path, token.text, token.start, token.end]))
      .toEqual([[[], '⿰', 0, 3], [[0], '⬚', 1, 2], [[1], '口', 2, 3]])
  })
  it('treats an Emoji sequence as one token, counted in UTF-16', () => {
    const emoji = '👩🏽‍💻', spans = tokens(`⿰${emoji}木`)
    expect(spans.map(token => token.text)).toEqual(['⿰', emoji, '木'])
    expect(spans[1]).toMatchObject({ start: 1, end: 1 + emoji.length })
    expect(spans[2]).toMatchObject({ start: 1 + emoji.length })
  })
  it('keeps a modifier with its operator', () => {
    const spans = tokens('⿴[1]囗水')
    expect(spans.map(t => t.text)).toEqual(['⿴[1]', '囗', '水'])
    expect(spans[0]).toMatchObject({ path: [], start: 0, noteStart: 1, noteEnd: 4, tokenEnd: 4 })
  })
  it('keeps a stroke chain whole, with its selector', () => {
    expect(tokens('⿰#(H)木').map(t => t.text)).toEqual(['⿰', '#(H)', '木'])
    expect(tokens('⿰#(H)\u{E0100}木').map(t => t.text)).toEqual(['⿰', '#(H)\u{E0100}', '木'])
  })
  it('keeps a tone mark on the syllable it follows', () => {
    expect(tokens('⿰가〮나〯').map(t => t.text)).toEqual(['⿰', '가〮', '나〯'])
    expect(tokens('⿰#(H)〮木').map(t => t.text)).toEqual(['⿰', '#(H)〮', '木'])
  })
  it('gives loose marks a token of the root, under its span', () => {
    const spans = tokens('⿰𠀀木́')
    expect(spans.map(t => t.text)).toEqual(['⿰', '𠀀', '木', '́'])
    expect(spans[0]).toMatchObject({ path: [], start: 0, end: 5 })
    expect(spans.at(-1)).toMatchObject({ path: [], start: 4, end: 5 })
  })
})
