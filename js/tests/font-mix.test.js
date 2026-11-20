import { expect, it } from 'bun:test'
import { activeFaces, composeMixed, FONT_STYLES } from '../src/font-mix.js'
import { mixDrawings } from '../src/mix-drawings.js'
import {
  alignRings,
  groupRegions,
  prepareCorrespondence,
  splitIslands,
  tangled
} from '../src/mix-contours.js'
import { limitDisplacement } from '../src/mix-outline.js'
import { count, pathMask } from '../src/geometry.js'
import { compose } from '../src/loader.js'
import { files } from './fixtures/small-export.js'
import { sourceOver } from './support.js'

it('normalizes only active faces and rejects invalid coordinates', () => {
  const faces = activeFaces({ shares: { sans: 2, regular: 3, serif: 0 } })
  expect(faces.map((face) => face.style)).toEqual(['sans', 'regular'])
  expect(faces[0].share).toBeCloseTo(0.4)
  expect(faces[1].share).toBeCloseTo(0.6)
  for (const shares of [{}, { sans: -1 }, { sans: NaN }, { sans: Infinity }, { unknown: 1 }]) {
    expect(() => activeFaces({ shares })).toThrow()
  }
  expect(() => activeFaces({ shares: { regular: 1 }, weight: 0 })).toThrow()
})

it('reproduces each pole exactly without consulting other exports', async () => {
  const source = sourceOver(files, [])
  for (const style of FONT_STYLES) {
    const actual = await composeMixed({ [style]: source }, '⿰木口', { shares: { [style]: 4 } })
    expect(actual).toEqual(await compose(source, '⿰木口', { fontStyle: style }))
  }
})

it('moves five distinct outlines and adjusts ink while retaining the counter', () => {
  const drawings = FONT_STYLES.map((style, i) => {
    const l = 80 + 24 * i,
      r = 920 - 24 * i
    return { d: `M${l} 100L${r} 100L${r} 900L${l} 900ZM300 300L300 700L700 700L700 300Z`, kanjivg: i === 4 }
  })
  const masks = [0.65, 1, 1.5].map((weight) => {
    const mix = mixDrawings(
      drawings,
      drawings.map(() => 0.2),
      weight
    )
    expect(mix.kanjivg).toBe(true)
    const mask = pathMask(mix.d, 150)
    expect(mask[75 * 150 + 75]).toBe(0)
    return count(mask)
  })
  expect(masks[0]).toBeLessThan(masks[1])
  expect(masks[1]).toBeLessThan(masks[2])
  for (let i = 0; i < 5; i++) {
    const shares = drawings.map((_, j) => (i === j ? 0.6 : 0.1))
    expect(mixDrawings(drawings, shares, 1).d).not.toBe(drawings[i].d)
  }
})

it('preserves thin and thick disconnected strokes at minimum weight', () => {
  const d = 'M50 100L950 100L950 210L50 210ZM50 600L950 600L950 610L50 610Z'
  const thin = pathMask(mixDrawings([{ d }], [1], 0.65).d, 250)
  expect(thin[151 * 250 + 125]).toBe(1)
  expect(thin[38 * 250 + 125]).toBe(1)
  expect(count(thin)).toBeLessThan(count(pathMask(d, 250)))
})

it('keeps shared ink filled where an unchanged piece meets a mixed piece', () => {
  const rect = (left, right) => `M${left} 100L${right} 100L${right} 900L${left} 900Z`
  const drawings = [600, 800].map((right) => {
    const parts = [rect(100, 500), rect(400, right)].map((d, leaf) => ({
      d,
      leaf,
      origin: 'fixture',
      box: [0, 0, 1000, 1000]
    }))
    return { d: parts.map((p) => p.d).join(''), parts }
  })
  const mixed = mixDrawings(drawings, [0.5, 0.5], 1)
  expect(pathMask(mixed.d, 100)[50 * 100 + 45]).toBe(1)
})

it('keeps ready-to-edit operands across different donor cuts', () => {
  const leaves = [
    { index: 0, box: [0, 0, 500, 1000] },
    { index: 1, box: [500, 0, 500, 1000] }
  ]
  const drawings = ['材', '杉'].map((donor) => {
    const parts = leaves.map(({ index, box }) => ({
      origin: 'host ' + donor,
      box,
      d: `M${500 * index + 10} 10L${500 * index + 400} 10L${500 * index + 400} 800Z`
    }))
    return { d: parts.map((p) => p.d).join(''), parts }
  })
  const mixed = mixDrawings(drawings, [0.4, 0.6], 1, [leaves, leaves])
  expect(mixed.parts.map((p) => p.leaf)).toEqual([0, 1])
})

