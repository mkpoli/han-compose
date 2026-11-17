import { describe, expect, it } from 'bun:test'
import { drawnContours, makePart, mapped, partOf, placed, pointsBox, rings, scaleOf } from 'han-compose/geometry'
import { BODY_FORMS, CONSTRUCTS, IVD_FORMS, SURROUND_CONSTRUCTS, bodyForm, constructParts, ivdParts } from 'han-compose/constructs'
import { Composer } from 'han-compose/compose'
import { hexOf } from 'han-compose/sha256.js'
import constants from 'han-compose/constants.json' with { type: 'json' }
import notoCong from './fixtures/noto-cong-body.json' with { type: 'json' }
import notoYu from './fixtures/noto-yu.json' with { type: 'json' }
import notoZhe from './fixtures/noto-zhe.json' with { type: 'json' }
import notoJie from './fixtures/noto-jie.json' with { type: 'json' }
import notoQi from './fixtures/noto-qi.json' with { type: 'json' }
// 眔 from the Kaisho export (ce3eaafda8f9-kaisho-compose-layout-v4-kaisho-f7).
import kaishoEye from './fixtures/kaisho-eye-lower.json' with { type: 'json' }
// 冂 and 斗 from the four faces' exports (a83fc941166b sans, 8156f838798c serif, 9f797e2322d2
// fangsong, ce3eaafda8f9 kaisho).
import fleshFaces from './fixtures/flesh-faces.json' with { type: 'json' }

const rect = (x0, y0, x1, y1) => {
  const light = new Float64Array([x0, y0, x1, y0, x1, y1, x0, y1])
  return { ops: [], light, heavy: light.slice(), width: null }
}

/** A glyph record of the export's form: points quantized four to a unit, flat [x, y, …] contours. */
const glyph = (box, ...flat) => ({
  b: box,
  p: flat.map(points => [`M${'L'.repeat(points.length / 2 - 1)}`,
    Buffer.from(Int16Array.from(points.map(v => Math.round(v * 4))).buffer).toString('base64'),
    Buffer.from(Int16Array.from(points, () => 0).buffer).toString('base64')]),
})

const composer = () => new Composer({
  manifest: { constants, spelled: [] }, layout: null,
  rec: key => notoCong[key] ?? null, hosts: () => [], places: () => [],
})

describe('a stack cut from an enclosing host', () => {
  const spec = SURROUND_CONSTRUCTS['⿳𠂉一乙']
  const face = [0, 0, 1000, 900]
  const loose = () => [[0, 600, 1000, 900], [0, 300, 1000, 500], [0, 0, 1000, 200]].map((box, i) =>
    placed(makePart([rect(...box)]), box, box, 0, `part ${i}`))

  it('draws 𠂉一乙 as the 气 frame of 𣱪 without the 票 bar', () => {
    expect(spec.host).toBe('𣱪')
    expect(spec.keep).toBe('frame')
    const body = partOf(spec.body)
    // Three bars, a slant and a hook. 𣱪's fourth 气 contour is 票's 示 bar and is left out.
    expect(body.contours).toHaveLength(3)
    const boxes = body.contours.map(contour => pointsBox(contour.light))
    const [x0, y0, x1, y1] = body.box, width = x1 - x0, height = y1 - y0
    const hook = boxes.find(box => box[1] <= y0 + 2 && box[2] >= x1 - 2)
    expect(hook).toBeDefined()
    expect(hook[3] - hook[1]).toBeGreaterThan(0.4 * height)
    const bars = boxes.filter(box => box[2] - box[0] > 0.2 * width && box[3] - box[1] < 0.2 * height)
    // The three bars: the slant carries the first two, the hook the lower one.
    expect(bars.length).toBeGreaterThanOrEqual(1)
    for (const bar of bars) expect(bar[0] - x0).toBeLessThan(0.35 * width)
  })

  it('replaces the three loose parts', () => {
    const out = constructParts(spec, loose(), null, face)
    expect(out).toHaveLength(1)
    expect(out[0].origin).toBe('construct 𣱪 frame')
    expect(out[0].target[0]).toBeCloseTo(face[0], 0)
    expect(out[0].target[3]).toBeCloseTo(face[3], 0)
  })

  it('is drawn only as a left-bottom surround’s enclosing part', () => {
    expect(CONSTRUCTS['⿳𠂉一乙'].host).toBe('气')
    const strokes = {
      '𠂉': glyph([0, 600, 1000, 900], [100, 620, 900, 680], [200, 700, 300, 880]),
      '一': glyph([0, 300, 1000, 500], [80, 360, 920, 430]),
      '乙': glyph([0, 0, 1000, 200], [100, 20, 900, 80], [700, 20, 900, 180]),
      '木': glyph([0, 0, 1000, 900], [450, 0, 550, 900], [100, 500, 900, 560]),
    }
    const c = new Composer({
      manifest: { constants, spelled: [] }, layout: null,
      rec: key => strokes[key] ? { G: strokes[key] } : null, hosts: () => [], places: () => [],
    })
    // Without a matching 气 glyph, retain the three named operands.
    expect(c.compose('⿳𠂉一乙').map(part => part.origin)).toEqual(['glyph 𠂉', 'glyph 一', 'glyph 乙'])
    // As ⿺'s enclosing part it is the frame, with the surrounded part placed in its room.
    expect(c.compose('⿺⿳𠂉一乙木').map(part => part.origin)).toEqual(['construct 𣱪 frame', 'glyph 木'])
  })
})

