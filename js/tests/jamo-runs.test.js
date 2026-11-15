// A run of conjoining jamo no code point spells is set letter by letter where a syllable puts each.
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { compose } from '../src/loader.js'
import { unicodeSource } from '../src/unicode.js'

const read = path => JSON.parse(gunzipSync(readFileSync(new URL(`../data/${path}`, import.meta.url))))
const source = () => unicodeSource({ load: async name => read(`unicode/outlines/${name.slice('unicode/'.length)}.json.gz`) })
// Boxes are [x, y, width, height], y down in the drawing's 1000-unit box.
const right = part => part.box[0] + part.box[2]

describe('a run of jamo', () => {
  it('draws every initial of a run, side by side at the initial\'s place', async () => {
    const drawn = await compose(source(), '\u1100\u1100\u1165')
    expect(drawn.origins).toEqual(['glyph \u1100', 'glyph \u1100', 'glyph \u1165'])
    const [first, second, medial] = drawn.parts
    expect(right(first)).toBeLessThanOrEqual(second.box[0] + 1)
    expect(right(second)).toBeLessThanOrEqual(medial.box[0] + 30)
    // One initial alone takes the place the two share.
    const single = await compose(source(), '\u1140\u1165')
    expect(single.origins).toEqual(['glyph \u1140', 'glyph \u1165'])
    expect(right(single.parts[0])).toBeGreaterThanOrEqual(right(first))
  })

  it('still draws a lone letter as itself', async () => {
    const drawn = await compose(source(), '\u1100')
    expect(drawn.origins).toEqual(['glyph \u1100'])
  })
})
