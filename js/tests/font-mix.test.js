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
import { inkPolygons, limitDisplacement } from '../src/mix-outline.js'
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
  // The closed face's bar is slit at the open end so both faces share the open-bar topology.
  const halfwayRings = blend([0.5, 0.5], 1)
  expect(halfwayRings).toHaveLength(2)
  const closedInk = 200 * 200 - 2 * 160 * 70,
    openInk = 200 * 200 - 160 * 160 + 130 * 20
  expect(Math.abs(inkOf(blend([1, 0], 1)))).toBeCloseTo(closedInk, -2)
  expect(Math.abs(inkOf(blend([0, 1], 1)))).toBeCloseTo(openInk, -2)
  const halfway = Math.abs(inkOf(halfwayRings))
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

it('pairs a small island with its counterpart when it overlaps a neighbour', () => {
  // One face fuses a dot onto a bar. The other face's small island sits over the block's
  // edge, so by overlap it would go to the block and leave the first face's small island unpaired.
  const fused = [
    [box(20, 20, 100, 200)],
    [box(130, 60, 16, 40)],
    [
      [
        [170, 20],
        [190, 20],
        [190, 60],
        [220, 60],
        [220, 74],
        [190, 74],
        [190, 220],
        [170, 220],
        [170, 20]
      ]
    ]
  ]
  const apart = [
    [box(20, 20, 100, 200)],
    [box(104, 60, 16, 40)],
    [box(170, 20, 20, 200)],
    [box(196, 60, 24, 14)]
  ]
  const regions = splitIslands([fused, apart])
  expect(regions).toHaveLength(4)
  const width = (/** @type {number[][]} */ ring) =>
    Math.max(...ring.map((p) => p[0])) - Math.min(...ring.map((p) => p[0]))
  // The two small islands go together, and the block stays whole.
  const small = regions.find((region) => Math.abs(width(region[1][0][0]) - 16) < 1)
  expect(width(small[0][0][0])).toBeCloseTo(16, 0)
  const block = regions.find((region) => width(region[1][0][0]) > 90)
  expect(width(block[0][0][0])).toBeCloseTo(100, 0)
})

it('drops negligible dust holes while keeping intentional small detached islands', () => {
  // Two kissing strokes leaving a 0.5x0.5 sliver hole, plus a genuine small detached dot.
  const frame = [20, 20, 220, 20, 220, 220, 20, 220]
  const realHole = [50, 50, 50, 190, 190, 190, 190, 50]
  const dustHole = [200, 140, 200, 140.5, 200.5, 140.5, 200.5, 140]
  const polygons = inkPolygons([frame, realHole, dustHole])
  expect(polygons).toHaveLength(1)
  expect(polygons[0]).toHaveLength(2)
  // A 3x3 detached dot in font units survives mixing intact and keeps its horizontal extent.
  const dot = 'M800 500L803 500L803 503L800 503Z'
  const a = { d: 'M100 100L700 100L700 900L100 900Z' + dot }
  const b = { d: 'M100 101L700 101L700 900L100 900Z' + dot }
  const mixed = mixDrawings([a, b], [0.5, 0.5], 1)
  const mask = pathMask(mixed.d, 250)
  let maxCol = 0
  for (let y = 0; y < 250; y++) for (let x = 0; x < 250; x++) if (mask[y * 250 + x] && x > maxCol) maxCol = x
  expect(maxCol).toBeGreaterThan(190)
})