describe('a body form', () => {
  const frame = glyph([0, 0, 100, 100],
    [0, 0, 100, 0, 100, 100, 0, 100],
    [40, 40, 60, 40, 60, 60, 40, 60])
  const host = glyph([200, 0, 300, 50],
    [220, 10, 280, 10, 280, 40, 220, 40])
  const spec = {
    host: '冎',
    keep: { [hexOf(JSON.stringify(frame.p))]: [0] },
    body: { [hexOf(JSON.stringify(host.p))]: [0] },
  }

  it('keeps its own contours and carries the host body into its box', () => {
    const form = bodyForm(frame, host, spec)
    expect(form.box).toEqual([0, 0, 100, 100])
    expect(form.contours).toHaveLength(2)
    expect(Array.from(form.contours[0].light)).toEqual([0, 0, 100, 0, 100, 100, 0, 100])
    // [200, 0, 300, 50] drawn in [0, 0, 100, 100]: across one to one, up two to one.
    expect(Array.from(form.contours[1].light)).toEqual([20, 20, 80, 20, 80, 80, 20, 80])
  })

  it('keeps the glyph when either outline is not the one the cut was made for', () => {
    expect(bodyForm(frame, host, { ...spec, keep: { ['0'.repeat(64)]: [0] } })).toBeNull()
    expect(bodyForm(frame, host, { ...spec, body: { ['0'.repeat(64)]: [0] } })).toBeNull()
    expect(bodyForm(frame, null, spec)).toBeNull()
  })

  it('names the 囪 and 囱 outlines of the export', () => {
    const form = BODY_FORMS['囪']
    expect(form.host).toBe('囱')
    expect(form.keep[hexOf(JSON.stringify(notoCong['囪'].G.p))]).toEqual([0, 1, 2])
    expect(form.body[hexOf(JSON.stringify(notoCong['囱'].G.p))]).toEqual([0, 1, 2, 3])
  })

  it('draws 囪 with the 夕 of 囱 inside its own frame', () => {
    const c = composer()
    const own = c.glyph('囪'), drawn = c.drawnGlyph('囪')
    expect(own.contours).toHaveLength(6)
    expect(drawn.contours).toHaveLength(7)
    expect(drawn.box).toEqual(own.box)
    for (const i of [0, 1, 2]) expect(Array.from(drawn.contours[i].light)).toEqual(Array.from(own.contours[i].light))
    // The inner contours stay inside the frame's counter, between the sides at 195 and 805.
    const inner = pointsBox(drawn.contours.slice(3).flatMap(c => Array.from(c.light)))
    expect(inner[0]).toBeGreaterThan(195)
    expect(inner[2]).toBeLessThan(805)
    expect(inner[1]).toBeGreaterThan(52)
    expect(inner[3]).toBeLessThan(637)
  })

  it('draws the whole character and the sequence with the 夕 inside', () => {
    expect(composer().compose('囪')[0].part.contours).toHaveLength(7)
    const [top] = composer().compose('⿱囪心')
    expect(top.origin).toBe('glyph 囪')
    expect(top.part.contours).toHaveLength(7)
  })
})

