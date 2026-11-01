import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { compose } from '../src/loader.js'
import { onlyBundled } from '../src/local.js'
import { hasPaletteGlyph, paletteSource } from '../src/palette.js'

it('draws every palette fallback as an editable component', async () => {
  const chars = JSON.parse(readFileSync(new URL('../../data/palette/fallback-characters.json', import.meta.url)))
  const outlines = JSON.parse(gunzipSync(readFileSync(new URL('../../data/sources/palette/outlines.json.gz', import.meta.url))))
  expect(Object.keys(outlines.records).sort()).toEqual([...chars].sort())
  const source = paletteSource({ load: async () => outlines })
  for (const char of chars) {
    expect(hasPaletteGlyph(char)).toBe(true)
    expect(onlyBundled(`⿰${char}⬚`)).toBe(true)
    const drawn = await compose(source, `⿰${char}⬚`, { separate: true })
    expect(drawn.origins).toContain(`glyph ${char}`)
    expect(drawn.parts[0].d.length).toBeGreaterThan(10)
  }
})
