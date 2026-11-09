// The components whose font cut draws a stroke wrong: each correction is named by the description
// and tied to the outlines it was read against, so these tests exercise the correction itself on
// the shapes it was written for, and the guard that leaves another export's drawing alone.
import { describe, expect, it } from 'bun:test'
import { COMPONENT_FIXES, clippedAbove, componentFix, dotIn, narrowed, respanned, withoutContours } from '@han-compose/composer/component-fixes'
import { makePart, partOf, placed, pointsBox } from '@han-compose/composer/geometry'

/** A placed part of rectangular contours: `boxes` in font units, drawn from `source` into `target`. */
function part(origin, source, target, boxes) {
  const contours = boxes.map(([x0, y0, x1, y1]) => {
    const light = Float64Array.from([x0, y0, x1, y0, x1, y1, x0, y1])
    return { ops: [{ code: 'M' }, { code: 'L' }, { code: 'L' }, { code: 'L' }], light, heavy: light.slice(), width: null }
  })
  return placed(makePart(contours, source), source, target, 0, origin)
}

const box = contour => pointsBox(contour.light)
/** A contour's box where the part is drawn, in target units. */
const targetBox = (p, contour) => {
  const b = box(contour), s = p.source, t = p.target
  const sx = (t[2] - t[0]) / Math.max(s[2] - s[0], 1), sy = (t[3] - t[1]) / Math.max(s[3] - s[1], 1)
  return [t[0] + (b[0] - s[0]) * sx, t[1] + (b[1] - s[1]) * sy, t[0] + (b[2] - s[0]) * sx, t[1] + (b[3] - s[1]) * sy]
}
const widths = p => p.part.contours.map(c => box(c)[2] - box(c)[0])

/** A composer whose 丶 is a rectangle glyph and whose face is the usual one. */
function dotComposer() {
  const glyph = part('glyph 丶', [265, 211, 721, 616], [265, 211, 721, 616], [[265, 211, 721, 616]])
  return { face: [38, -81, 967, 840], glyph: () => glyph.part, ink: () => 1000 }
}

describe('a stroke correction', () => {
  it('cuts a contour off at a height in the box it is drawn into', () => {
    const slash = part('x', [0, 0, 100, 1000], [0, 0, 1000, 1000], [[20, 0, 80, 1000]])
    const cut = clippedAbove(slash, [0], 600)
    expect(targetBox(cut, cut.part.contours[0])[3]).toBeCloseTo(600, 6)
  })

  it('shortens a bar about its centre and moves another to a span', () => {
    const bar = part('x', [0, 0, 1000, 1000], [0, 0, 1000, 1000], [[100, 200, 900, 280], [100, 700, 900, 780]])
    expect(widths(narrowed(bar, [0], 0.5))[0]).toBeCloseTo(400, 6)
    expect(box(respanned(bar, [0], 200, 1000).part.contours[0])[0]).toBeCloseTo(200, 6)
    expect(box(respanned(bar, [0], 200, 1000).part.contours[0])[2]).toBeCloseTo(1000, 6)
  })

  it('drops a contour and places a 丶 at its own size on the band’s bottom', () => {
    const bar = part('x', [0, 0, 1000, 1000], [0, 0, 1000, 1000], [[100, 200, 900, 280], [100, 700, 900, 780]])
    expect(withoutContours(bar, [1]).part.contours).toHaveLength(1)
    const dot = dotIn(dotComposer(), [400, -80, 900, 500])
    const placed = targetBox(dot, dot.part.contours[0])
    expect(dot.origin).toBe('dot 丶')
    expect(placed[1]).toBeCloseTo(-80, 6)
    expect(placed[2] - placed[0]).toBeLessThanOrEqual(500)
  })
})

describe('a composition fix', () => {
  it('leaves the drawing alone unless the outlines are the ones the correction was read against', () => {
    const earth = part('glyph 土', [0, 0, 1000, 1000], [0, 0, 1000, 1000], [[100, 500, 900, 570]])
    expect(componentFix('⿻口土', [earth], { glyphRecord: () => null })).toEqual([earth])
    expect(componentFix('⿻土口', [earth], { glyphRecord: () => null })).toEqual([earth])
  })
})


