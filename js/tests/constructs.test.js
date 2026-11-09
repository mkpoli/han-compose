import { describe, expect, it } from 'bun:test'
import { makePart, mapped, partOf, placed, pointsBox } from '@han-compose/composer/geometry'
import { BODY_FORMS, CONSTRUCTS, IVD_FORMS, SURROUND_CONSTRUCTS, bodyForm, constructParts, ivdParts } from '@han-compose/composer/constructs'
import { Composer } from '@han-compose/composer/compose'
import { hexOf } from '@han-compose/composer/sha256.js'
import constants from '@han-compose/composer/constants.json' with { type: 'json' }
import notoCong from './fixtures/noto-cong-body.json' with { type: 'json' }
import notoYu from './fixtures/noto-yu.json' with { type: 'json' }
import notoZhe from './fixtures/noto-zhe.json' with { type: 'json' }
import notoJie from './fixtures/noto-jie.json' with { type: 'json' }
import notoQi from './fixtures/noto-qi.json' with { type: 'json' }

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
    expect(ivdParts(spec, '⿻者丶', notoZhe.sans, 'kaisho', constants.face, true)).toBeNull()
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
  const { componentParts } = await import('@han-compose/composer/component-forms')
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
  const { componentParts } = await import('@han-compose/composer/component-forms')
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