it('keeps open bars full thickness without a connecting thread when exterior overlaps a wider donor counter', () => {
  // Closed frame (月-like) with two closed counters spanning x=50..190.
  const closed = [
    [
      [
        [20, 20],
        [210, 20],
        [210, 230],
        [190, 230],
        [190, 160],
        [50, 160],
        [50, 230],
        [20, 230],
        [20, 20]
      ],
      box(50, 40, 140, 45, true),
      box(50, 100, 140, 45, true)
    ]
  ]
  // Narrower open frame whose exterior right wall (x=175) runs inside the closed face's counters (x=50..190),
  // and both bars stop 15 units short of its inner right wall (x=155).
  const open = [
    [
      [
        [35, 20],
        [175, 20],
        [175, 230],
        [155, 230],
        [155, 40],
        [55, 40],
        [55, 85],
        [140, 85],
        [140, 100],
        [55, 100],
        [55, 145],
        [140, 145],
        [140, 160],
        [55, 160],
        [55, 230],
        [35, 230],
        [35, 20]
      ]
    ]
  ]
  const blend = prepareCorrespondence([closed, open])
  expect(blend).not.toBeNull()
  const rings = blend([0.5, 0.5], 1)
  expect(rings).toHaveLength(1)
  // Both bars slide at full thickness (x=155 is inside the blended bar) and leave a clean open gap at x=169.
  const insideRing = ([x, y], ring) => {
    let hit = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i],
        b = ring[j]
      if (a[1] > y !== b[1] > y && x < a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1])) hit = !hit
    }
    return hit
  }
  const inkSpan = (x, y0, y1) => {
    let countInk = 0
    for (let y = y0; y <= y1; y += 0.5)
      if (insideRing([x, y], rings[0]) && !rings.slice(1).some((h) => insideRing([x, y], h))) countInk += 0.5
    return countInk
  }
  expect(inkSpan(155, 80, 105)).toBeGreaterThan(12)
  expect(inkSpan(155, 140, 165)).toBeGreaterThan(12)
  expect(inkSpan(169, 80, 105)).toBe(0)
  expect(inkSpan(169, 140, 165)).toBe(0)
})

it('merges a shifted counter stack into the open-bar counter of the coarser face regardless of counter order', () => {
  // Three stacked counters in face A (y=60..210) vs one merged counter shifted down in face B (y=95..215, open on left).
  const frame = box(30, 20, 180, 210)
  const holes = [box(50, 60, 140, 40, true), box(50, 115, 140, 40, true), box(50, 170, 140, 40, true)]
  const shifted = [
    [
      frame,
      [
        [55, 95],
        [55, 215],
        [185, 215],
        [185, 180],
        [75, 180],
        [75, 170],
        [185, 170],
        [185, 140],
        [75, 140],
        [75, 130],
        [185, 130],
        [185, 95],
        [55, 95]
      ]
    ]
  ]
  const insideRing = ([x, y], ring) => {
    let hit = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i],
        b = ring[j]
      if (a[1] > y !== b[1] > y && x < a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1])) hit = !hit
    }
    return hit
  }
  const hasInk = (rings, pt) => insideRing(pt, rings[0]) && !rings.slice(1).some((h) => insideRing(pt, h))
  for (const ordered of [holes, holes.slice().reverse()]) {
    const blend = prepareCorrespondence([[[frame, ...ordered]], shifted])
    expect(blend).not.toBeNull()
    const half = blend([0.5, 0.5], 1)
    expect(half).toHaveLength(2)
    // Open on the left (x=58 clear of ink across both bars), solid bar on the right (x=150).
    expect(hasInk(half, [58, 120])).toBe(false)
    expect(hasInk(half, [58, 168])).toBe(false)
    expect(hasInk(half, [150, 120])).toBe(true)
    expect(hasInk(half, [150, 168])).toBe(true)
  }
  // Right-opening bar shifted down by 25 units chooses the right stem identically under either counter order.
  const rightFrame = box(0, 0, 200, 140)
  const rightHoles = [box(20, 15, 160, 20, true), box(20, 45, 160, 20, true)]
  const rightOpen = [
    [
      rightFrame,
      [
        [20, 40],
        [20, 60],
        [150, 60],
        [150, 70],
        [20, 70],
        [20, 90],
        [180, 90],
        [180, 40],
        [20, 40]
      ]
    ]
  ]
  for (const ordered of [rightHoles, rightHoles.slice().reverse()]) {
    const blend = prepareCorrespondence([[[rightFrame, ...ordered]], rightOpen])
    expect(blend).not.toBeNull()
    const half = blend([0.5, 0.5], 1)
    expect(half).toHaveLength(2)
    // Solid bar near left stem (x=50), clean open gap near right stem (x=172).
    expect(hasInk(half, [50, 52])).toBe(true)
    expect(hasInk(half, [172, 52])).toBe(false)
  }
})

