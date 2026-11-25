import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { pathMask } from '../src/geometry.js'
import { character, files, shards } from './fixtures/small-export.js'
// Noto Sans CJK JP 2.004, SIL OFL 1.1.
import donors from './fixtures/printed-zhi-sans.json' with { type: 'json' }

function source() {
  const glyphs = { ...donors, 一: character('一', [[35, 350, 965, 430]]),
    小: character('小', [[450, 50, 550, 710], [240, 140, 330, 420], [670, 140, 760, 420]]) }
  const data = { ...files, ...shards('g', Object.entries(glyphs)) }
  return createSource(async name => data[name] === undefined ? null : new Uint8Array(Buffer.from(data[name])).buffer)
}

// A cap, three crossbars and their shared baseline enclose exactly four counters.
function counters(d, size = 160) {
  const mask = pathMask(d, size)
  let counters = 0
  for (let start = 0; start < mask.length; start++) {
    if (mask[start]) continue
    const cells = [start]
    mask[start] = 1
    let edge = false
    for (let i = 0; i < cells.length; i++) {
      const p = cells[i], x = p % size, y = Math.floor(p / size)
      edge ||= x === 0 || y === 0 || x === size - 1 || y === size - 1
      for (const q of [x > 0 && p - 1, x < size - 1 && p + 1, y > 0 && p - size, y < size - 1 && p + size]) {
        if (q === false || mask[q]) continue
        mask[q] = 1
        cells.push(q)
      }
    }
    if (!edge && cells.length > 2) counters++
  }
  return counters
}

it('connects six crossbar ends and both wall feet in the printed 置', async () => {
  const ids = '⿱罒⿱十⿺丄⿵冂三'
  for (const layout of ['composed', 'cells']) {
    const options = { layout, separate: true }
    const src = source()
    const boxes = await sketch(src, ids, options)
    const { parts } = await compose(src, ids, options)
    expect(parts.map(p => p.origin)).toEqual([...'罒十丄冂三'].map(ch => `printed 置: ${ch}`))
    expect(boxes).toHaveLength(5)
    expect(counters(parts.slice(2).map(p => p.d).join(''))).toBe(4)
  }
})

it('uses the same baseline through surrounding and nested stacks', async () => {
  for (const [ids, count] of [['⿺丄⿵冂三', 3], ['⿱⿵冂三一', 3], ['⿱十⿱⿵冂三一', 4],
    ['⿱⿵冂三𡭕', 3], ['⿱⿵冂三⿱一小', 4]]) {
    for (const separate of [false, true]) {
      const src = source()
      const cold = await sketch(src, ids)
      const drawing = await compose(src, ids, { separate })
      expect(cold).toEqual(await sketch(src, ids))
      expect(drawing.parts).toHaveLength(count)
      expect(counters(drawing.d)).toBe(4)
    }
  }
})

it('joins two independent baselines in the same stack', async () => {
  const drawing = await compose(source(), '⿱⿺丄⿵冂三⿺丄⿵冂三')
  expect(counters(drawing.d)).toBe(8)
})