describe('a variation sequence form', () => {
  const spec = IVD_FORMS['⿻者丶']

  it('names 者 U+E0101 and the export each font draws', () => {
    expect(spec.base).toBe('者')
    expect([...spec.sequence]).toEqual(['者', '\u{E0101}'])
    expect(spec.forms.sans.font).toBe('Noto Sans CJK JP 2.004')
    expect(spec.forms.serif.font).toBe('Noto Serif CJK JP 2.002')
    for (const style of ['sans', 'serif']) expect(spec.forms[style].digest).toBe(hexOf(JSON.stringify(notoZhe[style].p)))
  })

  it('draws ⿻者丶 with the dotted 者 of each font', () => {
    for (const style of ['sans', 'serif']) {
      const [part] = ivdParts(spec, '⿻者丶', notoZhe[style], style, constants.face, true)
      expect(part.origin).toBe(`IVS 者 U+E0101 (${spec.forms[style].font}): ⿻者丶`)
      expect(part.fixed).toBe(true)
      // A standalone form keeps the font's em; the dot is its own contour above 日.
      expect(part.target).toEqual(part.part.box)
      const [x0, y0, x1, y1] = part.part.box
      const dot = part.part.contours.map(c => pointsBox(c.light))
        .find(([a, b, c, d]) => c - a < (x1 - x0) * 0.3 && b > y0 + (y1 - y0) * 0.6 && a > x0 + (x1 - x0) * 0.4)
      expect(dot).toBeDefined()
      expect(dot[3] - dot[1]).toBeGreaterThan(60)
    }
  })

  it('fills a nested region, and keeps the composer drawing elsewhere', () => {
    expect(ivdParts(spec, '⿻者丶', notoZhe.sans, 'sans', [0, 0, 500, 500], false)[0].target).toEqual([0, 0, 500, 500])
    expect(ivdParts(spec, '⿻者丶', notoZhe.sans, 'pen-writing', constants.face, true)).toBeNull()
    const other = { ...notoZhe.sans, p: notoZhe.sans.p.slice(1) }
    expect(ivdParts(spec, '⿻者丶', other, 'sans', constants.face, true)).toBeNull()
  })

  it('draws the standalone description from the sequence', () => {
    const c = new Composer({
      manifest: { constants, spelled: [] }, layout: null,
      rec: key => key === '者' ? { G: notoZhe.sans } : null, hosts: () => [], places: () => [],
    })
    const [part] = c.compose('⿻者丶')
    expect(part.origin).toBe('IVS 者 U+E0101 (Noto Sans CJK JP 2.004): ⿻者丶')
    expect(part.part.contours).toHaveLength(4)
  })

  it('composes its operands when the export draws another 者', () => {
    const other = { ...notoZhe.sans, p: notoZhe.sans.p.slice(1) }
    const dot = glyph([700, 500, 800, 600], [700, 500, 800, 500, 800, 600, 700, 600])
    const c = new Composer({
      manifest: { constants, spelled: [] }, layout: null,
      rec: key => key === '者' ? { G: other } : key === '丶' ? { G: dot } : null,
      hosts: () => [], places: () => [],
    })
    expect(c.compose('⿻者丶').map(part => part.origin)).toEqual(['glyph 者', 'glyph 丶'])
  })
})

describe('a whole component taken from its character', () => {
  const jie = (glyph = notoJie['㓞'].G) => new Composer({
    manifest: { constants, spelled: [] }, layout: null,
    rec: key => key === '㓞' ? { ...notoJie['㓞'], G: glyph } : notoJie[key] ?? null,
    hosts: () => [], places: () => [],
  })

  it('names 㓞 and the seven contours that draw it', () => {
    const spec = CONSTRUCTS['⿰⿻三丨刀']
    expect(spec.host).toBe('㓞')
    expect(spec.keepParts).toBe(0)
    expect(spec.contours).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(spec.digest).toBe(hexOf(JSON.stringify(notoJie['㓞'].G.p)))
  })

  it('draws ⿰⿻三丨刀 as one 㓞 rather than two operands', () => {
    const out = jie().compose('⿰⿻三丨刀')
    expect(out).toHaveLength(1)
    expect(out[0].origin).toBe('construct 㓞 whole')
    expect(out[0].part.contours).toHaveLength(7)
    out[0].target.forEach((value, i) => expect(value).toBeCloseTo(constants.face[i], 6))
  })

  it('keeps the composed operands when the export draws another 㓞', () => {
    const other = { ...notoJie['㓞'].G, p: notoJie['㓞'].G.p.slice(1) }
    expect(jie(other).compose('⿰⿻三丨刀').length).toBeGreaterThan(1)
  })
})