describe('C087 ⿻日丿', () => {
  it('keeps 丿 under 日’s top bar', () => {
    const frame = part('overlay 甲', [126, 178, 877, 777], [38, 173, 967, 757],
      [[126, 178, 877, 777], [165, 468, 833, 539], [164, 233, 833, 305]])
    const slash = part('overlay 屮', [168, -82, 537, 832], [329, -81, 547, 830], [[168, -82, 537, 832]])
    const out = COMPONENT_FIXES['⿻日丿'].apply([frame, slash])
    const top = targetBox(out[1], out[1].part.contours[0])[3]
    expect(top).toBeLessThan(757 - 50)
    expect(top).toBeGreaterThan(650)
  })
})





describe('C078 ⿹⿻乛亅㇒', () => {
  it('fills its local face with the projecting head and joined diagonal of 㐧', () => {
    const bar = part('glyph 乛', [94, 483, 930, 775], [143, 359, 800, 527], [[94, 697, 869, 771], [737, 483, 930, 775]])
    const hook = part('glyph 亅', [252, -63, 548, 808], [267, 45, 500, 546], [[252, -63, 548, 808]])
    const slash = part('glyph ㇒', [87, 255, 595, 774], [300, -83, 779, 279], [[87, 255, 595, 774]])
    for (const face of [[0, 0, 1000, 1000], [100, 200, 500, 700]]) {
      const [a, b, c] = COMPONENT_FIXES['⿹⿻乛亅㇒'].apply([bar, hook, slash], { face })
      const height = face[3] - face[1]
      expect(b.target[3] - a.target[3]).toBeCloseTo(0.3 * height)
      expect(b.target[1]).toBe(face[1])
      expect(a.target[0]).toBe(face[0])
      expect(a.target[2]).toBe(face[2])
      expect(c.target[2]).toBeGreaterThan(b.target[2])
      expect(c.target[3]).toBeLessThan(a.target[3])
      expect(c.target[3]).toBeGreaterThan(a.target[1])
    }
  })
})



describe('C015 ⿰𠄠𠄠', () => {
  it('keeps 臼’s distance between the two 𠄠', () => {
    const left = part('glyph 𠄠', [56, 109, 469, 631], [56, 109, 469, 631],
      [[56, 109, 469, 171], [56, 569, 469, 631]])
    const right = part('glyph 𠄠', [537, 109, 950, 631], [537, 109, 950, 631],
      [[537, 109, 950, 171], [537, 569, 950, 631]])
    const out = COMPONENT_FIXES['⿰𠄠𠄠'].apply([left, right])
    const a = targetBox(out[0], out[0].part.contours[0]), b = targetBox(out[1], out[1].part.contours[0])
    expect(b[0] - a[2]).toBeCloseTo(0.12 * (b[2] - a[0]), 6)
    expect(b[0] - a[2]).toBeGreaterThan(100)
    expect(a[0]).toBeCloseTo(56, 6)
    expect(b[2]).toBeCloseTo(950, 6)
  })
})


