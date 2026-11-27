// The components whose font cut draws a stroke wrong: each correction is named by the description
// and tied to the outlines it was read against, so these tests exercise the correction itself on
// the shapes it was written for, and the guard that leaves another export's drawing alone.
import { describe, expect, it } from 'bun:test'
import { COMPONENT_FIXES, INCOME_IDS, clippedAbove, componentFix, dotIn, incomeBoxes, respanned, withoutContours } from 'han-compose/component-fixes'
import { Composer } from 'han-compose/compose'
import { drawnContours, fill, groupRings, makePart, mapped, partOf, placed, pointsBox, union } from 'han-compose/geometry'
import zhou from './fixtures/zhou-miao.json' with { type: 'json' }
import gongRecord from './fixtures/fangsong-gong.json' with { type: 'json' }
import kuruma from './fixtures/kuruma-to.json' with { type: 'json' }
import { hexOf } from 'han-compose/sha256'

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

/** A composer whose 丶 is a rectangle glyph and whose face is the usual one. */
function dotComposer() {
  const glyph = part('glyph 丶', [265, 211, 721, 616], [265, 211, 721, 616], [[265, 211, 721, 616]])
  return { face: [38, -81, 967, 840], glyph: () => glyph.part, ink: () => 1000 }
}

describe('a stroke correction', () => {
  it('enlarges 幸 without distorting its contours until it meets 龹’s splayed legs', () => {
    const rectOps = [['M', 1], ['L', 1], ['L', 1], ['L', 1]]
    const juan = part('龹', [0, 500, 1000, 1000], [0, 500, 1000, 1000], [
      [150, 720, 850, 770], [80, 500, 220, 740], [780, 500, 920, 740],
    ])
    const xingPart = part('glyph 幸', [0, 0, 1000, 1000], [0, 0, 1000, 500], [
      [460, 0, 540, 1000], [100, 800, 900, 880],
    ])
    for (const p of [juan, xingPart]) for (const c of p.part.contours) c.ops = rectOps
    const composer = {
      fontStyle: 'serif', excluded: () => false, glyph: ch => ch === '幸' ? xingPart.part : null, ink: () => 1000,
    }
    const [upper, lower] = COMPONENT_FIXES['⿱龹幸'].apply([juan, xingPart], composer)
    // Contours stay unstretched (same part object, no stem elongation).
    expect(lower.part).toBe(xingPart.part)
    expect(lower.target[1]).toBe(0)
    expect(lower.target[3]).toBeGreaterThan(560)
    expect(lower.target[3]).toBeLessThan(720)
    expect(upper.target[3]).toBe(1000)
    // Excluded 幸 leaves both parts unchanged.
    expect(COMPONENT_FIXES['⿱龹幸'].apply([juan, xingPart], { ...composer, excluded: () => true })).toEqual([juan, xingPart])
  })

  it('cuts a contour off at a height in the box it is drawn into', () => {
    const slash = part('x', [0, 0, 100, 1000], [0, 0, 1000, 1000], [[20, 0, 80, 1000]])
    const cut = clippedAbove(slash, [0], 600)
    expect(targetBox(cut, cut.part.contours[0])[3]).toBeCloseTo(600, 6)
  })

  it('shortens a bar about its centre and moves another to a span', () => {
    const bar = part('x', [0, 0, 1000, 1000], [0, 0, 1000, 1000], [[100, 200, 900, 280], [100, 700, 900, 780]])
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

describe('FangSong ⿳吅工吅', () => {
  const gong = partOf(gongRecord)
  const composer = { fontStyle: 'fangsong', glyphRecord: () => gongRecord, glyph: () => gong }
  const ink = group => union(groupRings(group, 24).map(pointsBox))
  for (const split of [false, true]) {
    it(`fits the two bars to the stroke weight of ${split ? 'separate mouths' : 'paired mouth cuts'}`, () => {
      const row = (y, overhang = false) => (split ? [[0, 450], [550, 1000]] : [[0, 1000]]).map(([left, right]) => {
        const source = [0, 0, right - left, 330]
        const boxes = overhang ? [[0, 30, right - left, 330], [0, 0, 40, 330]] : [source]
        const mouth = part('mouth', source, [left, y, right, y + 330], boxes)
        Object.assign(mouth.part.contours[0], {
          ops: [['M', 1], ['L', 1], ['L', 1], ['L', 1]], width: [50, split ? 30 : 50],
        })
        if (mouth.part.contours[1]) mouth.part.contours[1].ops = [['M', 1], ['L', 1], ['L', 1], ['L', 1]]
        return mouth
      })
      const upper = row(670, true), lower = row(0)
      const input = [...upper, placed(gong, gong.box, [0, 410, 1000, 590], 0, 'glyph 工'), ...lower]
      const result = componentFix('⿳吅工吅', input, composer)
      const bar = result[upper.length], mask = fill(groupRings([bar], 24), 1000, [0, 0, 1000, 1000])
      // Sample each stroke through its body, away from the terminals and centre stem.
      const edges = x => Array.from({ length: 999 }, (_, i) => i + 1)
        .filter(y => mask[y * 1000 + x] !== mask[(y - 1) * 1000 + x])
      const left = edges(300), right = edges(700)
      expect(left).toHaveLength(4)
      expect(right).toHaveLength(4)
      for (const i of [0, 2]) {
        const thickness = left[i + 1] - left[i]
        const rise = ((left[i] + left[i + 1]) - (right[i] + right[i + 1])) / 800
        expect(rise).toBeGreaterThan(0.025)
        expect(rise).toBeLessThan(0.077)
        expect(thickness).toBeGreaterThan(split ? 22 : 38)
        expect(thickness).toBeLessThan(split ? 34 : 56)
      }
      expect(ink([bar])[3]).toBeLessThan(ink(result.slice(0, upper.length))[1])
      expect(ink([bar])[1]).toBeGreaterThan(ink(result.slice(upper.length + 1))[3])
      // The facing vertical channels above and below 工 stay optically balanced.
      const gap = (a, b) => {
        const ma = fill(groupRings(a, 24), 200, ink(result)), mb = fill(groupRings(b, 24), 200, ink(result)), gs = []
        for (let col = 0; col < 200; col++) {
          let la = -1, fb = -1
          for (let row = 0; row < 200; row++) {
            const k = row * 200 + col
            if (ma[k]) la = row
            if (mb[k] && fb < 0) fb = row
          }
          if (la >= 0 && fb >= 0) gs.push(fb - la)
        }
        gs.sort((x, y) => x - y)
        return gs[gs.length >> 1]
      }
      expect(Math.abs(gap(result.slice(0, upper.length), [bar]) - gap([bar], result.slice(upper.length + 1)))).toBeLessThanOrEqual(2)
      ink(result).forEach((edge, i) => expect(edge).toBeCloseTo(ink(input)[i], 5))
      expect(componentFix('⿳吅工吅', result, composer)).toEqual(result)
      expect(bar.part.strokes).toEqual(gong.strokes)
    })
  }
})

describe('⿱呼乙', () => {
  const left = part('host 呼', [0, 200, 320, 800], [0, 400, 460, 1000], [[0, 200, 320, 800]])
  const right = part('host 呼', [300, 0, 1000, 1000], [500, 400, 1000, 1000], [[300, 0, 1000, 1000]])
  const bottom = part('learned 乴', [0, 0, 800, 420], [100, 0, 900, 420], [[0, 0, 800, 420]])
  const mouth = part('glyph 口', [0, 0, 100, 100], [0, 0, 100, 100], [[0, 0, 100, 100]])
  const composer = { glyph: ch => ch === '口' ? mouth.part : null, ink: () => 1000, excluded: () => false }

  it('recovers 呼’s width shares and leaves a gap beside 口 and above 乙', () => {
    const fixed = componentFix('⿱呼乙', [left, right, bottom], composer)
    expect(fixed[0].origin).toBe('glyph 口')
    expect(fixed[0].target).toEqual([0, 600, 260, 860])
    expect(fixed[1].target).toEqual([300, 460, 1000, 1000])
    expect(fixed[1].part).toBe(right.part)
    expect(fixed[2]).toBe(bottom)
  })

  it('fits the three Serif parts into the selected bands above the wide base', () => {
    const serif = { ...composer, fontStyle: 'serif', glyphRecord: () => null }
    const [lip, hu, yi] = componentFix('⿱呼乙', [left, right, bottom], serif)
    expect(lip.target).toEqual([168, 580, 388, 910])
    expect(hu.target).toEqual([412, 410, 852, 1000])
    expect(yi.target).toEqual([172, 0, 852, 370])
  })

  it('preserves the host cuts when standalone 口 is excluded', () => {
    const layout = [left, right, bottom]
    expect(componentFix('⿱呼乙', layout, { ...composer, excluded: ch => ch === '口' })).toBe(layout)
  })

  it('leaves the weight pass in control of other mouth outlines', () => {
    for (const fontStyle of ['sans', 'serif', 'fangsong', 'pen-writing']) {
      const other = { ...composer, fontStyle, glyphRecord: () => ({ p: [] }) }
      const [lip] = componentFix('⿱呼乙', [left, right, bottom], other)
      expect(lip.fixed).toBeUndefined()
      expect(lip.weight).toEqual([0, 0])
    }
  })

  it('raises the foot of whole 呼 clear of 乙 in Regular Kai', () => {
    const hu = { ...left, origin: 'glyph 呼' }
    const [raised, yi] = componentFix('⿱呼乙', [hu, bottom], { fontStyle: 'regular', glyphRecord: () => null })
    expect(raised.target).toEqual([0, 470, 460, 1000])
    expect(yi).toBe(bottom)
  })

  it('narrows WenKai’s 乎 around the row centre and carries 口 with it', () => {
    const [lip, hu] = componentFix('⿱呼乙', [left, right, bottom], {
      ...composer, fontStyle: 'pen-writing', glyphRecord: () => null,
    })
    expect(hu.target[2] - hu.target[0]).toBeCloseTo(540 * 0.7 * 1.25)
    expect(hu.target[0] - lip.target[2]).toBeCloseTo(40)
    expect(lip.target[0] + hu.target[2]).toBeCloseTo(1000)
  })

  it('keeps whole-glyph and unrelated layouts intact', () => {
    for (const layout of [[mouth, bottom], [mouth, right, bottom], [left, mouth, bottom]]) {
      expect(componentFix('⿱呼乙', layout, composer)).toBe(layout)
    }
  })
})

it('uses 舳’s unemboldened 舟 beside 苗 and fits it at its final nested size', () => {
  const source = partOf(zhou)
  const boat = placed(source, source.box, [20, 70, 410, 850], 0, 'learned 艃', [0, 0.575])
  const sprout = part('glyph 苗 kept', [0, 0, 500, 700], [440, 80, 900, 810], [[0, 0, 480, 670]])
  const pair = [boat, sprout], face = {
    fontStyle: 'regular', staticFace: true, excluded: () => false, glyphRecord: ch => ch === '舳' ? zhou : null,
  }
  const [tagged, right] = componentFix('⿰舟苗', pair, face)
  expect(right).toBe(sprout)
  const nested = { ...tagged, target: [25, 70, 220, 430], flips: [{ x: true, about: [240, 0] }] }
  const corrected = { ...nested, ...tagged.finishOutline(nested) }
  expect(corrected.part.contours).toEqual(zhou.ls.舟.map(i => source.contours[i]))
  expect(corrected.weight).toEqual([0, 0])
  const ink = p => union(groupRings([p], 24).map(pointsBox))
  ink(nested).forEach((edge, i) => expect(ink(corrected)[i]).toBeCloseTo(edge, 6))
  expect(tagged.finishOutline({ ...nested, cut: true })).toEqual({})
  for (const override of [{ fontStyle: 'serif' }, { staticFace: false }, { partial: true },
    { excluded: ch => ch === '舳' }, { glyphRecord: () => null }, { glyphRecord: () => ({ ...zhou, p: [] }) }]) {
    expect(componentFix('⿰舟苗', pair, { ...face, ...override })).toBe(pair)
  }
  const otherHost = [{ ...boat, origin: 'learned 艘' }, sprout]
  expect(componentFix('⿰舟苗', otherHost, face)).toBe(otherHost)
})

it('fits the native left 車 from 軋 and native 卜 into the final Regular ink bounds of ⿰車ト', () => {
  const car = part('learned 䡎', [0, 0, 160, 300], [40, 60, 200, 360], [[10, 20, 150, 280]])
  car.part.contours[0].ops = [['M', 1], ['L', 1], ['L', 1], ['L', 1]]
  const glyph = partOf(kuruma.ト)
  const kana = placed(glyph, glyph.box, [230, 60, 330, 360], 0, 'glyph ト')
  const pair = [car, kana], face = {
    fontStyle: 'regular', staticFace: true, excluded: () => false, glyphRecord: ch => kuruma[ch],
  }
  const fixed = componentFix('⿰車ト', pair, face)
  const box = p => union(groupRings([p], 24).map(pointsBox))
  const [left, right] = fixed.map((p, i) => {
    const nested = { ...p, target: [10 + 120 * i, 20, 90 + 120 * i, 170], flips: [{ x: true, about: [100, 0] }] }
    const result = { ...nested, ...p.finishOutline(nested) }
    for (const [axis, edge] of box(nested).entries()) expect(box(result)[axis]).toBeCloseTo(edge)
    expect(p.finishOutline({ ...nested, fixed: true })).toEqual({})
    return result
  })
  expect(left.origin).toBe('車 from 軋')
  expect(left.part.contours).toEqual(partOf(kuruma.軋).contours.slice(0, 5))
  expect(right.part).toBe(partOf(kuruma.卜))
  expect(right.origin).toBe('glyph 卜')
  for (const override of [{ excluded: ch => ch === '卜' }, { glyphRecord: ch => ch === '卜' ? null : kuruma[ch] },
    { glyphRecord: ch => ch === '卜' ? { ...kuruma.卜, v: 0 } : kuruma[ch] }]) {
    const fallback = componentFix('⿰車ト', pair, { ...face, ...override })
    expect(fallback[0].finishOutline(fallback[0]).origin).toBe('車 from 軋')
    expect(fallback[1].finishOutline(fallback[1]).part).toBe(glyph)
    expect(fallback[1].finishOutline(fallback[1]).weight).toEqual([-0.8, -0.6])
  }
  for (const override of [{ partial: true }, { fontStyle: 'pen-writing' }, { excluded: ch => ch === '軋' },
    { glyphRecord: ch => ch === '軋' ? null : kuruma[ch] }]) {
    expect(componentFix('⿰車ト', pair, { ...face, ...override })).toBe(pair)
  }
})

describe('⿱一心', () => {
  it('lowers Regular Kai’s 一 within its band at its own bar height', () => {
    const top = part('host 亍', [0, 0, 1000, 1000], [100, 544, 900, 880], [[100, 544, 900, 880]])
    const bottom = part('host 芯', [0, 0, 1000, 1000], [100, 0, 900, 510], [[100, 0, 900, 510]])
    const bar = part('glyph 一', [0, 0, 1000, 1000], [100, 0, 900, 100], [[100, 0, 900, 100]])
    bar.part.box = [100, 0, 900, 100]
    const composer = { fontStyle: 'regular', glyph: () => bar.part }
    const [fixed] = componentFix('⿱一心', [top, bottom], composer)
    expect(fixed.target[3] - fixed.target[1]).toBeCloseTo(100, 6)
    expect(fixed.target[3]).toBeCloseTo(880 - 0.65 * 236, 6)
    expect(fixed.fixed).toBe(true)
  })

  it('fits the Fangsong 心 below 一 while keeping its baseline and width', () => {
    const top = part('learned 亘', [0, 0, 800, 150], [100, 600, 900, 750], [[0, 0, 800, 150]])
    const heart = part('learned 芯', [0, 0, 800, 550], [80, 0, 920, 640], [[0, 0, 800, 550]])
    const fixed = componentFix('⿱一心', [top, heart], { fontStyle: 'fangsong' })
    expect(fixed[0]).toBe(top)
    expect(fixed[1].target).toEqual([80, 0, 920, 540])
    expect(fixed[1].part).toBe(heart.part)
  })
})

it('fits FangSong 魚 and 遂 to the space between their outer ink edges', () => {
  const fish = part('learned 鯝', [0, 0, 400, 900], [0, 50, 400, 950], [[40, 80, 360, 720]])
  const follow = part('learned 𬭼', [0, 0, 500, 800], [450, 100, 950, 900], [[35, 10, 500, 700]])
  const pair = [fish, follow]
  const corrected = componentFix('⿰魚遂', pair, { fontStyle: 'fangsong' })
  const [left, right] = corrected.map(p => targetBox(p, p.part.contours[0]))
  expect(left[0]).toBeCloseTo(40)
  expect(right[2]).toBeCloseTo(950)
  expect(left[2]).toBeCloseTo(right[0])
  expect([left[1], left[3], right[1], right[3]]).toEqual([130, 770, 110, 800])
  expect(corrected[0].part).toBe(fish.part)
  expect(corrected[1].part).toBe(follow.part)
  expect(componentFix('⿰魚遂', pair, { fontStyle: 'serif' })).toBe(pair)
  const otherCut = [fish, { ...follow, origin: 'glyph 遂' }]
  expect(componentFix('⿰魚遂', otherCut, { fontStyle: 'fangsong' })).toBe(otherCut)
})

it('balances Regular 身 and 化 at their placed scale and preserves their ink bounds', () => {
  const body = part('learned 躭', [0, 0, 400, 800], [0, 0, 400, 800], [[10, 20, 390, 780]])
  const flower = part('glyph 花 kept', [0, 0, 800, 800], [420, 0, 820, 800], [[30, 10, 780, 620]])
  const grass = part('TW-Kai: 艹', [0, 0, 400, 80], [420, 700, 820, 780], [[0, 0, 400, 80]])
  for (const p of [body, flower]) {
    const c = p.part.contours[0], [l, b, r, t] = pointsBox(c.light)
    c.ops = [['M', 1], ['L', 1], ['L', 1], ['L', 1]]
    c.heavy = Float64Array.from([l - 20, b - 20, r + 20, b - 20, r + 20, t + 20, l - 20, t + 20])
    c.width = [50, 40]
  }
  const parts = [body, flower, grass], stroke = [50, 40]
  const face = {
    fontStyle: 'regular', stem0: [[50, 90], [40, 80]], staticFace: true, stroke,
    staticBalance(group) {
      group[0].weight = [0, 0.5]
      this.stroke = [45, 36]
    },
  }
  const fixed = componentFix('⿰身花', parts, face)
  expect(50 + fixed[0].weight[0] * 40).toBeCloseTo(Math.sqrt(50 * 25))
  expect((50 + fixed[1].weight[0] * 40) / 2).toBeCloseTo(Math.sqrt(50 * 25))
  for (const i of [0, 1]) {
    const original = i === 0 ? { ...body, weight: [0, 0.5] } : flower
    const a = pointsBox(drawnContours(original)[0]), b = pointsBox(drawnContours(fixed[i])[0])
    for (const [edge, value] of a.entries()) expect(b[edge]).toBeCloseTo(value)
    expect(fixed[i].fixed).toBe(true)
  }
  expect(fixed[2]).toBe(grass)
  expect(body.weight).toEqual([0, 0])
  expect(face.stroke).toBe(stroke)
  expect(componentFix('⿰身花', parts, face)).toEqual(fixed)
  expect(componentFix('⿰身花', parts, { ...face, fontStyle: 'serif' })).toBe(parts)
  expect(componentFix('⿰身花', parts, { ...face, stem0: [[50, 50], [40, 40]] })).toBe(parts)
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

describe('⿵𦉪十', () => {
  const contourBox = c => {
    const xs = [], ys = []
    for (let i = 0; i < c.light.length; i += 2) { xs.push(c.light[i]); ys.push(c.light[i + 1]) }
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  }
  const drawnBoxOf = (p, k = 0) => {
    const pts = drawnContours(p)[k], xs = [], ys = []
    for (let i = 0; i < pts.length; i += 2) { xs.push(pts[i]); ys.push(pts[i + 1]) }
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  }
  const polygon = (points, heavy = points) => ({
    ops: points.map((_, i) => ({ code: i ? 'L' : 'M' })),
    light: Float64Array.from(points.flat()),
    heavy: Float64Array.from(heavy.flat()),
    width: null,
  })
  const withHeavy = (p, box) => {
    p.part.contours.forEach((c, i) => {
      const heavy = box(i, c)
      if (heavy) c.heavy = Float64Array.from(heavy.length === 4 ? [heavy[0], heavy[1], heavy[2], heavy[1], heavy[2], heavy[3], heavy[0], heavy[3]] : heavy.flat())
    })
    return p
  }
  // 9-contour Sans-like 鬲 ([3,4,5,8] form 𦉪) and 2-contour 十 ([bar, stem]), with heavy masters.
  // Contour 8 shapes 丿’s curved tail on the left ([183,146]) so clearance over 十’s bar is tested accurately.
  const sansGe = () => {
    const base = part('glyph 鬲', [75, -82, 927, 787], [75, -82, 927, 787], [
      [75, 720, 927, 787], [293, 84, 719, 139], [466, -71, 535, 116],
      [109, -81, 864, 386], [677, -82, 900, 386], [545, 178, 817, 346],
      [282, 505, 728, 602], [211, 450, 803, 658], [183, 146, 438, 352],
    ])
    base.part.contours[8] = polygon(
      [[371, 352], [438, 352], [433, 220], [235, 146], [183, 146], [337, 240]],
      [[350, 342], [472, 342], [450, 210], [250, 116], [210, 116], [320, 230]])
    return withHeavy(base, (i, c) => i === 5 ? [514, 150, 810, 329] : i === 8 ? null : contourBox(c))
  }
  const sansTen = () => withHeavy(part('glyph 十', [55, -80, 952, 839], [55, -80, 952, 839],
    [[55, 389, 952, 466], [461, -80, 542, 839]]),
    i => i === 0 ? [45, 350, 964, 502] : [422, -95, 582, 855])
  // 10-contour Serif-like 鬲 ([3,4,8,9] form 𦉪) and 2-contour 十 ([stem, bar]).
  const serifGe = () => part('glyph 鬲', [79, -81, 936, 829], [79, -81, 936, 829], [
    [285, 138, 738, 213], [466, -65, 530, 168], [79, 740, 936, 829],
    [672, -82, 918, 432], [125, -79, 846, 424], [242, 429, 718, 692],
    [677, 438, 797, 701], [279, 484, 717, 512], [539, 228, 783, 391], [205, 176, 446, 388],
  ]).part
  const serifTen = () => part('glyph 十', [44, -76, 958, 834], [44, -76, 958, 834],
    [[464, -76, 571, 834], [44, 443, 959, 541]]).part

  const fix = COMPONENT_FIXES['⿵𦉪十']
  const composerOf = (ge, ten, ink = ch => ch === '鬲' ? 7000 : 3700) => ({
    glyph: ch => ch === '鬲' ? ge : ch === '十' ? ten : null,
    ink,
  })

  it('sets 十’s bar clear below the inner strokes of 鬲’s 𦉪 frame', () => {
    const ge = sansGe().part, ten = sansTen().part
    const frame = part('glyph 𦉪', [95, 157, 906, 611], [72, -20, 931, 746], [[95, 157, 906, 611]])
    const out = fix.apply([frame], composerOf(ge, ten))
    expect(out).toHaveLength(3)
    const [shell, bar, stem] = out
    expect(shell.origin).toBe('body 鬲')
    shell.target.forEach((v, i) => expect(v).toBeCloseTo(frame.target[i], 6))
    expect(shell.part.contours).toEqual([3, 4, 5, 8].map(i => ge.contours[i]))
    expect([bar.origin, stem.origin]).toEqual(['glyph 十', 'glyph 十'])
    expect(bar.part.contours).toEqual([ten.contours[0]])
    expect(stem.part.contours).toEqual([ten.contours[1]])
    expect([bar.fixed, stem.fixed]).toEqual([true, true])
    // The bar stands where 鬲 draws its 丅 bar; the stem starts in the same place and runs up
    // between 丿 and 乚.
    const frameBox = [109, -82, 900, 386]
    const barBox = drawnBoxOf(bar), stemBox = drawnBoxOf(stem)
    const wantBar = mapped([286, 34, 720, 90], frameBox, frame.target)
    wantBar.forEach((v, i) => expect(barBox[i]).toBeCloseTo(v, 6))
    const slash = drawnBoxOf(shell, 3), hook = drawnBoxOf(shell, 2)
    // The bar stands below both inner strokes, clear of their feet.
    expect(barBox[3]).toBeLessThan(slash[1])
    expect(barBox[3]).toBeLessThan(hook[1])
    expect(stemBox[0]).toBeGreaterThan(slash[2])
    expect(stemBox[2]).toBeLessThan(hook[0])
    expect(stemBox[1]).toBeCloseTo(mapped([466, -71, 535, 116], frameBox, frame.target)[1], 6)
    expect(stemBox[3]).toBeGreaterThan(barBox[3])
    expect(stemBox[3]).toBeLessThan(Math.max(...[3, 4, 5, 8].map(i => mapped(box(ge.contours[i]), frameBox, frame.target)[3])))
  })

  it('supports Serif’s 10-contour 鬲 and swapped 十 stroke order', () => {
    const ge = serifGe(), ten = serifTen()
    const frame = part('glyph 𦉪', [106, 168, 936, 603], [76, 15, 926, 729], [[106, 168, 936, 603]])
    const [shell, bar, stem] = fix.apply([frame], composerOf(ge, ten))
    shell.target.forEach((v, i) => expect(v).toBeCloseTo(frame.target[i], 6))
    expect(shell.part.contours).toEqual([3, 4, 8, 9].map(i => ge.contours[i]))
    expect(bar.part.contours).toEqual([ten.contours[1]])
    expect(stem.part.contours).toEqual([ten.contours[0]])
    const slash = drawnBoxOf(shell, 3), hook = drawnBoxOf(shell, 2)
    const stemBox = drawnBoxOf(stem)
    expect(stemBox[0]).toBeGreaterThan(slash[2])
    expect(stemBox[2]).toBeLessThan(hook[0])
    expect(stemBox[3]).toBeLessThan(Math.max(...[3, 4, 8, 9].map(i => mapped(box(ge.contours[i]), [125, -82, 918, 432], frame.target)[3])))
  })

  it('keeps the frame’s scale in a narrow cell and never rebalances the strokes', () => {
    const ge = sansGe().part, ten = sansTen().part
    const root = part('glyph 𦉪', [95, 157, 906, 611], [72, -20, 931, 746], [[95, 157, 906, 611]])
    const narrow = part('glyph 𦉪', [95, 157, 906, 611], [430, -80, 530, 100], [[95, 157, 906, 611]])
    const [rootShell, rootBar] = fix.apply([root], composerOf(ge, ten))
    const parts = fix.apply([narrow], composerOf(ge, ten))
    const [shell, bar] = parts
    const ratio = (barBox, shellBox) => (barBox[3] - barBox[1]) / (shellBox[3] - shellBox[1])
    expect(ratio(drawnBoxOf(bar), shell.target)).toBeCloseTo(ratio(drawnBoxOf(rootBar), rootShell.target), 6)
    const before = parts.map(p => p.target.slice())
    Composer.prototype.balance.call({ C: { STEM_CURVE: [[85.34, -1.324], [86.93, -1.914]] }, stem0: [[80.702, 160], [82.142, 159]] }, parts)
    parts.forEach((p, i) => expect(p.target).toEqual(before[i]))
  })

  it('lists both faces’ 鬲 and 十 digests and leaves missing, unsupported, or unmatched glyphs alone', () => {
    expect(fix.glyphs['鬲']).toHaveLength(3)
    expect(fix.glyphs['十']).toHaveLength(3)
    const frame = part('glyph 𦉪', [0, 0, 800, 800], [100, 0, 900, 800], [[0, 0, 800, 800]])
    expect(fix.apply([frame], composerOf(null, sansTen().part))).toEqual([frame])
    expect(fix.apply([frame], composerOf(sansGe().part, null))).toEqual([frame])
    const kaishoGe = part('glyph 鬲', [0, 0, 800, 800], [0, 0, 800, 800], Array.from({ length: 5 }, () => [0, 0, 800, 450])).part
    expect(fix.apply([frame], composerOf(kaishoGe, sansTen().part))).toEqual([frame])
    const oneStrokeTen = part('glyph 十', [0, 0, 800, 800], [0, 0, 800, 800], [[0, 0, 800, 800]]).part
    expect(fix.apply([frame], composerOf(sansGe().part, oneStrokeTen))).toEqual([frame])
    // A 9-contour 鬲 paired with Serif-ordered 十 strokes passes both digests, but its first
    // contour is the tall stem, so the pairing guard leaves the drawing alone.
    const swapped = withHeavy(part('glyph 十', [55, -80, 952, 839], [55, -80, 952, 839],
      [[461, -80, 542, 839], [55, 389, 952, 466]]), () => null)
    expect(fix.apply([frame], composerOf(sansGe().part, swapped.part))).toEqual([frame])
    const other = [[0, 0]]
    expect(fix.glyphs['十']).not.toContain(hexOf(JSON.stringify(other)))
    const parts = [frame]
    expect(componentFix('⿵𦉪十', parts, { glyphRecord: ch => ch === '十' ? { p: other } : null })).toBe(parts)
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

describe('C080 ⿻一止', () => {
  // 止's strokes in font units, in the order each face numbers them; the 一 from 吏. The right bar
  // starts inside the stem, as Serif's does.
  const STROKES = { right: [520, 407, 921, 487], base: [38, -82, 967, -3], stem: [502, -43, 583, 840], left: [182, -40, 261, 609] }
  const ORDERS = { serif: ['right', 'base', 'stem', 'left'], sans: ['stem', 'left', 'right', 'base'] }
  // Drawn at half size and offset, so a mix-up of source and target units shows.
  const target = [100, 200, 564.5, 661]
  const stop = order => part('glyph 止', [38, -82, 967, 840], target, order.map(name => STROKES[name]))
  const line = () => part('overlay 吏', [65, 674, 931, 743], [130, 500, 563, 534.5], [[65, 674, 931, 743]])
  const fix = COMPONENT_FIXES['⿻一止']
  const fromTop = y => (target[3] - y) / (target[3] - target[1])
  for (const [face, order] of Object.entries(ORDERS)) {
    it(`crosses a third of the way down, with 止’s right bar and left stroke set as 正 sets them (${face} order)`, () => {
      const [bar, body] = fix.apply([line(), stop(order)])
      const at = Object.fromEntries(order.map((name, index) => [name, targetBox(body, body.part.contours[index])]))
      expect(fromTop((bar.target[1] + bar.target[3]) / 2)).toBeCloseTo(0.33, 2)
      const intoGap = y => (bar.target[1] - y) / (bar.target[1] - at.base[3])
      expect(intoGap((at.right[1] + at.right[3]) / 2)).toBeCloseTo(0.46, 2)
      expect(intoGap(at.left[3])).toBeCloseTo(0.285, 2)
      expect(bar.target[3] - bar.target[1]).toBeCloseTo(34.5, 6)
      expect(at.stem[3]).toBeCloseTo(target[3], 6)
      expect(at.base[1]).toBeCloseTo(target[1], 6)
    })
  }
  it('moves the same strokes where the face joins 止 into one outline, keeping the left stroke’s head', () => {
    // Noto Sans CJK's 止 as one outline, with a head on the left stroke from 640 down to 600.
    const outline = [188, 600, 188, 44, 49, 44, 49, -30, 949, -30, 949, 44, 577, 44, 577, 430, 905, 430, 905, 505,
      577, 505, 577, 837, 499, 837, 499, 44, 265, 44, 265, 619, 210, 640]
    const light = Float64Array.from(outline), heavy = light.map((v, i) => i % 2 ? v - 6 : v + 4)
    const contour = { ops: outline.filter((_, i) => i % 2 === 0).map((_, i) => ({ code: i ? 'L' : 'M' })), light, heavy, width: null }
    const source = [49, -30, 949, 837], joined = placed(makePart([contour], source), source, target, 0, 'glyph 止')
    const [bar, body] = fix.apply([line(), joined])
    const sy = (target[3] - target[1]) / (source[3] - source[1])
    const at = index => target[1] + (body.part.contours[0].light[index * 2 + 1] - source[1]) * sy
    const intoGap = y => (bar.target[1] - y) / (bar.target[1] - at(5))
    expect(fromTop((bar.target[1] + bar.target[3]) / 2)).toBeCloseTo(0.33, 2)
    expect(intoGap((at(8) + at(9)) / 2)).toBeCloseTo(0.46, 2)
    expect(intoGap(at(16))).toBeCloseTo(0.285, 2)
    expect(at(16) - at(0)).toBeCloseTo(40 * sy, 6)
    expect(at(12)).toBeCloseTo(target[3], 6)
    expect(at(1)).toBeCloseTo(target[1] + 74 * sy, 6)
    // The bar's joins slide down the stem's edge with it.
    expect(at(7)).toBeCloseTo(at(8), 6)
    expect(at(10)).toBeCloseTo(at(9), 6)
    // The heavy master moves with the light one.
    const moved = body.part.contours[0]
    for (const index of [8, 16, 1]) expect(moved.heavy[index * 2 + 1] - moved.light[index * 2 + 1]).toBeCloseTo(-6, 6)
  })
  it('leaves an outline it cannot read alone', () => {
    const three = part('glyph 止', [38, -82, 967, 840], target, [STROKES.stem, STROKES.left, STROKES.base])
    const parts = [line(), three]
    expect(fix.apply(parts)).toBe(parts)
  })
  it('lists the four faces’ 止 and leaves any other outline alone', () => {
    expect(fix.glyphs['止']).toHaveLength(4)
    const other = [[0, 0]]
    expect(fix.glyphs['止']).not.toContain(hexOf(JSON.stringify(other)))
    const parts = [line(), stop(ORDERS.serif)]
    expect(componentFix('⿻一止', parts, { glyphRecord: ch => ch === '止' ? { p: other } : null, face: [38, -81, 967, 840] })).toBe(parts)
  })
})

describe('C073 ⿸⿹丅丿丨', () => {
  const polygon = points => {
    const light = Float64Array.from(points.flat())
    return { ops: points.map((_, i) => ({ code: i ? 'L' : 'M' })), light, heavy: light.slice(), width: null }
  }
  // 丅 with an 80-wide stem under its bar's middle, 160 wide in the heavy master.
  const tee = () => {
    const p = part('glyph 丅', [52, -80, 949, 748], [100, -80, 500, 840], [[52, 672, 949, 748], [456, -80, 536, 706]])
    p.part.contours[1].heavy = Float64Array.from([416, -80, 576, -80, 576, 706, 416, 706])
    return p
  }
  // 丿 as the faces draw it: an upright 80-wide head on the right, a tail sweeping to the lower left.
  const slashBox = [220, -71, 588, 815]
  const slash = () => placed(makePart([polygon([[508, 815], [588, 815], [588, 300], [260, -71], [220, -40], [508, 330]])], slashBox), slashBox, [600, 0, 900, 700], 0, 'glyph 丿')
  const stroke = () => part('learned 介', [500, 0, 560, 300], [550, 300, 600, 500], [[500, 0, 560, 300]])
  const line = part('glyph 丨', [459, -80, 539, 839], [459, -80, 539, 839], [[459, -80, 539, 839]]).part
  const composer = { face: [38, -81, 967, 840], glyph: ch => ch === '丨' ? line : null, ink: () => 1000, weighted: false }
  const fix = COMPONENT_FIXES['⿸⿹丅丿丨']
  /** The 丿's head as drawn: the ink above its turn, [left, right] in target units. */
  const headOf = p => {
    const xs = [], light = p.part.contours[0].light, scale = (p.target[2] - p.target[0]) / (p.source[2] - p.source[0])
    for (let i = 0; i < light.length; i += 2) if (light[i + 1] > 400) xs.push(p.target[0] + (light[i] - p.source[0]) * scale)
    return [Math.min(...xs), Math.max(...xs)]
  }
  /** The stem's middle and the strokes' width in a cell `width` wide starting at `x`. */
  const stemIn = (x, width, weighted) => {
    const sx = (0.94 * width) / (949 - 52)
    return { sx, middle: x + 0.06 * width + (496 - 52) * sx, thick: weighted ? Math.min(80, 160 * sx) : 80 * sx }
  }

  it('hangs the 丿 and the 丨 either side of the stem at its width, in a static face', () => {
    // A cell offset from the origin and narrower than the face, as the left of 𡉹 is drawn.
    const region = [100, -80, 500, 840], height = 920, { middle, thick } = stemIn(100, 400, false)
    const [bar, left, right] = fix.apply([tee(), slash(), stroke()], composer, region)
    expect(bar.target).toEqual([124, -80, 500, 840])
    expect(right.origin).toBe('glyph 丨')
    // The three strokes are one width.
    const head = headOf(left)
    expect(head[1] - head[0]).toBeCloseTo(thick, 6)
    expect(right.target[2] - right.target[0]).toBeCloseTo(thick, 6)
    // The white either side of the stem is shared out in the rule's proportions.
    expect(middle - thick / 2 - head[1]).toBeCloseTo(0.38 * (middle - 100 - 1.5 * thick), 6)
    expect(right.target[0] - (middle + thick / 2)).toBeCloseTo(0.53 * (500 - middle - 1.5 * thick), 6)
    // The tail is drawn in to the cell's left edge; the head keeps its shape.
    expect(left.target[0]).toBeCloseTo(100, 6)
    expect(left.source[2] - left.source[0]).toBeLessThan(588 - 220)
    expect(Array.from(left.part.contours[0].light.slice(0, 6))).toEqual([508, 815, 588, 815, 588, 300])
    expect(left.target[1]).toBeCloseTo(-80 + 0.07 * height, 6)
    expect(right.target[1]).toBeCloseTo(-80 + 0.11 * height, 6)
    for (const p of [left, right]) expect(p.target[3]).toBeCloseTo(840 - 0.24 * height, 6)
  })
  /** The parts as the sans face's balance leaves them, weighted for a drawing of `density`. */
  const balanced = parts => {
    Composer.prototype.balance.call({ C: { STEM_CURVE: [[85.34, -1.324], [86.93, -1.914]] }, stem0: [[80.702, 160], [82.142, 159]] }, parts)
    return parts
  }
  /** A part's ink at half its height as drawn: [left, right]. */
  const inkOf = (p, k = 0) => {
    const points = drawnContours(p)[k], y = (p.target[1] + p.target[3]) / 2, xs = []
    for (let i = 0; i < points.length; i += 2) {
      const j = (i + 2) % points.length, y1 = points[i + 1], y2 = points[j + 1]
      if (y1 !== y2 && (y1 - y) * (y2 - y) <= 0) xs.push(points[i] + (points[j] - points[i]) * (y - y1) / (y2 - y1))
    }
    return [Math.min(...xs), Math.max(...xs)]
  }
  /** 丅, 丿 and 丨 as a weighted face holds them: ink for the balance to read, and heavy masters. */
  const weightedParts = () => {
    const bar = { ...tee(), native: 3678 }, left = { ...slash(), native: 2123 }
    left.part.contours[0].heavy = Float64Array.from([468, 815, 628, 815, 628, 300, 280, -71, 200, -40, 468, 330])
    const heavyLine = part('glyph 丨', [459, -80, 539, 839], [459, -80, 539, 839], [[459, -80, 539, 839]]).part
    heavyLine.contours[0].heavy = Float64Array.from([419, -80, 579, -80, 579, 839, 419, 839])
    return { parts: [bar, left, stroke()], composer: { ...composer, weighted: true, glyph: ch => ch === '丨' ? heavyLine : null } }
  }

  it('places the strokes for the stem’s own width in a weighted face, a stroke’s 0.8 clear of the stem', () => {
    const { sx, middle, thick } = stemIn(100, 500, true), { parts, composer: weighted } = weightedParts()
    const [, left, right] = fix.apply(parts, weighted, [100, -80, 600, 840])
    expect(thick).toBe(80)
    // 53% of the white would leave less than 0.8 of a stroke.
    expect(0.53 * (600 - middle - 1.5 * thick)).toBeLessThan(0.8 * thick)
    expect((right.target[0] + right.target[2]) / 2 - thick / 2 - (middle + thick / 2)).toBeCloseTo(0.8 * thick, 6)
    // Both are drawn at 丅's scale for the balance to weight, the 丿's head a stroke and the gap left of the stem's middle.
    const head = headOf(left)
    expect(head[1] - head[0]).toBeCloseTo(80 * sx, 6)
    expect(right.target[2] - right.target[0]).toBeCloseTo(80 * sx, 6)
    expect(middle - thick - (head[0] + head[1]) / 2).toBeCloseTo(0.38 * (middle - 100 - 1.5 * thick), 6)
  })
  it('ends the three strokes at one width once the balance has weighted them', () => {
    // A cell wide enough for the stem's own width, and two where the heavy master stops it short.
    for (const width of [500, 300, 220]) {
      const { thick } = stemIn(100, width, true), { parts, composer: weighted } = weightedParts()
      const [bar, left, right] = balanced(fix.apply(parts, weighted, [100, -80, 100 + width, 840]))
      const stem = inkOf(bar, 1), line = inkOf(right), stemWidth = stem[1] - stem[0]
      if (width < 400) expect(stemWidth).toBeCloseTo(thick, 6)
      expect(line[1] - line[0]).toBeCloseTo(stemWidth, 6)
      const head = headOf({ ...left, part: { contours: [{ light: drawnContours(left)[0] }] }, source: left.target })
      expect(head[1] - head[0]).toBeCloseTo(stemWidth, 0)
      // The 丨 stands clear of the stem and inside the cell.
      expect(line[0]).toBeGreaterThan(stem[1])
      expect(line[1]).toBeLessThan(100 + width)
    }
  })
  it('keeps the 丿 inside a cell too narrow for its tail', () => {
    const { parts, composer: weighted } = weightedParts()
    const [, left] = fix.apply(parts, weighted, [100, -80, 200, 840])
    expect(left.target[0]).toBeGreaterThanOrEqual(100)
    expect(left.target[2]).toBeGreaterThan(left.target[0])
  })
  it('leaves a drawing without the three parts, or without one stroke to read, alone', () => {
    const region = [100, -80, 500, 840]
    for (const parts of [[tee(), stroke()], [tee(), slash(), stroke(), stroke()]]) expect(fix.apply(parts, composer, region)).toBe(parts)
    const parts = [tee(), slash(), stroke()]
    expect(fix.apply(parts, { ...composer, glyph: () => null }, region)).toBe(parts)
    // A 丅 with two stems has no one stem to measure.
    const forked = [part('glyph 丅', [52, -80, 949, 748], region, [[52, 672, 949, 748], [300, -80, 380, 706], [600, -80, 680, 706]]), slash(), stroke()]
    expect(fix.apply(forked, composer, region)).toBe(forked)
  })
  it('lists the four faces’ glyphs', () => {
    for (const ch of ['丅', '丿', '丨']) expect(fix.glyphs[ch]).toHaveLength(4)
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




describe('C219 ⿲木十木', () => {
  it('gives the middle 十 the gap the two 木 leave', () => {
    const left = part('host 椵', [0, 0, 1000, 1000], [38, 40, 352, 962], [[38, 40, 352, 962]])
    const middle = part('glyph 十', [0, 0, 1000, 1000], [397, 40, 606, 962], [[397, 40, 606, 962]])
    const right = part('host 楙', [0, 0, 1000, 1000], [653, 40, 967, 962], [[653, 40, 967, 962]])
    const [, fixed] = componentFix('⿲木十木', [left, middle, right], { glyphRecord: () => null })
    expect(fixed.target[2] - fixed.target[0]).toBeCloseTo((653 - 352) * 0.9, 6)
    expect((fixed.target[0] + fixed.target[2]) / 2).toBeCloseTo((352 + 653) / 2, 6)
  })
})

it('opens both gaps around 从 while preserving the bars of ⿱一丛', () => {
  const frame = [0, 0, 1000, 1000]
  const top = part('glyph 一', frame, frame, [[40, 920, 960, 980]])
  const lower = part('glyph 丛', frame, frame, [[20, 0, 980, 50], [120, 70, 450, 910], [520, 70, 930, 910]])
  for (const fontStyle of ['sans', 'serif']) {
    const [bar, inset] = COMPONENT_FIXES['⿱一丛'].apply([top, lower], { fontStyle, glyphRecord: () => null })
    expect(bar).toBe(top)
    expect(inset.part.contours[0]).toEqual(lower.part.contours[0])
    expect(inset.target[3]).toBeCloseTo(box(inset.part.contours[1])[3])
    for (const contour of inset.part.contours.slice(1)) {
      expect(box(contour)[1]).toBeGreaterThan(110)
      expect(box(contour)[3]).toBeLessThan(884)
    }
  }
})

describe('⿰舟邊', () => {
  const em = [0, 0, 1000, 1000]
  const boat = part('learned 艭', em, [59, -37, 346, 770], [em])
  const border = part('glyph 邊', em, [402, -4, 944, 772], [[0, 0, 1000, 300], [350, 400, 900, 1000]])

  it('closes the excess gap in FangSong and Pen while leaving Sans and Serif alone', () => {
    const gapOf = ([l, r]) => r.target[0] - l.target[2]
    for (const fontStyle of ['fangsong', 'pen-writing']) {
      const fixed = componentFix('⿰舟邊', [boat, border], { fontStyle })
      expect(gapOf(fixed)).toBeLessThan(gapOf([boat, border]))
      expect(gapOf(fixed)).toBeCloseTo(0.018 * (944 - 59), 5)
    }
    for (const fontStyle of ['sans', 'serif']) {
      expect(componentFix('⿰舟邊', [boat, border], { fontStyle })).toEqual([boat, border])
    }
  })

  it('expands Regular ⿰舟邊 to a full two-column frame at root without squashing 邊 contours', () => {
    const face = [89, -56, 915, 800]
    const [left, right] = componentFix('⿰舟邊', [boat, border], { fontStyle: 'regular', face }, face)
    // Contours stay intact (no vertical 辶 squash).
    expect(right.part).toBe(border.part)
    expect(right.target[3] - right.target[1]).toBeGreaterThan(880)
    expect(right.target[2] - right.target[0]).toBeGreaterThan(580)
    expect(left.target[2]).toBeLessThan(right.target[0])
    // Nested placements stay within their allocated region.
    const nested = [327, -21, 914, 784]
    const [nLeft, nRight] = componentFix('⿰舟邊', [
      part('host 艭', em, [327, -21, 573, 784], [em]),
      part('glyph 邊', em, [596, -21, 914, 784], [em]),
    ], { fontStyle: 'regular', face }, nested)
    expect(nLeft.target[0]).toBeCloseTo(nested[0], 6)
    expect(nRight.target[2]).toBeCloseTo(nested[2], 6)
    expect(nRight.target[1]).toBeCloseTo(nested[1], 6)
    expect(nRight.target[3]).toBeCloseTo(nested[3], 6)
  })
})

describe('日進斗金 ⿱⿰日斗⿺辶⿰隹金', () => {
  const frame = [0, 0, 1000, 1000]
  const sample = origin => part(origin, frame, frame, [[100, 100, 900, 900]])
  const five = () => ['host 旰', 'host 枓', 'glyph 辶', 'learned 䳡', 'learned 唫'].map(sample)

  it('places all five leaves in reading order across all five faces and nested regions', () => {
    for (const fontStyle of ['sans', 'serif', 'fangsong', 'regular', 'pen-writing']) {
      for (const region of [[38, -81, 967, 840], [450, 0, 950, 800]]) {
        const boxes = incomeBoxes(INCOME_IDS, fontStyle, region)
        expect(boxes).toHaveLength(5)
        const out = COMPONENT_FIXES[INCOME_IDS].apply(five(), { fontStyle }, region)
        expect(out.map(p => p.target)).toEqual(boxes)
        const [day, dou, walk, bird, gold] = out.map(p => p.target)
        // 日 beside 斗 on the top row, clear of 辶, 隹 and 金 below.
        expect(day[2]).toBeLessThan(dou[0])
        expect(day[1]).toBeGreaterThan(walk[3])
        expect(dou[1]).toBeGreaterThan(bird[3])
        expect(dou[1]).toBeGreaterThan(gold[3])
        // 辶 spans beneath both 隹 and 金, with 隹 clear of 金 horizontally.
        expect(walk[0]).toBeLessThan(bird[0])
        expect(walk[2]).toBeGreaterThan(gold[2])
        expect(walk[1]).toBeLessThan(bird[1])
        expect(walk[1]).toBeLessThan(gold[1])
        expect(bird[2]).toBeLessThan(gold[0])
      }
    }
  })

  it('insets left and top edges when nested inside a larger face', () => {
    const face = [38, -81, 967, 840]
    const rightRegion = [450, -81, 967, 840]
    const lowerRegion = [38, -81, 967, 580]
    const rightBoxes = incomeBoxes(INCOME_IDS, 'sans', rightRegion, face)
    const rootRight = incomeBoxes(INCOME_IDS, 'sans', rightRegion)
    expect(rightBoxes[2][0]).toBeGreaterThan(rootRight[2][0])
    expect(rightBoxes[1][3]).toBeCloseTo(rootRight[1][3], 6)
    const lowerBoxes = incomeBoxes(INCOME_IDS, 'sans', lowerRegion, face)
    const rootLower = incomeBoxes(INCOME_IDS, 'sans', lowerRegion)
    expect(lowerBoxes[1][3]).toBeLessThan(rootLower[1][3])
    expect(lowerBoxes[2][0]).toBeCloseTo(rootLower[2][0], 6)
  })

  it('handles encoded 𪰍 top pair and ignores unrecognized layouts or the swapped IDS', () => {
    const region = [89, -56, 915, 800]
    const four = ['glyph 𪰍', 'glyph 辶', 'learned 䳡', 'learned 唫'].map(sample)
    const out = COMPONENT_FIXES[INCOME_IDS].apply(four, { fontStyle: 'regular' }, region)
    const boxes = incomeBoxes(INCOME_IDS, 'regular', region)
    expect(out[0].target).toEqual(union([boxes[0], boxes[1]]))
    expect(out.slice(1).map(p => p.target)).toEqual(boxes.slice(2))

    const splitComposer = {
      fontStyle: 'regular',
      face: region,
      drawNode: () => [sample('learned 㫑'), sample('learned 斘')],
    }
    const splitOut = COMPONENT_FIXES[INCOME_IDS].apply(four, splitComposer, region)
    expect(splitOut).toHaveLength(5)
    expect(splitOut.map(p => p.target)).toEqual(boxes)

    const misshapedFive = ['glyph 𪰍', 'glyph 辶', 'learned 䳡', 'learned 唫', 'glyph 一'].map(sample)
    expect(COMPONENT_FIXES[INCOME_IDS].apply(misshapedFive, { fontStyle: 'regular' }, region)).toBe(misshapedFive)

    const unrelated = ['glyph 日', 'glyph 辶', 'learned 䳡', 'learned 唫'].map(sample)
    expect(COMPONENT_FIXES[INCOME_IDS].apply(unrelated, { fontStyle: 'regular' }, region)).toBe(unrelated)
    expect(incomeBoxes('⿰⿱日斗⿱進金', 'regular', region)).toBeNull()
  })
})
