import { describe, expect, it } from 'bun:test'
import { compose } from '../src/loader.js'
import { composerPreview } from '../src/index.js'
import { sourceFor } from '../src/source.js'

describe('drawing with no export', () => {
  it('draws a bundled glyph where the base is no URL', async () => {
    const heard = []
    const drawing = await composerPreview({ base: 'not a url' })('\u{17000}', { onSketch: leaves => heard.push(leaves) })
    expect(drawing.d.length).toBeGreaterThan(0)
    expect(heard).toHaveLength(1)
  })
  it('reads a leaf only the Unicode outlines hold', async () => {
    const drawn = await compose(sourceFor('〇', { bundled: true }), '〇')
    expect(drawn.d.length).toBeGreaterThan(0)
  })
})