it('keeps counter stacks in order across three faces and large shifted stacks without swapping holes', () => {
  // Face A: two counters at y=36..42 and y=54..60.
  // Face B: one counter joining them through a narrow channel.
  // Face C: two counters shifted down to y=56..62 and y=74..80 (greedy matching swaps 36->74, 54->56).
  const frame = box(10, 10, 200, 110)
  const faceA = [[frame, box(30, 36, 140, 6, true), box(30, 54, 140, 6, true)]]
  const faceB = [
    [
      frame,
      [
        [30, 36],
        [30, 60],
        [170, 60],
        [170, 54],
        [44, 54],
        [44, 42],
        [170, 42],
        [170, 36],
        [30, 36]
      ]
    ]
  ]
  const faceC = [[frame, box(30, 56, 140, 6, true), box(30, 74, 140, 6, true)]]
  const blend = prepareCorrespondence([faceA, faceB, faceC])
  expect(blend).not.toBeNull()
  expect(blend([0.25, 0.25, 0.5], 1)).toHaveLength(2)
  // Even with 13 uniformly shifted counters (>12), optimal assignment preserves every hole.
  const tallFrame = box(0, 0, 950, 950)
  const stackA = [tallFrame, ...Array.from({ length: 13 }, (_, k) => box(400, 100 + 50 * k, 100, 10, true))]
  const stackB = [tallFrame, ...Array.from({ length: 13 }, (_, k) => box(400, 145 + 50 * k, 100, 10, true))]
  const stackBlend = prepareCorrespondence([[stackA], [stackB]])
  expect(stackBlend).not.toBeNull()
  expect(stackBlend([12 / 13, 1 / 13], 1)).toHaveLength(14)
})

it('rejects a counter cut correspondence when a moving counter would sever the exterior frame', () => {
  // Dumbell frame: left block (0,40)-(25,75), bridge (25,48)-(35,52), right block (35,0)-(200,190).
  const dumbell = [
    [0, 40],
    [25, 40],
    [25, 48],
    [35, 48],
    [35, 0],
    [200, 0],
    [200, 190],
    [35, 190],
    [35, 52],
    [25, 52],
    [25, 75],
    [0, 75],
    [0, 40]
  ]
  const faceA = [[dumbell, box(5, 45, 15, 10, true), box(5, 60, 15, 10, true)]]
  const faceB = [
    [
      dumbell,
      [
        [40, 45],
        [40, 70],
        [55, 70],
        [55, 60],
        [44, 60],
        [44, 55],
        [55, 55],
        [55, 45],
        [40, 45]
      ]
    ]
  ]
  expect(prepareCorrespondence([faceA, faceB])).toBeNull()
  // Shifted further right so the counter clears the bridge at 50/50 but would sever it at 75% A / 25% B.
  const faceBShifted = [[dumbell, faceB[0][1].map(([x, y]) => [x + 35, y])]]
  expect(prepareCorrespondence([faceA, faceBShifted])).toBeNull()
  // Narrow 4x3 bridge cleared at 25%, 50%, and 75% yet severed around 37% as a small counter crosses it.
  const narrowBridge = [
    [0, 0],
    [48, 0],
    [48, 55],
    [52, 55],
    [52, 0],
    [210, 0],
    [210, 110],
    [52, 110],
    [52, 58],
    [48, 58],
    [48, 110],
    [0, 110],
    [0, 0]
  ]
  const leftClosed = [[narrowBridge, box(10, 43, 10, 11, true), box(10, 59, 10, 11, true)]]
  const rightOpenFar = [
    [
      narrowBridge,
      [
        [117, 43],
        [117, 70],
        [127, 70],
        [127, 59],
        [121, 59],
        [121, 54],
        [127, 54],
        [127, 43],
        [117, 43]
      ]
    ]
  ]
  expect(prepareCorrespondence([leftClosed, rightOpenFar])).toBeNull()
})

