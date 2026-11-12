// A description whose operands interlock in the designed glyph draws that glyph partitioned one
// piece per leaf: 鬱's 冖 runs under the top row and between 鬯 and 彡, which no composed split
// reproduces.
import { describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { compose, createSource } from '../src/loader.js'
import { files } from './fixtures/small-export.js'
import yu from './fixtures/yu-glyph.json' with { type: 'json' }

const hex = text => createHash('sha256').update(text).digest('hex')
/** The small export with 鬱's record: the designed glyph both descriptions name. */
const source = () => {
  const name = `g/${hex('鬱').slice(0, 3)}.json`
  const body = gzipSync(JSON.stringify({ [hex('鬱')]: yu }))
  return createSource(async file => {
    if (file === name) return new Uint8Array(body).buffer
    const written = files[file]
    return written === undefined ? null : new Uint8Array(Buffer.from(written)).buffer
  })
}

describe('a description whose operands interlock', () => {
  it('draws the designed glyph, one piece per leaf', async () => {
    const whole = await compose(source(), '鬱')
    const split = await compose(source(), '⿳⿲木缶木冖⿰鬯彡', { separate: true })
    expect(split.parts).toHaveLength(6)
    expect(split.parts.map(part => part.origin)).toEqual(Array(6).fill('glyph 鬱'))
    // A stroke wholly inside a piece stays addressable there.
    expect(split.parts.every(part => part.strokes?.length)).toBe(true)
    // Every contour lands in exactly one piece, so the pieces together draw the glyph; the
    // partition changes the path's contour order, not its ink.
    const contours = d => d.split('M').filter(Boolean).map(contour => `M${contour}`).sort()
    expect(contours(split.d)).toEqual(contours(whole.d))
  })
})