describe('a roof over its part', () => {
  const roof = (rec = notoYu) => new Composer({
    manifest: { constants, spelled: [] }, layout: null,
    rec: key => rec[key] ?? null, hosts: () => [], places: () => [],
  })

  it('draws ⿵入一 as the stack 入 over 一, not an enclosure', () => {
    const roofed = roof().compose('⿵入一'), stacked = roof().compose('⿱入一')
    expect(roofed.map(part => [part.origin, part.target])).toEqual(stacked.map(part => [part.origin, part.target]))
    const [enter, bar] = roofed.map(part => part.target)
    // The bar lies below the roof's ink instead of in the slot between its legs.
    expect(bar[3]).toBeLessThan(enter[1])
  })

  it('keeps a frame enclosing its part', () => {
    const enclosed = roof().compose('⿵冂一'), stacked = roof().compose('⿱冂一')
    expect(enclosed.map(part => part.target)).not.toEqual(stacked.map(part => part.target))
    const [outer, inner] = enclosed.map(part => part.target)
    expect(inner[1]).toBeGreaterThan(outer[1])
    expect(inner[3]).toBeLessThan(outer[3])
  })

  it('draws the stack where the rewritten spelling is a character of its own', () => {
    // 𠓛 is ⿱入一, and its glyph is the font's cut of the pair (入 over a bar close under its feet).
    // The ⿵ description gives the stack itself, so the bar takes its band under the roof.
    const spelled = new Composer({
      manifest: { constants, spelled: [] }, layout: null,
      rec: key => key === '⿱入一' ? { e: '𠓛' } : key === '𠓛' ? { ...notoYu['亼'], k: '𠓛' } : notoYu[key] ?? null,
      hosts: () => [], places: () => [],
    })
    expect(spelled.compose('⿵入一').map(part => part.origin)).toEqual(['glyph 入', 'glyph 一'])
    // Written ⿱ itself, the description names 𠓛 and keeps its glyph.
    expect(spelled.compose('⿱入一').map(part => part.origin)).toEqual(['glyph 𠓛'])
  })
})

describe('a row of one character repeated', () => {
  const bars = glyph([59, 42, 918, 696],
    [59, 618, 918, 618, 918, 696, 59, 696],
    [59, 42, 918, 42, 918, 120, 59, 120])
  const repeated = () => {
    const c = new Composer({
      manifest: { constants, spelled: [] }, layout: { ops: ['⿰', '⿱'], defaults: {}, features: {}, seeds: [] },
      rec: key => key === '𠄠' ? { k: '𠄠', G: bars, ink: 400, o: 2, nl: 2 } : null,
      hosts: () => [], places: () => [],
    })
    // The layout's left band is narrower and its right taller, as the network predicts for ⿰𠄠𠄠.
    c.predict = () => [[56, 21, 432, 724], [442, 2, 950, 739]]
    return c.compose('⿰𠄠𠄠')
  }

  it('draws a whole glyph at one size and height in every cell', () => {
    const out = repeated()
    expect(out.map(part => part.origin)).toEqual(['glyph 𠄠', 'glyph 𠄠'])
    const [[x0, y0, x1, y1], [x2, y2, x3, y3]] = out.map(part => part.target)
    expect(x1 - x0).toBeCloseTo(x3 - x2, 6)
    expect(y0).toBeCloseTo(y2, 6)
    expect(y1).toBeCloseTo(y3, 6)
    expect(x2).toBeGreaterThan(x1)
  })
})

it('C061 keeps only 气’s first three strokes and closes with 乙, including beside 忄', async () => {
  const records = (await import('./fixtures/noto-c061.json')).default
  const spec = CONSTRUCTS['⿳𠂉一乙']
  const glyphs = Object.fromEntries(Object.entries(records).map(([ch, r]) => [ch, r.G]))
  const out = constructParts(spec, [], glyphs, constants.face)
  expect(out.map(p => p.origin)).toEqual(['construct 气 first three strokes', 'construct 乙 closing stroke'])
  expect(out[0].part.contours).toHaveLength(3)
  expect(out[1].part.contours).toHaveLength(2)
  expect(out[0].part.contours.map(c => pointsBox(c.light))).toEqual([0, 1, 3].map(i => pointsBox(partOf(glyphs['气']).contours[i].light)))
  expect(out[1].part.contours.map(c => pointsBox(c.light))).toEqual(partOf(glyphs['乙']).contours.map(c => pointsBox(c.light)))
  const c = new Composer({ manifest: { constants, spelled: [] }, layout: null,
    rec: key => records[key] ?? null, hosts: () => [], places: () => [] })
  const nested = c.compose('⿰忄⿳𠂉一乙')
  expect(nested.map(p => p.origin)).toContain('construct 乙 closing stroke')
  expect(nested.map(p => p.origin)).not.toContain('construct 气 whole')
  expect(constructParts(spec, [], { ...glyphs, '乙': null }, constants.face)).toEqual([])
  expect(SURROUND_CONSTRUCTS['⿳𠂉一乙'].host).toBe('𣱪')
})


