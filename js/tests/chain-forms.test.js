import { expect, it } from 'bun:test'
import data from '../src/component-forms.json'
import { componentDrawing, isComponentForm } from '../src/component-forms.js'
import { compose, createSource } from '../src/loader.js'
import { character, files, records, shards } from './fixtures/small-export.js'
import donors from './fixtures/chain-component-donors.json' with { type: 'json' }

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
