import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { bopomofoSource } from '../src/bopomofo.js'
import { compose, sketch } from '../src/loader.js'
import { unicodeSource } from '../src/unicode.js'

const read = path => JSON.parse(gunzipSync(readFileSync(new URL(`../data/${path}`, import.meta.url))))
const source = () => unicodeSource({
  load: async name => read(`unicode/outlines/${name.slice('unicode/'.length)}.json.gz`),
  fallback: bopomofoSource({ load: async () => read('sources/bopomofo/outlines.json.gz') }),
})

describe('sketching loose marks', () => {
  it('puts each leaf where the drawing puts it beside a mark', async () => {
    const local = source()
    const boxes = await sketch(local, '⿰ㄅㄚˇ')
    const plain = await sketch(local, '⿰ㄅㄚ')
    const ink = (await compose(local, '⿰ㄅㄚˇ')).parts.filter(part => !part.origin.startsWith('mark'))
    expect(boxes[1].box[1]).toBeGreaterThan(plain[1].box[1])
    // The leaf's box holds the ink the drawing placed in it.
    expect(boxes[1].box[1]).toBeLessThanOrEqual(ink[1].box[1] + 1)
    expect(boxes[0].box[0] + boxes[0].box[2]).toBeLessThanOrEqual(plain[0].box[0] + plain[0].box[2])
  })
})