it('keeps an open bar at full thickness with a clean open gap halfway and open at bold weight near the open pole', () => {
  const closed = {
    d: 'M100 100L900 100L900 900L100 900ZM180 180L180 460L820 460L820 180ZM180 540L180 820L820 820L820 540Z'
  }
  const open = {
    d: 'M100 100L900 100L900 900L100 900ZM180 180L180 820L820 820L820 540L300 540L300 460L820 460L820 180Z'
  }
  // Near the open face (5% closed) at bold weight 1.35, the open gap stays open.
  const bold = mixDrawings([closed, open], [0.05, 0.95], 1.35)
  const boldMask = pathMask(bold.d, 200)
  expect(boldMask[100 * 200 + 46]).toBe(0)
  // Halfway at neutral weight, the open gap (col 42) stays completely clear with no thin connecting line,
  // while the bar keeps full thickness right behind the moving tip (col 55) and in the body (col 100).
  const half = mixDrawings([closed, open], [0.5, 0.5], 1)
  const halfMask = pathMask(half.d, 200)
  const colInk = (col) => {
    let s = 0
    for (let row = 85; row <= 115; row++) s += halfMask[row * 200 + col]
    return s
  }
  expect(colInk(42)).toBe(0)
  expect(colInk(55)).toBeGreaterThanOrEqual(14)
  expect(colInk(100)).toBeGreaterThanOrEqual(14)
})

it('falls back to whole-island blending when a labelled stroke fuses a perpendicular bar in one face', () => {
  // Narrow 口-like component (x=100..618, y=120..880) whose unit centres stay within 0.3 * side:
  // Face A splits it into left stem | (contour 1) and top+right+bottom コ (contour 0).
  // Face B splits it into left+top ┌ (contour 0), bottom _ (contour 1), and right | (contour 2).
  // Same stroke IDs [0, 1, 2], but unit 0 is >3x wider in face B, so per-unit blending cracks the top bar.
  const dA =
    'M142 120L618 120L618 880L142 880L142 800L562 800L562 200L142 200Z' + 'M100 120L156 120L156 880L100 880Z'
  const dB =
    'M100 120L618 120L618 200L156 200L156 880L100 880Z' +
    'M142 800L618 800L618 880L142 880Z' +
    'M562 120L618 120L618 880L562 880Z'
  const faceA = {
    d: dA,
    parts: [
      {
        leaf: 0,
        origin: 'fixture',
        box: [100, 120, 518, 760],
        d: dA,
        strokes: [
          [0, [1]],
          [1, [0]],
          [2, [0]]
        ]
      }
    ]
  }
  const faceB = {
    d: dB,
    parts: [
      {
        leaf: 0,
        origin: 'fixture',
        box: [100, 120, 518, 760],
        d: dB,
        strokes: [
          [0, [0]],
          [1, [2]],
          [2, [1]]
        ]
      }
    ]
  }
  const mixed = mixDrawings([faceA, faceB], [0.5, 0.5], 1)
  const mask = pathMask(mixed.d, 200)
  // Top bar stays solid and unbroken across its full width (cols 45..100, rows 20..44).
  for (const col of [45, 60, 75, 85, 100]) {
    let ink = 0
    for (let row = 20; row <= 44; row++) ink += mask[row * 200 + col]
    expect(ink).toBeGreaterThanOrEqual(14)
  }
})