describe('C072 ⿵𦉪丅', () => {
  it('fits the complete native frame and hooks into the enclosing component', () => {
    const frame = part('glyph 𦉪', [0, 0, 800, 800], [100, 0, 900, 800], [[0, 0, 800, 800]])
    const glyph = part('glyph 鬲', [0, 0, 800, 1000], [0, 0, 800, 1000],
      Array.from({ length: 9 }, () => [0, 0, 800, 450])).part
    const [out] = COMPONENT_FIXES['⿵𦉪丅'].apply([frame], { glyph: () => glyph, ink: () => 1000 })
    expect(out.part.contours).toEqual([1, 2, 3, 4, 5, 8].map(i => glyph.contours[i]))
    expect((out.target[2] - out.target[0]) / (out.target[3] - out.target[1])).toBeCloseTo(1)
    expect(out.target).toEqual(frame.target)
  })
})
describe('C049 ⿱𰀁口', () => {
  it('gives the 口 the width and height 亮 sets, with 𰀁’s stem meeting its top', () => {
    const top = part('learned 𤆖', [72, 198, 940, 834], [66, 284, 935, 842], [[72, 198, 940, 834]])
    const mouth = part('learned 吂', [175, -79, 829, 309], [173, -80, 833, 266], [[175, -79, 829, 309]])
    const out = COMPONENT_FIXES['⿱𰀁口'].apply([top, mouth], { face: [38, -81, 967, 840] })
    const t = out[1].target
    expect(t[1]).toBeCloseTo(-81, 6)
    expect(t[2] - t[0]).toBeCloseTo(0.71 * 929, 6)
    expect(t[3] - t[1]).toBeCloseTo(0.38 * 921, 6)
    // 𰀁's stem overlaps the 口's top edge, so the pair joins.
    expect(out[0].target[1]).toBeLessThan(t[3])
  })
})

describe('C070 ⿵冂丨', () => {
  it('runs the 丨 up to the frame’s top bar', () => {
    const frame = part('learned 円', [90, -81, 916, 772], [94, -60, 926, 768], [[90, -81, 916, 772]])
    const bar = part('glyph 丨', [458, -80, 539, 839], [456, -27, 531, 509], [[458, -80, 539, 839]])
    const out = COMPONENT_FIXES['⿵冂丨'].apply([frame, bar])
    expect(out[1].target[3]).toBeCloseTo(768, 6)
    expect(out[1].target[1]).toBeCloseTo(-27, 6)
    expect(out[1].target[0]).toBeCloseTo(456, 6)
  })
})










it('C085 keeps the mouth bottom clear of the earth foot', () => {
  const mouth = part('glyph 口', [0, 0, 750, 790], [100, 0, 850, 790], [[0, 0, 750, 790]])
  const earth = part('glyph 土', [0, 0, 900, 870], [50, 0, 950, 870], [[0, 0, 900, 70], [400, 0, 480, 870]])
  const [a, b] = COMPONENT_FIXES['⿻口土'].apply([mouth, earth], { face: [0, 0, 1000, 900] })
  expect(a.target[1] - b.target[1]).toBeGreaterThan(200)
  expect(b.target[3] - a.target[3]).toBeGreaterThan(100)
  expect(a.target[0]).toBeGreaterThan(b.target[0])
  expect(a.target[2]).toBeLessThan(b.target[2])
})





it('C049 sets two equal bars and a stem that reaches the mouth', () => {
  const contour = (x0, y0, x1, y1) => {
    const light = Float64Array.from([x0, y0, x1, y0, x1, y1, x0, y1])
    return { ops: [], light, heavy: light.slice(), width: null }
  }
  const cap = placed(makePart([contour(60, 600, 940, 680), contour(60, 380, 940, 460), contour(450, 200, 550, 620)]),
    [60, 200, 940, 680], [60, 200, 940, 680], 0, 'learned 𤆖')
  const mouth = part('learned 吂', [0, 0, 800, 300], [100, -80, 900, 220], [[0, 0, 800, 300]])
  const [top, lower] = COMPONENT_FIXES['⿱𰀁口'].apply([cap, mouth], { face: [38, -81, 967, 840] })
  const boxes = top.part.contours.map(contour => targetBox(top, contour)).sort((l, r) => l[1] - r[1])
  // Two bars of one span, and a stem that stands on the mouth's top edge.
  const faceWidth = 967 - 38, faceHeight = 840 + 81
  expect(boxes.filter(box => box[2] - box[0] > 0.5 * faceWidth && box[3] - box[1] < 0.2 * faceHeight)).toHaveLength(2)
  // The stem's foot reaches into the mouth's top bar.
  expect(boxes[0][1]).toBeLessThanOrEqual(lower.target[3] + 1)
})



