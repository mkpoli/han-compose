import { expect, it } from 'bun:test'
import data from '../src/component-forms.json'
import { componentDrawing, isComponentForm } from '../src/component-forms.js'
import { compose, createSource, sketch } from '../src/loader.js'
import { pathMask } from '../src/geometry.js'
import { character, files, records, shards } from './fixtures/small-export.js'
import donors from './fixtures/chain-component-donors.json' with { type: 'json' }
import guides from './fixtures/guide-chain-cuts.json' with { type: 'json' }

// The frame of 马 as zi.tools writes it, cut from 马 in each Noto face.
const CHAIN = '#(-𠃍㇉)'

it('draws a stroke chain from the outline cut out of its host', () => {
  for (const style of ['sans', 'serif']) {
    expect(isComponentForm(CHAIN, style)).toBe(true)
    expect(componentDrawing(CHAIN, style)?.d).toMatch(/^M/)
    // One piece: the chain, with the host's other stroke left behind.
    expect(data.forms[style][CHAIN]).toHaveLength(1)
    expect(data.forms[style][CHAIN][0]).toHaveLength(1)
  }
})

it('keeps a Noto cut out of the faces that draw only their own', () => {
  for (const style of ['pen-writing', 'fangsong']) expect(isComponentForm(CHAIN, style)).toBe(false)
})

it('fits an enclosed part into the room a cut form leaves', async () => {
  const source = createSource(async name => files[name] === undefined ? null : new Uint8Array(Buffer.from(files[name])).buffer)
  for (const fontStyle of ['sans', 'serif']) {
    const { parts } = await compose(source, `⿴${CHAIN}木`, { fontStyle })
    const frame = parts.find(part => part.origin.endsWith(CHAIN)), inner = parts.find(part => part !== frame)
    const [fx, fy, fw, fh] = frame.box, [ix, iy, iw, ih] = inner.box
    // The frame of 马 closes only round its upper counter, between the top bar and the middle one:
    // the part goes there, inside the frame, not into the open lower half.
    expect(ix).toBeGreaterThan(fx)
    expect(ix + iw).toBeLessThan(fx + fw)
    expect(iy).toBeGreaterThan(fy)
    expect(iy + ih).toBeLessThan(fy + fh / 2)
  }
})

it('keeps the frame and the enclosed character selectable when either leaf draws several parts', async () => {
  const enclosed = '⿵#(-丿𠃌)𠮷'
  for (const fontStyle of ['sans', 'fangsong']) {
    const brush = fontStyle === 'fangsong'
    const data = { ...files, ...shards('g', [
      ['丿', character('丿', [[95, 0, 245, 760]])], ['𠃌', character('𠃌', [[240, 670, 820, 750], [760, 0, 820, 750]])],
      ['周', { G: donors.fangsong.周 }], ['土', records.三], ['𠮷', brush ? { s: '⿱土口' } : records.口],
    ]) }
    const source = createSource(async name => data[name] === undefined ? null : new Uint8Array(Buffer.from(data[name])).buffer)
    const owners = brush ? [0, 1, 1] : [0, 0, 1]
    for (const [ids, expected] of [
      [enclosed, owners],
      ['⿰木' + enclosed, [0, ...owners.map(i => i + 1)]],
      ['⿰' + enclosed + enclosed, [...owners, ...owners.map(i => i + 2)]],
    ]) {
      const { parts } = await compose(source, ids, { fontStyle, separate: true })
      expect(parts.map(p => p.leaf)).toEqual(expected)
    }
  }
})

it('assigns a rebuilt scalar and an explicitly partitioned inner glyph to their written enclosure leaves', async () => {
  const outer = '⿵#(-丿𠃌)', expanded = '⿰亻卬', le = '⿻[1:]亅⿱#(丿𠃊)八', options = { fontStyle: 'sans' }
  const input = { ...files, ...shards('g', [
    ['丿', character('丿', [[95, 0, 245, 760]])], ['𠃌', character('𠃌', [[240, 670, 820, 750], [760, 0, 820, 750]])],
    ['𠮷', { s: expanded }], ['仰', { G: guides.sans.仰, ink: 5300 }], ['乐', { G: donors.sans.乐, ink: 6100 }],
  ]) }
  const source = createSource(async name => input[name] ? Uint8Array.from(Buffer.from(input[name])).buffer : null)
  for (const [inner, origins, owners] of [
    ['𠮷', ['glyph 仰'], [1]], [expanded, ['亻 from 仰', '卬 from 仰'], [1, 2]],
    [le, ['亅 from 乐', '#(丿𠃊) from 乐', '八 from 乐'], [1, 2, 3]],
  ]) {
    const ids = outer + inner
    const normal = await compose(source, ids, options), separate = await compose(source, ids, { ...options, separate: true })
    const parts = separate.parts.filter(p => !p.origin.startsWith('chain'))
    expect(separate.parts.map(p => p.leaf)).toEqual([0, 0, ...owners])
    expect(parts.map(p => p.origin)).toEqual(origins)
    expect(await sketch(source, ids, options)).toHaveLength(owners.length + 1)
    expect(pathMask(normal.d, 256)).toEqual(pathMask(separate.d, 256))
  }
  const mixed = await compose(source, '⿰' + outer + '𠮷' + outer + le, { ...options, separate: true })
  expect(mixed.parts.map(p => p.leaf)).toEqual([0, 0, 1, 2, 2, 3, 4, 5])
})