it('moves the median ink position toward each of the five poles', () => {
  const draws = FONT_STYLES.map((_, i) => ({
    d: `M${50 + i * 140} 100L${210 + i * 140} 100L${210 + i * 140} 900L${50 + i * 140} 900Z`
  }))
  const centre = (d) => {
    const mask = pathMask(d, 100)
    return mask.reduce((sum, p, i) => sum + p * (i % 100), 0) / count(mask)
  }
  const neutral = centre(mixDrawings(draws, [0.2, 0.2, 0.2, 0.2, 0.2], 1).d)
  draws.forEach((pole, i) => {
    const biased = centre(
      mixDrawings(
        draws,
        draws.map((_, j) => (i === j ? 0.6 : 0.1)),
        1
      ).d
    )
    expect(Math.abs(biased - (neutral + centre(pole.d)) / 2)).toBeLessThan(1)
  })
})

it('keeps the flank of a slanted stem straight as its weight changes', () => {
  const drawing = { d: 'M190 100L260 100L500 900L430 900Z' }
  for (const weight of [0.65, 1.35, 1.5]) {
    const d = mixDrawings([drawing], [1], weight).d
    const side = 500,
      mask = pathMask(d, side)
    const edges = []
    for (let y = 100; y < 400; y++) {
      const start = mask.subarray(y * side, (y + 1) * side).indexOf(1)
      expect(start).toBeGreaterThan(0)
      edges.push(start - y * 0.3)
    }
    expect(Math.max(...edges) - Math.min(...edges)).toBeLessThan(1.5)
  }
})

it('converges to either original outline as the other face enters the mix', () => {
  const serif = {
    d: 'M40 210L330 226L425 166L495 222L840 210L961 155L930 256L470 258L446 900L380 910L377 260L50 266Z'
  }
  const fangsong = {
    d: 'M60 240Q370 230 520 186L909 148L954 157L922 193L532 224L490 870L450 909L472 234L70 262Z'
  }
  for (const [source, other] of [
    [serif, fangsong],
    [fangsong, serif]
  ]) {
    const actual = mixDrawings([source, other], [0.999999, 0.000001], 1)
    expect(pathMask(actual.d, 192)).toEqual(pathMask(source.d, 192))
  }
})

it('keeps a two-face path stable when a trace share changes the number of islands', () => {
  const left = { d: 'M40 80L380 120L210 910L115 860Z' }
  const right = { d: 'M110 170L405 190L250 908L208 820Z' }
  const extra = { d: 'M110 210L301 225L146 510ZM360 670L410 705L221 960Z' }
  const pair = mixDrawings([left, right], [0.5, 0.5], 1)
  const near = mixDrawings([extra, left, right], [0.000002, 0.499999, 0.499999], 1)
  expect(pathMask(near.d, 192)).toEqual(pathMask(pair.d, 192))
})

it('approaches the operand-wise blend when the disappearing face has no parts', () => {
  const source = (boxes) => {
    const parts = boxes.map(([x, y, w, h], leaf) => ({
      leaf,
      box: [x, y, w, h],
      origin: 'fixture',
      d: `M${x} ${y}L${x + w} ${y}L${x + w} ${y + h}L${x} ${y + h}Z`
    }))
    return { d: parts.map((p) => p.d).join(''), parts }
  }
  const a = source([
    [20, 80, 210, 720],
    [700, 180, 160, 500]
  ])
  const b = source([
    [40, 230, 320, 440],
    [460, 100, 300, 710]
  ])
  const flat = { d: 'M200 100L800 200L570 800Z' }
  const edge = mixDrawings([a, b], [0.5, 0.5], 1)
  const almost = mixDrawings([a, b, flat], [0.4999995, 0.4999995, 0.000001], 1)
  let previous = pathMask(edge.d, 480)
  expect(pathMask(almost.d, 480)).toEqual(previous)
  // Exercise the entire transition from per-operand to whole-glyph mixing.
  for (let step = 1; step <= 90; step++) {
    const share = step / 500
    const rest = (1 - share) / 2
    const mask = pathMask(mixDrawings([a, b, flat], [rest, rest, share], 1).d, 480)
    const changed = mask.reduce((sum, pixel, i) => sum + Math.abs(pixel - previous[i]), 0)
    // The largest step is where the whole-glyph mix joins two islands and they stop
    // moving with the operand-wise blend.
    expect(changed / count(previous)).toBeLessThan(0.045)
    previous = mask
  }
})

