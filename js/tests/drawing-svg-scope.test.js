import { describe, expect, it } from 'bun:test'
import { drawingSvg } from '../src/drawing-svg.js'

describe('a drawing as an SVG', () => {
  it('paints in currentColor, and refuses any other colour word', () => {
    expect(drawingSvg({ d: 'M0 0Z' }, { ink: 'currentColor' })).toContain('fill="currentColor"')
    expect(drawingSvg({ d: 'M0 0Z' }, { ink: 'red' })).toContain('fill="#000000"')
  })
  it('prefixes the ids of its mask and filter', () => {
    const svg = drawingSvg({ d: 'M0 0Z', emoji: [{ text: '😀', box: [0, 0, 500, 500], cut: true }] }, { idPrefix: 'tab-3-' })
    expect(svg).toContain('<mask id="tab-3-cut">')
    expect(svg).toContain('<filter id="tab-3-emoji-cut-ink"')
    expect(svg).toContain('mask="url(#tab-3-cut)"')
    expect(drawingSvg({ d: 'M0 0Z' }, { idPrefix: '"><script>' })).not.toContain('<script>')
  })
})
