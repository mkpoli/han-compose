import { expect, test } from 'bun:test'
import faces from './fixtures/you-variants.json' with { type: 'json' }
import fangsong from './fixtures/fangsong-stroke-donor.json' with { type: 'json' }
import { EM_BOX, iou, partOf, placed, raster } from '../src/geometry.js'
import { drawingChain } from '../src/chain-corrections.js'
import { youChainDonors, youChainParts } from '../src/you-chain.js'

const korean = '#(-㇝x1㇇)', earlier = '#(㇝㇇^,0x1)'
const face = (style, exclude = []) => ({
  fontStyle: style, C: { face: EM_BOX }, excluded: key => exclude.includes(key),
  glyphRecord: char => faces[style][char] ?? (style === 'fangsong' ? fangsong[char] : null),
})

// Native outlines from the pinned Sans, Serif, FangSong, Kai and Pen exports.
// Compare in their original em against the body's contour and the added 提.
test('the Korean raised entry joins the top bar of each native 又', () => {
  expect(drawingChain(earlier)).toBe(korean)
  for (const style of Object.keys(faces)) {
    const composer = face(style)
    const [body, entry] = youChainParts(composer, korean, EM_BOX, true)
    const native = partOf(faces[style].又)
    const old = raster([placed(native, native.box, native.box, 0, '')], 192)
    const current = raster([body], 192), rising = raster([entry], 192)
    expect(iou(old, current)).toBeGreaterThan(0.84)
    expect(rising.filter((ink, i) => ink && current[i]).length).toBeGreaterThan(7)
    expect(rising.filter((ink, i) => ink && !current[i]).length).toBeGreaterThan(25)
  }
})

test('uses the regional reference fallback when a calibrated donor is excluded or revised', () => {
  for (const char of ['又', '㇀', '㇇', '㇝', korean, '刁']) {
    expect(youChainParts(face('fangsong', [char]), korean, EM_BOX, true)).toBeNull()
  }
  expect(youChainParts({ ...face('regular'), glyphRecord: char => faces.sans[char] }, korean, EM_BOX, true)).toBeNull()
  expect(youChainDonors('#(-乀x1㇇)', 'sans')).toEqual([])
  expect(youChainDonors(korean, 'fangsong')).toContain('刁')
})
