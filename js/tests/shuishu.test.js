import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { isComponent, isLetter, isShuishu, parseDescription as parse, writeDescription as write } from '../src/tree.js'
import { characterScript } from '../src/scripts.js'
import { partScript } from '../src/part-script.js'
import { compose } from '../src/loader.js'
import { onlyBundled } from '../src/local.js'
import { hasShuishu, shuishuSource } from '../src/shuishu.js'

const outlines = JSON.parse(gunzipSync(readFileSync(new URL('../../data/sources/shuishu/outlines.json.gz', import.meta.url))))
const chars = Object.keys(outlines.records)

describe('Shuishu', () => {
  it('accepts the tentative code points as components', () => {
    for (const char of [chars[0], chars[486], chars.at(-1)]) {
      expect(isComponent(char)).toBe(true)
      // A logogram or radical, not a letter.
      expect(isLetter(char)).toBe(false)
      expect(characterScript(char)).toBe('shuishu')
      expect(isShuishu(char)).toBe(true)
      expect(write(parse(`⿰${char}木`))).toBe(`⿰${char}木`)
    }
    expect(partScript(`⿰${chars[0]}${chars[1]}`)).toBe('shuishu')
    expect(partScript(`⿰${chars[0]}木`)).toBe('mixed')
    // The gap between the two ranges is not part of the block.
    expect(isShuishu(String.fromCodePoint(0x1b4e6))).toBe(false)
    expect(isComponent(String.fromCodePoint(0x1b4e6))).toBe(false)
  })

  it('ships an outline for every part, and draws them without the export', async () => {
    expect(chars).toHaveLength(533)
    for (const char of chars) {
      expect(outlines.records[char].G.p.length).toBeGreaterThan(0)
      expect(hasShuishu(`⿰${char}木`)).toBe(true)
      expect(onlyBundled(`⿰${char}⬚`)).toBe(true)
    }
    const source = shuishuSource({ load: async () => outlines })
    for (const char of chars.slice(0, 8)) {
      const drawn = await compose(source, `⿰${char}${chars[0]}`, { separate: true })
      expect(drawn.origins).toContain(`glyph ${char}`)
      expect(drawn.d.length).toBeGreaterThan(10)
    }
  })
})
