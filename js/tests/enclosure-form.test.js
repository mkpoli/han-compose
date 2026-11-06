import { describe, expect, it } from 'bun:test'
import { commands, drawnContours, makePart, pathRings, placed, pointsBox, svgPath } from '../src/geometry.js'
import { footMap, pressedEnclosure as press } from '../src/compose.js'

/** A contour in font units, y up. */
const contour = (ops, points, width = null) => ({ ops: commands(ops), light: Float64Array.from(points), heavy: Float64Array.from(points), width })
/** A box drawn clockwise, as the fonts draw an outline. */
const clockwise = (x0, y0, x1, y1, width = null) => contour('MLLL', [x0, y0, x0, y1, x1, y1, x1, y0], width)
/** A box drawn counter-clockwise, as the fonts draw a counter. */
const counter = (x0, y0, x1, y1) => contour('MLLL', [x0, y0, x1, y0, x1, y1, x0, y1])
/** The winding number of a point, as the browser fills the path. */
const winding = (rings, px, py) => rings.reduce((sum, ring) => {
  let count = 0
  for (let i = 0; i < ring.length; i += 2) {
    const x0 = ring[i], y0 = ring[i + 1], x1 = ring[(i + 2) % ring.length], y1 = ring[(i + 3) % ring.length]
    const side = (x1 - x0) * (py - y0) - (px - x0) * (y1 - y0)
    if (y0 <= py && y1 > py && side > 0) count++
    else if (y0 > py && y1 <= py && side < 0) count--
  }
  return sum + count
}, 0)

/** Klee One's 电: one outline of the 日 frame and the 乚, with four window counters inside it. */
const kekki = () => makePart([
  clockwise(0, 0, 1000, 800, [50, 40]),
  counter(200, 200, 400, 380),
  counter(500, 200, 700, 380),
  counter(200, 420, 400, 600),
  counter(500, 420, 700, 600),
])
const stood = part => placed(part, part.box, part.box, 1000)

describe('a glyph drawn as one outline with its counters', () => {
  it('presses its box and draws its foot out, keeping the counters inside the outline', () => {
    const glyph = stood(kekki())
    const pressed = press(glyph, 0)
    expect(pressed).not.toBeNull()
    const rings = pathRings(svgPath([pressed]))
    // Counters keep their order and stay within the pressed box: the box's right edge sits at
    // 0.485 of the width, and the foot still ends at the right edge.
    const xs = pressed.part.contours.map(c => pointsBox(c.light))
    expect(Math.max(...xs.slice(1).map(b => b[2]))).toBeCloseTo(0.485 * 700 / 900 * 1000, 1)
    expect(xs[0][2]).toBeCloseTo(1000, 6)
    // The windows are holes: the outline runs clockwise, the counters the other way.
    for (const [x, y] of [[160, 290], [320, 290], [160, 510], [320, 510]]) expect(winding(rings, x, y)).toBe(0)
    expect(winding(rings, 100, 100)).toBe(-1)
  })
  it('presses in the glyph\'s own coordinates, so a fitted placement keeps the share', () => {
    const glyph = makePart([
      clockwise(0, 0, 1000, 800, [50, 40]),
      counter(200, 200, 400, 380),
      counter(500, 200, 700, 380),
      counter(200, 420, 400, 600),
      counter(500, 420, 700, 600),
    ])
    const target = [100, 50, 600, 450], drawn = drawnContours(press(placed(glyph, glyph.box, target, 1000), 0))
    const boxes = drawn.map(pointsBox)
    // The foot ends at the target's right edge; the box's right edge (the frame, one left-frame
    // thickness past the counters) keeps 0.485 of the placed width, and the counters sit inside it.
    expect(Math.max(...boxes.map(b => b[2]))).toBeCloseTo(600, 6)
    expect(Math.max(...boxes.slice(1).map(b => b[2]))).toBeCloseTo(100 + 500 * 0.485 * 700 / 900, 1)
    expect(Math.max(...boxes.slice(1).map(b => b[2]))).toBeLessThan(100 + 500 * 0.485)
  })
  it("runs the foot through the Möbius map, not the box's linear slope", () => {
    // The outline carries a vertex at 0.95 of the width: halfway along the foot (the box ends at 0.9).
    const glyph = stood(makePart([
      contour('MLLLL', [0, 0, 0, 800, 1000, 800, 1000, 0, 950, 0], [50, 40]),
      counter(200, 200, 400, 380),
      counter(500, 200, 700, 380),
      counter(200, 420, 400, 600),
      counter(500, 420, 700, 600),
    ]))
    const light = press(glyph, 0).part.contours[0].light
    // footMap(0.5) = 0.6, so the foot's midpoint sits at 0.485 + 0.515 · 0.6 = 0.794 of the width;
    // the linear foot map would leave it at 0.7425.
    expect(light[8]).toBeCloseTo(794, 6)
    expect(light[8]).toBeGreaterThan(742.5)
    expect(light[6]).toBeCloseTo(1000, 6)
  })
  it('is left alone when it has no separate counters to press', () => {
    const glyph = stood(makePart([clockwise(0, 0, 1000, 800, [50, 40])]))
    expect(press(glyph, 0)).toBeNull()
  })
})