it('cuts a fused top dot at its horizontal neck without stealing the right half of the roof', () => {
  // 广-like fused island: roof bar (height 16, y=48..64) with a wider vertical dot (width 22, x=122..144) on top.
  const fused = [
    [
      [
        [16, 48],
        [122, 48],
        [122, 16],
        [144, 16],
        [144, 48],
        [234, 48],
        [234, 64],
        [36, 64],
        [36, 240],
        [16, 240],
        [16, 48]
      ]
    ]
  ]
  // Strictly disjoint two-island face (roof y=53..65, slanted dot y=16..51) whose dot spans wider across the roof top.
  const apart = [
    [
      [
        [16, 53],
        [234, 53],
        [234, 65],
        [36, 65],
        [36, 240],
        [16, 240],
        [16, 53]
      ]
    ],
    [
      [
        [108, 16],
        [136, 16],
        [164, 51],
        [132, 51],
        [108, 16]
      ]
    ]
  ]
  const regions = splitIslands([fused, apart])
  expect(regions).toHaveLength(2)
  // Identify roof vs dot by target maxY, and verify the cut keeps the full roof intact and cuts the dot horizontally.
  const roof = regions.find((r) => Math.max(...r[1][0][0].map((p) => p[1])) > 150)
  const dot = regions.find((r) => r !== roof)
  expect(Math.max(...roof[0][0][0].map((p) => p[0]))).toBeGreaterThan(220)
  expect(Math.max(...dot[0][0][0].map((p) => p[0]))).toBeLessThan(155)
  expect(Math.max(...dot[0][0][0].map((p) => p[1]))).toBeLessThan(55)
  // Three-target fused roof with two dots still splits cleanly into all three regions.
  const rect = (a, b, c, d) => [a, b, c, b, c, d, a, d]
  const roofPoly = (y, b) => [16, y, 240, y, 240, b, 37, b, 37, 214, 16, 214]
  const fused3 = inkPolygons([roofPoly(47, 56), rect(56, 16, 79, 48), rect(115, 21, 158, 48)])
  const apart3 = inkPolygons([roofPoly(52, 60), rect(56, 16, 77, 46), [100, 33, 118, 33, 97, 43, 80, 43]])
  expect(splitIslands([fused3, apart3])).toHaveLength(3)
})

it('cuts a stroke at the notches where it leaves a stem when asked to', () => {
  // An arm leaves a stem's right wall, 16 thick at its root and 12 at a waist further out;
  // the other face draws only the outer end of it as a separate island.
  const fused = [
    [
      [
        [40, 20],
        [60, 20],
        [60, 100],
        [85, 102],
        [130, 100],
        [130, 116],
        [85, 114],
        [60, 116],
        [60, 230],
        [40, 230],
        [40, 20]
      ]
    ]
  ]
  const apart = [[box(40, 20, 20, 210)], [box(100, 100, 30, 16)]]
  const reach = (/** @type {boolean} */ anchored) => {
    const regions = splitIslands([fused, apart], anchored)
    expect(regions).toHaveLength(2)
    const stem = regions.find((region) => Math.min(...region[1][0][0].map((p) => p[0])) < 50)
    return Math.max(...stem[0][0][0].map((p) => p[0]))
  }
  // The narrowest cut leaves the root of the arm on the stem; the anchored one takes it off by the wall.
  expect(reach(false)).toBeGreaterThan(75)
  expect(reach(true)).toBeLessThan(67)
})