it('C062 joins the bundled wood to the roof without moving the top or foot', async () => {
  const { componentParts } = await import('han-compose/component-forms')
  const [out] = componentParts('⿳𰀉冖木')
  const wood = pointsBox(out.part.contours[3].light)
  expect(wood).toEqual([37, -79, 964, 489])
  const points = out.part.contours[3].light
  expect(points[1] - points[3]).toBe(58) // Preserve the wood bar’s native weight.
  expect(pointsBox(out.part.contours[2].light)).toEqual([75, 398, 930, 841])
  const [nested] = componentParts('⿳𰀉冖木', [0, 0, 500, 500], 'sans', false)
  expect(pointsBox(nested.part.contours[3].light)[3]).toBe(489)
})


it('C062 overlaps the roof seam while the cap seams remain one continuous contour', async () => {
  const { componentParts } = await import('han-compose/component-forms')
  const [out] = componentParts('⿳𰀉冖木')
  const roof = out.part.contours[2].light, wood = out.part.contours[3].light
  // The two cap seams already belong to the same outline as 冖.
  for (const y of [738, 701, 574, 535]) {
    expect(Array.from(roof).some((x, i) => i % 2 === 0 && x === 461 && roof[i + 1] === y)).toBe(true)
    expect(Array.from(roof).some((x, i) => i % 2 === 0 && x === 538 && roof[i + 1] === y)).toBe(true)
  }
  expect(pointsBox(wood)[3]).toBeGreaterThan(487)
  expect(pointsBox(wood)[3]).toBeLessThan(535)
})

it('C061 retains the middle horizontal above the replacement closing stroke', async () => {
  const records = (await import('./fixtures/noto-c061.json')).default
  const glyphs = Object.fromEntries(Object.entries(records).map(([ch, r]) => [ch, r.G]))
  const [head, closing] = constructParts(CONSTRUCTS['⿳𠂉一乙'], [], glyphs, constants.face)
  const middle = mapped(pointsBox(head.part.contours[1].light), head.source, head.target)
  expect(middle[1] - closing.target[3]).toBeGreaterThan(60)
  expect(middle[3] - middle[1]).toBeGreaterThan(50)
})


describe('C052 ⿲𰀪丨⿱丶丶 from the Kaisho export’s 眔', () => {
  const spec = CONSTRUCTS['⿲𰀪丨⿱丶丶'], glyphs = { 眔: kaishoEye['眔'].G }
  const span = parts => [Math.min(...parts.map(p => p.target[0])), Math.min(...parts.map(p => p.target[1])),
    Math.max(...parts.map(p => p.target[2])), Math.max(...parts.map(p => p.target[3]))]
  it('cuts one part per leaf: the 𰀪, the stem and the two dots', () => {
    const parts = constructParts(spec, [], glyphs, constants.face)
    expect(parts.map(p => p.origin)).toEqual(['construct 眔 𰀪', 'construct 眔 丨', 'construct 眔 upper 丶', 'construct 眔 lower 丶'])
    expect(parts.map(p => p.part.contours.length)).toEqual([2, 1, 1, 1])
    const [left, stem, upper, lower] = parts.map(p => p.target)
    expect(left[2]).toBeLessThan(stem[0])
    expect(upper[0]).toBeGreaterThan(stem[2])
    expect(upper[1]).toBeGreaterThan(lower[1])
  })
  it('stays where 眔 sets it alone, and fills the place it is given inside a character', () => {
    const alone = span(constructParts(spec, [], glyphs, constants.face))
    const face = constants.face
    expect(alone[3] - alone[1]).toBeLessThan(0.7 * (face[3] - face[1]))
    const region = [100, -50, 900, 400]
    span(constructParts(spec, [], glyphs, region, false)).forEach((v, i) => expect(v).toBeCloseTo(region[i], 6))
  })
  it('leaves another export’s 眔 to the composer', () => {
    expect(constructParts(spec, [], { 眔: notoQi['気'].G }, constants.face)).toEqual([])
  })
})

