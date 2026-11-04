// A description written with a variant of a component draws the font's glyph for the character it
// names: ⿰查皮 is 皶, whose own sequence is ⿰査皮. The export has no cut for it — the operands'
// strokes overlap — so the designed glyph is partitioned one piece per leaf.
import { describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { compose, createSource } from '../src/loader.js'
import { files } from './fixtures/small-export.js'
import gaizha from './fixtures/gaizha-glyph.json' with { type: 'json' }

const hex = text => createHash('sha256').update(text).digest('hex')
/** The small export with one more character's record: 皶, the glyph the variant description names. */
const source = () => {
  const name = `g/${hex('皶').slice(0, 3)}.json`
  const body = gzipSync(JSON.stringify({ [hex('皶')]: { k: '皶', ...gaizha } }))
  return createSource(async file => {
    if (file === name) return new Uint8Array(body).buffer
    const written = files[file]
    return written === undefined ? null : new Uint8Array(Buffer.from(written)).buffer
  })
}

describe('a description naming a variant', () => {
  it('draws the glyph, whole or split into its leaves', async () => {
    const whole = await compose(source(), '皶')
    const plain = await compose(source(), '⿰查皮')
    const split = await compose(source(), '⿰查皮', { separate: true })
    expect(plain.parts.map(part => part.origin)).toEqual(['glyph 皶'])
    expect(plain.d).toBe(whole.d)
    expect(split.parts.map(part => part.origin)).toEqual(['glyph 皶', 'glyph 皶'])
    // The partition itself: eight contours around 査, seven around 皮.
    expect(split.parts.map(part => (part.d.match(/M/g) ?? []).length)).toEqual([8, 7])
    expect(split.d).toBe(whole.d)
  })
})
