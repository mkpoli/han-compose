// What may be composed from a description, and a part fitted into an opening too tight for the
// starting scale.
import { describe, expect, it } from 'bun:test'
import { Composer, composableDescription, fitInside } from '../src/compose.js'
import { compose } from '../src/loader.js'
import { constants, files, shards } from './fixtures/small-export.js'
import { sourceOver } from './support.js'

describe('what may be composed from a description', () => {
  it('allows the operators whose placement is predictable', () => {
    for (const description of ['⿰月句', '⿱一乙', '⿲丨丨丨', '⿳亠口一', '⿵冂夂', '⿶凵夕', '⿸广林', '⿹勹米', '⿺辶束', '⿿口正'])
      expect(composableDescription(description)).toBe(true)
  })
  it('refuses a description carrying an unpredictable operator anywhere in its layers', () => {
    for (const description of ['⿻丂丿', '㇯丘丨', '〾車年', '⿾止', '⿼弓丨', '⿽中二', '⿴囗人', '⿷匚人',
      '⿰亻⿱𭇁大㇯', '⿰木⿴囗木'])
      expect(composableDescription(description)).toBe(false)
  })
})

describe('fitting a part into its room', () => {
  it('still fits a part into an opening too tight for the starting scale', async () => {
    // A 冖 cover leaves a slot a twentieth of the em tall: the part has to shrink into it rather
    // than stay across the bar, where the scale the room allows alone would not reach.
    const source = sourceOver(files)
    await source.ready()
    await source.load(Object.keys(files).filter(name => name.includes('/')))
    const composer = new Composer(source.store())
    const tight = [200, 480, 800, 530]
    expect(fitInside(composer.compose('冂'), composer.compose('木'), [40, 40, 960, 960], 16, constants, { room: tight })).toBe(true)
  })
})

describe('a character the export has no glyph for', () => {
  it('is drawn from its sequence and reported as missing', async () => {
    // 甲 has a description and no glyph of its own: the drawing is the description's, and the
    // drawing names the character it could not draw.
    const source = sourceOver({ ...files, ...shards('g', [['甲', { k: '甲', s: '⿰木口' }]]) })
    const drawn = await compose(source, '⿰甲木')
    expect(drawn.missing).toEqual(['甲'])
    expect(drawn.origins).toContain('glyph 口')
  })
})