it('brings in an initially absent subtraction in proportion to its share', () => {
  const base = { d: 'M10 10L990 10L990 990L10 990Z' }
  const other = { ...base, cut: 'M250 250L750 250L750 750L250 750Z' }
  const ink = (share) => count(pathMask(mixDrawings([base, other], [1 - share, share], 1).cut, 192))
  expect(ink(0.0001)).toBeLessThan(5)
  expect(ink(0.25)).toBeGreaterThan(1500)
  expect(ink(0.25)).toBeLessThan(3000)
})

it('retains the original serif tips when the weight leaves neutral', () => {
  const d = 'M80 175Q550 255 815 172L925 50L913 216L470 242L432 869L380 914L377 246L88 218Z'
  for (const weight of [0.999999, 1.000001]) {
    expect(pathMask(mixDrawings([{ d }], [1], weight).d, 256)).toEqual(pathMask(d, 256))
  }
})

it('keeps matching the islands two faces share when one face joins two of them', () => {
  const box = (x, y, right, bottom) => [
    [x, y],
    [right, y],
    [right, bottom],
    [x, bottom],
    [x, y]
  ]
  const split = [box(20, 20, 200, 32), box(20, 60, 200, 72), box(20, 100, 200, 112), box(60, 150, 90, 230)]
  // The second face draws the lower two bars as one island and shifts every stroke.
  const joined = [box(24, 26, 204, 36), box(24, 64, 204, 116), box(64, 154, 96, 236)]
  const groups = groupRegions([split, joined], (ring) => ring, 15)
  const sizes = groups.map((group) => group.map((face) => face.length)).sort()
  expect(sizes).toEqual([
    [1, 1],
    [1, 1],
    [2, 1]
  ])
  expect(groups.find((group) => group[0].length === 2)[1]).toEqual([joined[1]])
  // An island with no counterpart joins its nearest group instead of standing alone.
  const extra = groupRegions([[...split, box(210, 20, 220, 30)], joined], (ring) => ring, 15)
  expect(extra.every((group) => group.every((face) => face.length > 0))).toBe(true)
  expect(extra.flatMap((group) => group[0]).length).toBe(5)
})

it('keeps a drawing whole inside a wide band around a small or thin boundary', () => {
  const drawing = 'M90 90L130 90L130 130L90 130Z'
  const ink = (d) => count(pathMask(d, 256))
  for (const boundary of ['M100 100L108 100L108 108L100 108Z', 'M100 100L400 100L400 104L100 104Z'])
    for (const radius of [150, 300, 700])
      expect(ink(limitDisplacement(drawing, boundary, radius))).toBe(ink(drawing))
  // A narrow band still clips ink that lies beyond it.
  expect(ink(limitDisplacement(drawing, 'M100 100L108 100L108 108L100 108Z', 5))).toBeLessThan(ink(drawing))
})

it('blends straight edges into straight edges and shrinks a tip one face lacks', () => {
  const closed = (points) => [...points, points[0]]
  const bar = closed([
    [40, 100],
    [200, 100],
    [200, 120],
    [40, 120]
  ])
  // The same bar, moved and thinner, with a triangular tip above its right end.
  const tipped = closed([
    [50, 104],
    [180, 104],
    [196, 90],
    [212, 104],
    [212, 114],
    [50, 114]
  ])
  const [plain, serif] = alignRings([bar, tipped])
  expect(plain.length).toBe(serif.length)
  const onEdges = (points, ring) =>
    points.every((p) =>
      ring.slice(1).some((b, i) => {
        const a = ring[i],
          length = Math.hypot(b[0] - a[0], b[1] - a[1])
        const off = Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / length
        const along = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / length ** 2
        return off < 1e-6 && along > -1e-6 && along < 1 + 1e-6
      })
    )
  // Each face keeps its own outline, corners included.
  expect(onEdges(plain, bar)).toBe(true)
  expect(onEdges(serif, tipped)).toBe(true)
  for (const corner of tipped.slice(0, -1))
    expect(serif.some((p) => Math.hypot(p[0] - corner[0], p[1] - corner[1]) < 1e-6)).toBe(true)
  const half = plain.map((p, i) => [(p[0] + serif[i][0]) / 2, (p[1] + serif[i][1]) / 2])
  // Halfway, the bottom and left edges are straight lines between the two bars' edges…
  const bottom = half.filter((p) => p[1] > 116.9)
  expect(bottom.length).toBeGreaterThan(20)
  expect(bottom.every((p) => Math.abs(p[1] - 117) < 1e-6)).toBe(true)
  expect(half.filter((p) => p[0] < 45.1).every((p) => Math.abs(p[0] - 45) < 1e-6)).toBe(true)
  // …and the tip stands at half its height above the halfway top edge.
  expect(Math.min(...half.map((p) => p[1]))).toBeCloseTo(95, 0)
})