describe('⿵冂⺀, the flesh form, from each face’s 冂 and 斗', () => {
  const spec = CONSTRUCTS['⿵冂⺀']
  const { face } = constants
  /** The widths of the ink a line crosses in a drawn part: across `axis` 0 a level line at height
   *  `at`, across `axis` 1 an upright one at `at`. */
  const strokes = (p, axis, at) => {
    const cuts = []
    for (const ring of rings(p.part.contours, drawnContours(p))) for (let i = 0; i < ring.length; i += 2) {
      const j = (i + 2) % ring.length, a = ring[i + 1 - axis], b = ring[j + 1 - axis]
      if ((a - at) * (b - at) < 0) cuts.push(ring[i + axis] + (ring[j + axis] - ring[i + axis]) * (at - a) / (b - a))
    }
    cuts.sort((a, b) => a - b)
    return Array.from({ length: cuts.length / 2 }, (_, k) => cuts[2 * k + 1] - cuts[2 * k])
  }
  /** The two legs' widths at mid-height and the bar's thickness over the opening. */
  const weight = p => {
    const [x0, y0, x1, y1] = p.target
    return { legs: strokes(p, 0, (y0 + y1) / 2), bar: strokes(p, 1, x0 + 0.4 * (x1 - x0)).at(-1) }
  }
  const own = record => { const part = partOf(record); return placed(part, part.box, part.box, 0, 'glyph 冂') }

  for (const [style, records] of Object.entries(fleshFaces)) {
    it(`draws the face’s 冂 round two of its dots, one part for each leaf, in ${style}`, () => {
      const [frame, dots] = constructParts(spec, [], records, face)
      expect([frame.origin, dots.origin]).toEqual(['construct 冂', 'construct 斗 ⺀'])
      expect(frame.part.contours).toHaveLength(partOf(records['冂']).contours.length)
      expect(dots.part.contours).toHaveLength(2)
      // The dots are drawn at one scale, the upper one first, one above the other.
      const [sx, sy] = scaleOf(dots)
      expect(sx).toBeCloseTo(sy, 6)
      const [upper, lower] = dots.part.contours.map(c => mapped(pointsBox(c.light), dots.source, dots.target))
      expect(upper[1]).toBeGreaterThan(lower[3])
      expect((upper[0] + upper[2]) / 2).toBeCloseTo((lower[0] + lower[2]) / 2, 6)
      // They stand in the opening, clear of both legs, the bar and the hook's foot.
      const [left, right] = weight(frame).legs
      expect(Math.min(upper[0], lower[0])).toBeGreaterThan(frame.target[0] + left)
      expect(Math.max(upper[2], lower[2])).toBeLessThan(frame.target[2] - right)
      expect(upper[3]).toBeLessThan(frame.target[3] - weight(frame).bar)
      expect(lower[1]).toBeGreaterThan(frame.target[1] + 0.2 * (frame.target[3] - frame.target[1]))
    })

    it(`stands alone as tall as the face, at its own proportions and its strokes’ own weight, in ${style}`, () => {
      const [frame] = constructParts(spec, [], records, face)
      expect([frame.target[1], frame.target[3]]).toEqual([face[1], face[3]])
      expect((frame.target[2] - frame.target[0]) / (face[3] - face[1])).toBeCloseTo(0.68, 6)
      expect((frame.target[0] + frame.target[2]) / 2).toBeCloseTo((face[0] + face[2]) / 2, 6)
      // Narrowing slides the right leg in along the bar, so every stroke is as wide as the face’s 冂
      // draws it at this height: a frame scaled narrower would thin both legs.
      const glyph = own(records['冂']), grown = (face[3] - face[1]) / (glyph.target[3] - glyph.target[1])
      const drawn = weight(frame), native = weight(glyph)
      expect(drawn.legs).toHaveLength(2)
      // A face of one weight is never weighted again, and its opening is the whole of what slides.
      // A weighted face’s opening is what stays open in its heavy master, so less of it slides.
      const still = glyph.part.contours.every(c => c.light.every((v, i) => v === c.heavy[i]))
      drawn.legs.forEach((leg, k) => expect(Math.abs(leg / (grown * native.legs[k]) - 1)).toBeLessThan(still ? 0.03 : 0.1))
      expect(Math.abs(drawn.bar / (grown * native.bar) - 1)).toBeLessThan(0.05)
    })

    it(`slides the right leg inside the opening both masters leave, in ${style}`, () => {
      const [frame] = constructParts(spec, [], records, face)
      const glyph = partOf(records['冂']), middle = (glyph.box[1] + glyph.box[3]) / 2
      // The left leg, below the middle, is where the glyph draws it in both masters.
      glyph.contours.forEach((contour, k) => {
        for (const master of ['light', 'heavy']) for (let i = 0; i < contour[master].length; i += 2) {
          if (contour[master][i + 1] > middle || contour[master][i] > glyph.box[0] + 0.35 * (glyph.box[2] - glyph.box[0])) continue
          expect(frame.part.contours[k][master][i]).toBe(contour[master][i])
        }
      })
      // The hook, below the middle, moves whole: every point of it by the same slide.
      const slides = new Set()
      glyph.contours.forEach((contour, k) => {
        for (const master of ['light', 'heavy']) for (let i = 0; i < contour[master].length; i += 2) {
          if (contour[master][i + 1] > middle || contour[master][i] < glyph.box[0] + 0.35 * (glyph.box[2] - glyph.box[0])) continue
          slides.add(Math.round((contour[master][i] - frame.part.contours[k][master][i]) * 100))
        }
      })
      expect(slides.size).toBe(1)
      expect([...slides][0]).toBeGreaterThan(0)
    })

    it(`takes a column whole and keeps more of its strokes than the squeeze, in ${style}`, () => {
      const column = [100, -50, 500, 800]
      const [frame, dots] = constructParts(spec, [], records, column, false)
      frame.target.forEach((v, i) => expect(v).toBeCloseTo(column[i], 6))
      const glyph = own(records['冂']), squeeze = (column[2] - column[0]) / (glyph.target[2] - glyph.target[0])
      weight(frame).legs.forEach((leg, k) => expect(leg / weight(glyph).legs[k]).toBeGreaterThan(1.25 * squeeze))
      const [sx, sy] = scaleOf(dots)
      expect(sx).toBeCloseTo(sy, 6)
      expect(dots.target[0]).toBeGreaterThan(column[0])
      expect(dots.target[2]).toBeLessThan(column[2])
    })

    it(`keeps its proportions within the stretch in a wide place, centred, in ${style}`, () => {
      const wide = [0, 0, 900, 400]
      const [frame] = constructParts(spec, [], records, wide, false)
      expect([frame.target[1], frame.target[3]]).toEqual([0, 400])
      expect((frame.target[2] - frame.target[0]) / 400).toBeCloseTo(0.68 * constants.STRETCH, 6)
      expect((frame.target[0] + frame.target[2]) / 2).toBeCloseTo(450, 6)
    })
  }

  it('names the four faces’ 冂 and 斗 and leaves another export to the composer', () => {
    expect(constructParts(spec, [], { 冂: fleshFaces.sans['冂'], 斗: fleshFaces.serif['冂'] }, face)).toEqual([])
    // A known 斗 beside another face’s 冂 is no face the form was read from.
    expect(constructParts(spec, [], { 冂: fleshFaces.serif['冂'], 斗: fleshFaces.sans['斗'] }, face)).toEqual([])
    expect(constructParts(spec, [], { 冂: fleshFaces.sans['冂'], 斗: null }, face)).toEqual([])
    expect(constructParts(spec, [], { 冂: null, 斗: fleshFaces.sans['斗'] }, face)).toEqual([])
  })

  const dou = { k: '斗', ink: 4000, o: 4, nl: 4, G: fleshFaces.sans['斗'] }
  const drawer = (options = {}, records = {}) => new Composer({
    manifest: { constants, spelled: [] }, layout: null,
    rec: key => ({ 斗: dou, ...records })[key] ?? notoYu[key] ?? null,
    hosts: () => [], places: () => [],
  }, options)

  it('is drawn alone and as a component, and separated into its two leaves', () => {
    expect(drawer().compose('⿵冂⺀').map(part => part.origin)).toEqual(['construct 冂', 'construct 斗 ⺀'])
    expect(drawer().compose('⿰⿵冂⺀刂').map(part => part.origin)).toEqual(['construct 冂', 'construct 斗 ⺀', 'glyph 刂'])
    const separated = drawer({ separate: true }).compose('⿰⿵冂⺀刂')
    expect(separated.map(part => part.origin)).toEqual(['construct 冂', 'construct 斗 ⺀', 'glyph 刂'])
  })

  it('keeps the composer’s own parts where a glyph it is drawn from is excluded or another', () => {
    const own = ['glyph 冂', 'glyph ⺀']
    expect(drawer({ exclude: ['斗'] }).compose('⿵冂⺀').map(part => part.origin)).toEqual(own)
    expect(drawer({ exclude: ['冂'] }).compose('⿵冂⺀').map(part => part.origin)).not.toContain('construct 冂')
    expect(drawer({}, { 斗: { ...dou, G: fleshFaces.serif['斗'] } }).compose('⿵冂⺀').map(part => part.origin)).toEqual(own)
    expect(drawer({}, { 冂: { ...notoYu['冂'], G: fleshFaces.serif['冂'] } }).compose('⿵冂⺀').map(part => part.origin)).toEqual(own)
  })

  describe('in a row a layout sets', () => {
    // A layout of one layer that sets each operand in its usual box: the mean a record holds for
    // its place, or the layout’s default for a description with no record.
    const ops = ['⿰', '⿱', '⿵']
    const usual = () => {
      const rows = ops.length + 20, data = new Float32Array(rows * 8)
      for (const operand of [0, 1]) for (let k = 0; k < 4; k++) data[(ops.length + 10 * operand + k) * 8 + 4 * operand + k] = 1
      return { ops, shape: 0, defaults: { L: [0, -80, 620, 840], R: [640, -80, 960, 840], '⿵0': [0, -80, 1000, 840], '⿵1': [200, -80, 800, 600] },
        seeds: [[{ w: { rows, cols: 8, data }, b: new Float32Array(8) }]] }
    }
    // 月 stands on the left in a narrower box than a description with no record is given.
    const moon = [60, -70, 440, 800]
    // 偂 draws the row at its lower right: the frame in one column, 刂 in the other.
    const row = [520, -70, 940, 420]
    const donor = { h: '偂', op: '⿰', j: 1, v: 1, d: 1, si: 3499, fr: row, k: [0] }
    const hosts = { 'L\t⿵冂⺀': [{ ...donor, ok: ['刂'], b: [520, -70, 700, 420] }], 'R\t刂': [{ ...donor, ok: ['⿵冂⺀'], b: [760, -70, 940, 420] }] }
    const set = (options = {}, records = {}) => new Composer({
      manifest: { constants, spelled: [] }, layout: usual(),
      rec: key => ({ 斗: dou, 月: { ...notoYu['月'], u: { L: [moon, [0, 0, 0, 0], 9] } }, ...records })[key] ?? notoYu[key] ?? null,
      hosts: (key, place) => hosts[`${place}\t${key}`] ?? [], places: () => [],
    }, options)
    const left = composer => composer.predict('⿰', composer.parse('⿰⿵冂⺀刂').slice(1))[0].map(Math.round)
    const fallbacks = [
      ['斗 is excluded', () => set({ exclude: ['斗'] })],
      ['冂 is excluded', () => set({ exclude: ['冂'] })],
      ['the export draws another 斗', () => set({}, { 斗: { ...dou, G: fleshFaces.serif['斗'] } })],
      ['the export draws another 冂', () => set({}, { 冂: { ...notoYu['冂'], G: fleshFaces.serif['冂'] } })],
    ]

    it('takes the place the layout gives 月, and no donor’s row, where it is drawn', () => {
      expect(left(set())).toEqual(moon)
      const composer = set()
      expect(composer.enclosureRow('⿰', composer.parse('⿰⿵冂⺀刂').slice(1), null)).toBeNull()
      const [frame, , knife] = set().compose('⿰⿵冂⺀刂')
      expect(frame.origin).toBe('construct 冂')
      // The frame fills 月’s column, and 刂 keeps the right of the face, not the donor’s column.
      expect(frame.target[0]).toBeGreaterThanOrEqual(moon[0] - 1)
      expect(frame.target[2]).toBeLessThanOrEqual(moon[2] + 1)
      expect(knife.target[0]).toBeGreaterThan(moon[2])
    })

    for (const [name, composer] of fallbacks) it(`keeps the layout and the donor’s row of its description where ${name}`, () => {
      expect(left(composer())).toEqual([0, -80, 620, 840])
      const drawn = composer()
      const adopted = drawn.enclosureRow('⿰', drawn.parse('⿰⿵冂⺀刂').slice(1), null)
      expect(adopted).not.toBeNull()
      expect(adopted.map(part => part.origin)).not.toContain('construct 冂')
      // Each operand is drawn in its column of the donor’s row.
      const knife = adopted.at(-1).target
      expect(knife[0]).toBeGreaterThanOrEqual(760 - 1)
      expect(knife[2]).toBeLessThanOrEqual(940 + 1)
      expect(Math.max(...adopted.slice(0, -1).map(part => part.target[2]))).toBeLessThanOrEqual(700 + 1)
    })
  })
})