it('does not pair distant leftover corners at opposite ends of a long stem wall', () => {
  // Two 口-like outer contours where face A has an extra sharp bottom-left corner at (16, 240)
  // and face B has a gentle extra corner near the top-left at (16, 42) — both turn the same way
  // between the top-left and bottom-foot anchors, so an unguarded leftover-corner match collapses
  // the entire left vertical wall onto (16, 42).
  const ringA = [
    [16, 18],
    [16, 240],
    [40, 234],
    [40, 207],
    [140, 207],
    [140, 236],
    [164, 230],
    [164, 39],
    [181, 34],
    [150, 16],
    [136, 28],
    [16, 18]
  ]
  const ringB = [
    [20, 36],
    [16, 42],
    [51, 240],
    [58, 224],
    [154, 212],
    [160, 206],
    [166, 98],
    [180, 52],
    [140, 20],
    [44, 42],
    [20, 36]
  ]
  const aligned = alignRings([ringA, ringB])
  expect(aligned).not.toBeNull()
  const [a, b] = aligned
  // Every point along face A's lower-left wall (x < 22, y > 180) must pair with the lower half of face B,
  // never jumping up to the top-left corner at y=42.
  const lowerLeft = a.map((p, i) => [p, b[i]]).filter(([p]) => p[0] < 22 && p[1] > 180)
  expect(lowerLeft.length).toBeGreaterThan(0)
  for (const [, pb] of lowerLeft) expect(pb[1]).toBeGreaterThan(140)
  // Uniformly scaled rings still pair every leftover corner cleanly and reach their exact midpoint extent.
  const lShape = [
    [0, 0],
    [110, 0],
    [100, 12],
    [20, 12],
    [10, 100],
    [0, 110],
    [0, 0]
  ]
  const scaled = alignRings([lShape, lShape.map(([x, y]) => [1.5 * x, 1.5 * y])])
  expect(scaled).not.toBeNull()
  const [sa, sb] = scaled
  const maxX = Math.max(...sa.map((p, i) => (p[0] + sb[i][0]) / 2))
  const maxY = Math.max(...sa.map((p, i) => (p[1] + sb[i][1]) / 2))
  expect(maxX).toBeCloseTo(137.5, 1)
  expect(maxY).toBeCloseTo(137.5, 1)
})

it('leaves no stub on a stem where a slanted dot was cut from it', () => {
  // A dot lands on a stem's right wall at a slant; it is narrowest just short of its foot,
  // which runs on down the wall for a few units.
  const fused = [
    [
      [
        [40, 20],
        [52, 20],
        [52, 110],
        [78, 50],
        [92, 56],
        [56, 112],
        [56, 116],
        [52, 119],
        [52, 230],
        [40, 230],
        [40, 20]
      ]
    ]
  ]
  const apart = [
    [box(40, 20, 12, 210)],
    [
      [
        [84, 50],
        [98, 56],
        [72, 112],
        [66, 108],
        [84, 50]
      ]
    ]
  ]
  const regions = splitIslands([fused, apart])
  expect(regions).toHaveLength(2)
  const height = (/** @type {number[][]} */ ring) =>
    Math.max(...ring.map((p) => p[1])) - Math.min(...ring.map((p) => p[1]))
  const stem = regions.find((region) => height(region[1][0][0]) > 150)
  const dot = regions.find((region) => region !== stem)
  // The stem's wall runs straight past the join, and the dot still reaches down to it.
  expect(Math.max(...stem[0][0][0].map((p) => p[0]))).toBeLessThan(52.5)
  expect(Math.max(...dot[0][0][0].map((p) => p[1]))).toBeGreaterThan(108)
})

it('keeps the outline blend of a cut piece that turns more than its faces without kinking', async () => {
  // A piece cut from 陽 (Sans against Serif) and one from 答 (Sans against Fangsong), in the
  // registered square. Both turn more at the even mix than their faces do; only the second
  // folds back on itself.
  const { smooth, kinked } = await Bun.file(new URL('./fixtures/cut-pieces.json', import.meta.url)).json()
  // The verdict holds wherever a ring happens to start.
  const turned = (/** @type {number[][][][][]} */ faces) => {
    const copy = structuredClone(faces)
    for (const face of copy) {
      const ring = face[0][0]
      ring.shift()
      ring.push(ring[0])
    }
    return copy
  }
  for (const faces of [smooth, turned(smooth)]) expect(prepareCorrespondence(faces, true)).not.toBeNull()
  for (const faces of [kinked, turned(kinked)]) expect(prepareCorrespondence(faces, true)).toBeNull()
})