it('blends each labelled stroke on its own when two strokes overlap', () => {
  const bar = (x, y, right, bottom) => `M${x} ${y}L${right} ${y}L${right} ${bottom}L${x} ${bottom}Z`
  // A cross: every face draws the two strokes as separate, overlapping contours.
  const face = (h, v) => ({
    d: h + v,
    parts: [
      {
        leaf: 0,
        origin: 'glyph 十',
        box: [100, 100, 800, 800],
        d: h + v,
        strokes: [
          [1, [0]],
          [2, [1]]
        ]
      }
    ]
  })
  const thin = face(bar(100, 480, 900, 520), bar(480, 100, 520, 900))
  const wide = face(bar(100, 420, 900, 580), bar(420, 100, 580, 900))
  const mixed = mixDrawings([thin, wide], [0.5, 0.5], 1)
  const expected = pathMask(bar(100, 450, 900, 550) + bar(450, 100, 550, 900), 200)
  const actual = pathMask(mixed.d, 200)
  let differing = 0
  for (let i = 0; i < expected.length; i++) differing += expected[i] !== actual[i]
  // The blend is the cross of half-way bars with square inner corners, to within the outline's pixels.
  expect(differing).toBeLessThan(120)
})

it('pairs the same corners however finely one face draws an edge', () => {
  const closed = (points) => [...points, points[0]]
  // An L-shaped stroke: a top bar and a left stem, as one contour.
  const elbow = (thick, reach, drop) =>
    closed([
      [20, 20],
      [reach, 20],
      [reach, 20 + thick],
      [20 + thick, 20 + thick],
      [20 + thick, drop],
      [20, drop]
    ])
  const plain = elbow(12, 200, 230)
  const other = elbow(8, 190, 236)
  // The same outline with its foot drawn as many short segments.
  const [a, b, c, d, e, f, g] = other
  const foot = Array.from({ length: 40 }, (_, i) => [e[0] - ((e[0] - f[0]) * (i + 1)) / 41, e[1]])
  const dense = [a, b, c, d, e, ...foot, f, g]
  for (const face of [other, dense]) {
    const [first, second] = alignRings([plain, face])
    const half = first.map((p, i) => [(p[0] + second[i][0]) / 2, (p[1] + second[i][1]) / 2])
    // The inner elbows meet: halfway there is a point at their mean.
    expect(half.some((p) => Math.hypot(p[0] - 30, p[1] - 30) < 1e-6)).toBe(true)
    // The stem's inner edge stays vertical.
    const inner = half.filter((p) => p[1] > 40 && p[1] < 220 && p[0] > 25)
    expect(inner.length).toBeGreaterThan(20)
    expect(inner.every((p) => Math.abs(p[0] - 30) < 1e-6)).toBe(true)
  }
})

it('falls back to islands when two faces number their strokes differently', () => {
  const bar = (x, y, right, bottom) => `M${x} ${y}L${right} ${y}L${right} ${bottom}L${x} ${bottom}Z`
  const face = (h, v, ids) => ({
    d: h + v,
    parts: [
      {
        leaf: 0,
        origin: 'glyph 二',
        box: [100, 100, 800, 800],
        d: h + v,
        strokes: ids.map((id, i) => [id, [i]])
      }
    ]
  })
  // Two bars far apart; the second face numbers them the other way round.
  const one = face(bar(100, 100, 900, 160), bar(100, 840, 900, 900), [1, 2])
  const two = face(bar(100, 110, 900, 150), bar(100, 850, 900, 890), [2, 1])
  const mixed = mixDrawings([one, two], [0.5, 0.5], 1)
  const expected = pathMask(bar(100, 105, 900, 155) + bar(100, 845, 900, 895), 200)
  const actual = pathMask(mixed.d, 200)
  let differing = 0
  for (let i = 0; i < expected.length; i++) differing += expected[i] !== actual[i]
  expect(differing).toBeLessThan(120)
})