/** The ink a drawing covers along y = `y` between `x0` and `x1`, as one span: the leg's two edges,
 *  taken across every contour, so a seam between two of them shows up as a step in its width. */
const inkSpan = (contours, y, x0, x1) => {
  const xs = []
  for (const ring of contours) {
    for (let i = 0; i < ring.length; i += 2) {
      const ax = ring[i], ay = ring[i + 1], bx = ring[(i + 2) % ring.length], by = ring[(i + 3) % ring.length]
      if ((ay <= y) === (by <= y)) continue
      const x = ax + (bx - ax) * (y - ay) / (by - ay)
      if (x >= x0 && x <= x1) xs.push(x)
    }
  }
  return xs.length ? [Math.min(...xs), Math.max(...xs)] : null
}

/** A 电-like host: a box of four windows, a leg hanging from the stroke between them, and a floor
 *  sweeping right to a rising tip, the heavy master's leg the wider and its strokes the thicker. */
const denki = () => {
  const outline = contour('MLLLLLLLLLLL', [0, 400, 0, 1000, 800, 1000, 800, 400, 440, 400, 440, 100,
    940, 100, 940, 260, 1000, 260, 1000, 40, 380, 40, 380, 400], [50, 40])
  const heavy = Float64Array.from(outline.light)
  for (let i = 0; i < heavy.length; i += 2) {
    if (heavy[i] === 380) heavy[i] = 365
    if (heavy[i] === 440) heavy[i] = 455
    if (heavy[i + 1] === 400) heavy[i + 1] = 380
    if (heavy[i + 1] === 40) heavy[i + 1] = 20
  }
  return makePart([{ ...outline, heavy },
    counter(80, 480, 340, 660),
    counter(480, 480, 740, 660),
    counter(80, 700, 340, 880),
    counter(480, 700, 740, 880),
  ])
}

/** A 巴-like donor: a box of two windows whose left frame runs down into a floor and a rising tip,
 *  the heavy master's floor the thicker and its leg the wider. */
const baDonor = () => {
  const outline = contour('MLLLLLLLLL', [0, 1000, 700, 1000, 700, 400, 80, 400, 80, 100,
    950, 100, 950, 320, 1010, 320, 1010, 40, 0, 40])
  const heavy = Float64Array.from(outline.light)
  for (let i = 0; i < heavy.length; i += 2) {
    if (heavy[i] === 80) heavy[i] = 95
    if (heavy[i + 1] === 40) heavy[i + 1] = 20
  }
  return makePart([{ ...outline, heavy }, counter(80, 480, 340, 880), counter(420, 480, 620, 880)])
}

