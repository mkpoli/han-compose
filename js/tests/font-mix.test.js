import { expect, it } from 'bun:test'
import { activeFaces, composeMixed, FONT_STYLES } from '../src/font-mix.js'
import { mixDrawings } from '../src/mix-drawings.js'
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
  const fangsong = { d: 'M60 240Q370 230 520 186L909 148L954 157L922 193L532 224L490 870L450 909L472 234L70 262Z' }
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
    expect(changed / count(previous)).toBeLessThan(0.035)
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

it('keeps a drawing whole inside a wide band around a small or thin boundary', () => {
  const drawing = 'M90 90L130 90L130 130L90 130Z'
  const ink = (d) => count(pathMask(d, 256))
  for (const boundary of ['M100 100L108 100L108 108L100 108Z', 'M100 100L400 100L400 104L100 104Z'])
    for (const radius of [150, 300, 700]) expect(ink(limitDisplacement(drawing, boundary, radius))).toBe(ink(drawing))
  // A narrow band still clips ink that lies beyond it.
  expect(ink(limitDisplacement(drawing, 'M100 100L108 100L108 108L100 108Z', 5))).toBeLessThan(ink(drawing))
})