it('tells a counter that leaves its frame from one that stays inside', () => {
  const square = (x, y, side) => [
    [x, y],
    [x + side, y],
    [x + side, y + side],
    [x, y + side]
  ]
  expect(tangled([square(0, 0, 100), square(20, 20, 30), square(60, 60, 30)])).toBe(false)
  expect(tangled([square(0, 0, 100), square(80, 20, 30)])).toBe(true)
  expect(tangled([square(0, 0, 100), square(120, 20, 30)])).toBe(true)
  expect(tangled([square(0, 0, 100), square(20, 20, 30), square(40, 40, 30)])).toBe(true)
  expect(
    tangled([
      [
        [0, 0],
        [100, 100],
        [100, 0],
        [0, 100]
      ]
    ])
  ).toBe(true)
})

const box = (x, y, w, h, hole = false) => {
  const ring = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
    [x, y]
  ]
  return hole ? ring.reverse() : ring
}
const inkOf = (rings) =>
  rings.reduce((sum, ring) => {
    let twice = 0
    for (let i = 0; i + 1 < ring.length; i++)
      twice += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    return sum + twice / 2
  }, 0)

it('blends a stroke that stands clear in one face and touches its neighbour in another', () => {
  // Two bars side by side against one bar spanning both.
  const apart = [[box(20, 100, 90, 40)], [box(130, 100, 100, 40)]]
  const fused = [[box(20, 100, 210, 40)]]
  for (const faces of [
    [apart, fused],
    [fused, apart]
  ]) {
    const regions = splitIslands(faces)
    // The spanning bar is cut where the others part, one piece for each.
    expect(regions).toHaveLength(2)
    const blends = regions.map((region) => prepareCorrespondence(region))
    expect(blends.every(Boolean)).toBe(true)
    const own = faces[0] === apart ? [1, 0] : [0, 1]
    const spans = (shares) =>
      blends.map((blend) => {
        const xs = blend(shares, 1).flatMap((ring) => ring.map((p) => p[0]))
        return [Math.min(...xs), Math.max(...xs)]
      })
    // Each bar keeps its own ends, and halfway the gap between them has half closed.
    expect(spans(own)[0][1]).toBeCloseTo(110, 0)
    expect(spans(own)[1][0]).toBeCloseTo(130, 0)
    const [left, right] = spans([0.5, 0.5])
    expect(left[0]).toBeCloseTo(20, 0)
    expect(right[1]).toBeCloseTo(230, 0)
    expect(right[0] - left[1]).toBeGreaterThan(4)
    expect(right[0] - left[1]).toBeLessThan(12)
  }
})

it('opens a counter where a face stops its bar short of the frame', () => {
  // A frame with a bar across it against the same frame with the bar ending early.
  const closed = [[box(20, 20, 200, 200), box(40, 40, 160, 70, true), box(40, 130, 160, 70, true)]]
  const gap = [
    [20, 20],
    [220, 20],
    [220, 220],
    [20, 220],
    [20, 20]
  ]
  const open = [
    [
      gap,
      [
        [40, 40],
        [40, 200],
        [200, 200],
        [200, 130],
        [70, 130],
        [70, 110],
        [200, 110],
        [200, 40],
        [40, 40]
      ]
    ]
  ]
  const blend = prepareCorrespondence([closed, open])
  expect(blend).not.toBeNull()
  // The open face's one counter is cut at the gap into the two the closed face has.
  expect(blend([0.5, 0.5], 1)).toHaveLength(3)
  const closedInk = 200 * 200 - 2 * 160 * 70,
    openInk = 200 * 200 - 160 * 160 + 130 * 20
  expect(Math.abs(inkOf(blend([1, 0], 1)))).toBeCloseTo(closedInk, -2)
  expect(Math.abs(inkOf(blend([0, 1], 1)))).toBeCloseTo(openInk, -2)
  const halfway = Math.abs(inkOf(blend([0.5, 0.5], 1)))
  expect(halfway).toBeGreaterThan(openInk)
  expect(halfway).toBeLessThan(closedInk)
})

it('cuts a fused island clear of its counter', () => {
  // A long bar with a window against a windowed block and a plain block side by side.
  const fused = [[box(20, 100, 210, 40), box(60, 110, 90, 20, true)]]
  const apart = [[box(20, 100, 150, 40), box(60, 110, 90, 20, true)], [box(190, 100, 40, 40)]]
  const regions = splitIslands([fused, apart])
  expect(regions).toHaveLength(2)
  // The window stays whole in the piece that pairs with the windowed block.
  const windowed = regions.find((region) => region[1][0].length === 2)
  expect(windowed[0][0]).toHaveLength(2)
  const xs = windowed[0][0][0].map((p) => p[0])
  expect(Math.max(...xs)).toBeGreaterThan(150)
  expect(regions.find((region) => region !== windowed)[0][0]).toHaveLength(1)
})