describe('joining a designed tail', () => {
  it("hangs 巴's sweep from the pressed 电's own leg, keeps the windows, and pairs both masters", () => {
    const glyph = stood(denki())
    const grafted = press(glyph, 0, 0.485, baDonor()), plain = press(glyph, 0)
    expect(grafted).not.toBeNull()
    const contours = grafted.part.contours
    // The host above its cut, its four windows, then the donor's leg, floor and tip.
    expect(contours.length).toBe(6)
    const [body, ...rest] = contours, tail = rest[4]
    const bodyBox = pointsBox(body.light), tailBox = pointsBox(tail.light)
    // The host keeps its box and the leg down to where the floor left it; the donor's leg stands in
    // the same column and runs up past the cut, and its tip reaches the glyph's right edge.
    expect(bodyBox[3]).toBeCloseTo(1000, 6)
    expect(bodyBox[1]).toBeGreaterThan(100)
    expect(bodyBox[1]).toBeLessThan(400)
    expect(tailBox[0]).toBeCloseTo(0.485 * 380 / 0.82, 1)
    expect(tailBox[1]).toBeCloseTo(40, 6)
    expect(tailBox[2]).toBeCloseTo(1000, 6)
    expect(tailBox[3]).toBeGreaterThan(bodyBox[1])
    // The donor's heavy master survives the cut, and the paired rings keep it.
    expect(tail.light.length).toBe(tail.heavy.length)
    expect(contours.some(c => c.heavy.some((v, i) => Math.abs(v - c.light[i]) > 1))).toBe(true)
    // The enclosure keeps the press's slot.
    expect(grafted.target).toEqual(plain.target)
    // The windows are still holes, and the leg joins the floor through solid ink.
    const rings = pathRings(svgPath([grafted]))
    for (const [x, y] of [[124, 570], [360, 570], [124, 790], [360, 790]]) expect(winding(rings, x, y)).toBe(0)
    for (const [x, y] of [[240, 300], [240, 150], [700, 70]]) expect(winding(rings, x, y)).not.toBe(0)
  })

  it('hands the leg over at one width, so the seam leaves no step', () => {
    for (const weight of [0, 1]) {
      const glyph = placed(denki(), denki().box, denki().box, 1000, 'host', [weight, weight])
      const grafted = press(glyph, 0, 0.485, baDonor())
      const drawn = drawnContours(grafted)
      // The leg's ink, read down through the seam: the body's cut sits between 100 and 400, the
      // donor's leg runs up past it, and the two share the column the counters leave.
      const widths = []
      for (let y = 340; y >= 120; y -= 10) {
        const span = inkSpan(drawn, y, 200, 300)
        expect(span).not.toBeNull()
        widths.push(span[1] - span[0])
      }
      // One stroke: the width never steps, and the leg keeps the width the press gave the host.
      const host = inkSpan(drawnContours(press(glyph, 0)), 300, 200, 300)
      for (const w of widths) expect(w).toBeCloseTo(host[1] - host[0], 2)
    }
  })

  it('carries both masters through the cut, so the leg thickens with the weight', () => {
    const glyph = stood(denki())
    const contours = press(glyph, 0, 0.485, baDonor()).part.contours
    // The host's body and the donor's tail each keep a heavy master of their own.
    for (const c of [contours[0], contours[5]]) expect(c.heavy.some((v, i) => Math.abs(v - c.light[i]) > 1)).toBe(true)
    const leg = p => { const s = inkSpan(drawnContours(p), 300, 200, 300); return s[1] - s[0] }
    const at = w => press(placed(denki(), denki().box, denki().box, 1000, 'host', [w, w]), 0, 0.485, baDonor())
    expect(leg(at(1))).toBeGreaterThan(leg(at(0)) + 10)
    // The grafted leg thickens by as much as the pressed host's own.
    const plain = w => { const s = inkSpan(drawnContours(press(placed(denki(), denki().box, denki().box, 1000, 'host', [w, w]), 0)), 300, 200, 300); return s[1] - s[0] }
    expect(leg(at(1)) - leg(at(0))).toBeCloseTo(plain(1) - plain(0), 2)
  })
})

describe('the foot map', () => {
  it('is Möbius: steeper at the box than at the tip, and monotone between', () => {
    const slope = s => (footMap(s + 1e-6) - footMap(s)) / 1e-6
    expect(footMap(0)).toBe(0)
    expect(footMap(1)).toBe(1)
    expect(slope(0)).toBeCloseTo(1.5, 3)
    expect(slope(1)).toBeCloseTo(1 / 1.5, 3)
    for (let i = 1; i <= 100; i++) expect(footMap(i / 100)).toBeGreaterThan(footMap((i - 1) / 100))
  })
})
