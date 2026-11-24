import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { files, shards } from './fixtures/small-export.js'
// Noto Sans CJK JP 2.004, SIL OFL 1.1.
import donors from './fixtures/printed-zhi-sans.json' with { type: 'json' }

it('puts the three bars inside the right wall above the separate upright’s baseline', async () => {
  const data = { ...files, ...shards('g', Object.entries(donors)) }
  const src = createSource(async name => data[name] === undefined ? null : new Uint8Array(Buffer.from(data[name])).buffer)
  const ids = '⿱罒⿱十⿺丄⿵冂三'
  for (const layout of ['composed', 'cells']) {
    const options = { layout, separate: true }
    const { parts } = await compose(src, ids, options)
    expect(parts.map(p => p.origin)).toEqual([...'罒十丄冂三'].map(ch => `printed 置: ${ch}`))
    expect(await sketch(src, ids, options)).toHaveLength(5)
    const [, , foot, enclosure, bars] = parts.map(p => p.box)
    expect(enclosure[0]).toBeGreaterThan(foot[0] + foot[2] * 0.35)
    expect(bars[0] + bars[2]).toBeLessThan(enclosure[0] + enclosure[2])
    expect(Math.abs(foot[1] + foot[3] - enclosure[1] - enclosure[3])).toBeLessThan(5)
  }
})
