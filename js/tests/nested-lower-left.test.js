import { describe, expect, it } from 'bun:test'
import { Composer, designedSources, near, sweptPart } from '../src/compose.js'
import { partOf, pathMask, placed, pathRings, pointsBox } from '../src/geometry.js'
import { compose, createSource, sketch } from '../src/loader.js'
import { constants, files, layout, records, shards } from './fixtures/small-export.js'
// Noto Sans CJK JP 2.004, SIL OFL 1.1. The enclosing 克 and its 口 counter come from 尅.
import keDonor from './fixtures/sans-ke.json' with { type: 'json' }
// Noto Serif CJK JP 2.003, SIL OFL 1.1. The lower body of 百 supplies the seat.
import baiDonor from './fixtures/serif-ke-bai.json' with { type: 'json' }
// Noto Sans CJK JP and Zhuque Fangsong (SIL OFL 1.1).
import frameDonors from './fixtures/rice-walk-frames.json' with { type: 'json' }
// 爮 from TW-Kai (數位發展部, CNS11643全字庫, Open Government Data License 1.0).
// 爬 from Zhuque Fangsong and Kureedo (SIL OFL 1.1). See docs/licensing.md.
import clawFrames from './fixtures/claw-frames.json' with { type: 'json' }
// 咫 (Zhuque Fangsong, SIL OFL 1.1) and 𣥉 (TW-Kai, CNS11643, OGDL 1.0).
import rulerFrames from './fixtures/ruler-frames.json' with { type: 'json' }
// 毡 from Noto Sans CJK JP, SIL OFL 1.1.
import maoDonor from './fixtures/sans-fur-frame.json' with { type: 'json' }
// 尪 from Noto Sans CJK JP, SIL OFL 1.1.
import wangDonor from './fixtures/sans-limp-frame.json' with { type: 'json' }
// 夌/菱, 麵/处, 玉, 艹 across Noto Sans/Serif CJK JP, Zhuque Fangsong, Kureedo (SIL OFL 1.1),
// and TW-Kai (CNS11643, Open Government Data License 1.0).
import shrineDonors from './fixtures/shrine-jade-donors.json' with { type: 'json' }
import parts from './fixtures/sans-lower-left.json' with { type: 'json' }

// 几 and 力 as the Sans export draws them (Noto Sans CJK, SIL OFL 1.1); 口 is the small export's
// box. The layout's weights are zero and its bias gives the second operand the right of the cell,
// as the font sets 日 in 旭.
const bias = Buffer.from(new Float32Array([0, 0, 1, 1, 0.45, 0, 1, 1]).buffer).toString('base64')
const source = (extra = {}, modelBias = bias) => {
  const input = {
    ...files,
    'layout.json': JSON.stringify({ ...layout, seeds: [[layout.seeds[0][0], modelBias]] }),
    ...shards('g', Object.entries({ ...parts, ...extra })),
  }
  return createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
}
const right = (/** @type {{ box: number[] }} */ part) => part.box[0] + part.box[2]
const drawn = async (/** @type {string} */ sequence) => (await compose(source(), sequence, { layout: 'composed' })).parts

describe('⿺ inside a larger description', () => {
  for (const sequence of ['⿱口⿺几力', '⿰口⿺几力']) {
    it(`sweeps 几 under 力 in ${sequence}`, async () => {
      const all = await drawn(sequence)
      const swept = all.filter(part => part.origin === 'swept glyph 几')
      const held = all.find(part => part.origin.endsWith('力'))
      // The strokes are pressed to the left and the foot is drawn out, as at the root.
      expect(swept).toHaveLength(2)
      expect(held).toBeDefined()
      if (!held) return
      const [strokes, foot] = swept
      // 力 stands right of the pressed strokes and over the foot, inside the cell 几 was given.
      expect(held.box[0]).toBeGreaterThan(right(strokes) - 40)
      expect(right(foot)).toBeGreaterThan(right(held) - 20)
      expect(held.box[1] + held.box[3]).toBeLessThan(foot.box[1] + foot.box[3])
      expect(foot.box[0]).toBeLessThan(held.box[0])
    })
  }
})

describe('a part held over a swept foot, once the drawing is weighted', () => {
  // The last is mirrored as a whole: the pair is fitted as it stands without the mirror.
  for (const sequence of ['⿱口⿺几力', '⿰口⿺几力', '⿰口⿾⿺几力']) {
    it(`stands clear of the foot in ${sequence}`, async () => {
      const from = source()
      await compose(from, sequence, { layout: 'composed' })
      const composer = new Composer(from.store())
      const all = composer.compose(sequence)
      const swept = all.filter(part => part.origin === 'swept glyph 几'), held = all.filter(part => part.origin.endsWith('力'))
      expect(swept).toHaveLength(2)
      expect(held).toHaveLength(1)
      // No ink of 力 stands within 12 font units of 几's: half of what the refit keeps clear,
      // `ROOM_MARGIN` of a stroke of about 60 units.
      expect(near(swept, held, composer.face, 12, 500)).toBe(false)
    })
  }
})

const edge0 = (/** @type {{ target: number[] }} */ p) => p.target[0] + 0.5 * (p.target[2] - p.target[0])

describe('a glyph swept in a cell smaller than the face', () => {
  // 几 drawn at half size in the lower right quarter: the pieces `sweptPart` answers hold contours
  // already scaled to the cell, so the stroke widths they state are half the glyph's own.
  const glyph = partOf({ ...parts.几.G, w: [80, 76] })
  const [x0, y0, x1, y1] = glyph.box, w = x1 - x0, h = y1 - y0
  const half = placed(glyph, glyph.box, [x0 + w / 2, y0, x1, y0 + h / 2], parts.几.ink, 'glyph 几')
  const whole = placed(glyph, glyph.box, glyph.box.slice(), parts.几.ink, 'glyph 几')

  it('states the stroke widths its scaled contours have', () => {
    for (const [p, scale] of /** @type {const} */ ([[whole, 1], [half, 0.5]])) {
      const swept = sweptPart(p, edge0(p), constants)
      expect(swept).toHaveLength(2)
      for (const piece of swept ?? []) for (const contour of piece.part.contours) {
        expect(contour.width[0]).toBeCloseTo(80 * scale, 5)
        expect(contour.width[1]).toBeCloseTo(76 * scale, 5)
      }
    }
  })
  it('moves both masters of the foot alike, so the heavy stroke keeps its width', () => {
    // The sweeping stroke is the one that reaches the glyph's lower right corner. Point by point,
    // its heavy master stands as far from its light one after the sweep as before it.
    const sweep = glyph.contours.find(contour => {
      const xs = contour.light.filter((_, i) => i % 2 === 0), ys = contour.light.filter((_, i) => i % 2 === 1)
      return Math.max(...xs) > x1 - 0.15 * w && Math.min(...ys) < y0 + 0.25 * h && Math.max(...ys) - Math.min(...ys) > 0.3 * h
    })
    expect(sweep).toBeDefined()
    if (!sweep) return
    for (const [p, scale] of /** @type {const} */ ([[whole, 1], [half, 0.5]])) {
      const swept = sweptPart(p, edge0(p), constants)
      expect(swept).toHaveLength(2)
      if (!swept) continue
      const [contour] = swept[1].part.contours
      for (let i = 0; i < contour.light.length; i += 2)
        expect(contour.heavy[i] - contour.light[i]).toBeCloseTo((sweep.heavy[i] - sweep.light[i]) * scale, 5)
    }
  })
  it('measures a glyph that states no width by the width its ink calls for', () => {
    const plain = partOf({ ...parts.几.G })
    const swept = sweptPart(placed(plain, plain.box, half.target, parts.几.ink, 'glyph 几'), edge0(half), constants)
    const [sx, sy] = [0.5, 0.5]
    const own = [0, 1].map(axis => constants.STEM_CURVE[axis][0] + constants.STEM_CURVE[axis][1] * parts.几.ink / 1000)
    for (const piece of swept ?? []) for (const contour of piece.part.contours) {
      expect(contour.width[0]).toBeCloseTo(own[0] * sx, 5)
      expect(contour.width[1]).toBeCloseTo(own[1] * sy, 5)
    }
    expect(swept).toHaveLength(2)
  })
})

describe('⿺ round a part with no host cut, as the whole description', () => {
  for (const sequence of ['⿺几⿱口力', '⿺几⿰口力']) {
    it(`sweeps 几 under the part in ${sequence}`, async () => {
      const all = await drawn(sequence)
      const swept = all.filter(part => part.origin === 'swept glyph 几')
      const held = all.filter(part => !part.origin.startsWith('swept'))
      expect(swept).toHaveLength(2)
      expect(held).toHaveLength(2)
      const [strokes, foot] = swept
      // Both operands of the part stand right of the pressed strokes and over the foot.
      for (const part of held) {
        expect(part.box[0]).toBeGreaterThan(right(strokes) - 40)
        expect(right(foot)).toBeGreaterThan(right(part) - 20)
        expect(part.box[1] + part.box[3]).toBeLessThan(foot.box[1] + foot.box[3])
      }
    })
  }
  it('sweeps 几 under an empty slot', async () => {
    const drawing = await compose(source(), '⿺几⬚', { layout: 'composed' })
    const swept = drawing.parts.filter(part => part.origin === 'swept glyph 几')
    expect(swept).toHaveLength(2)
    expect(drawing.slots).toHaveLength(1)
    const [strokes, foot] = swept, [slot] = drawing.slots
    expect(slot.box[0]).toBeGreaterThan(right(strokes) - 40)
    expect(right(foot)).toBeGreaterThan(right(slot) - 20)
  })
})

describe('the enclosing form of 木', () => {
  for (const layout of ['composed', 'cells']) {
    it(`holds another operand over its final stroke in ${layout} layout`, async () => {
      const options = { layout, separate: true }
      const result = await compose(source(), '⿺木口', options)
      expect(result.parts[0].origin).toBe(layout === 'cells' ? 'cells 木' : 'enclosing 木')
      expect(result.parts).toHaveLength(2)
      const [wood, inside] = result.parts.map(part => part.box)
      expect(inside[0]).toBeGreaterThan(wood[0] + wood[2] / 3)
      expect(inside[1] + inside[3]).toBeLessThan(wood[1] + wood[3])
      const empty = await compose(source(), '⿺木⬚', options)
      expect(empty.slots).toHaveLength(1)
    })
  }
})

it('keeps the encoded 术 and the dot spelling on their ordinary rendering paths', async () => {
  const extra = { 术: { ...records.木, s: '⿺木丶' }, 丶: records.永, '⿺木丶': { e: '术' } }
  const src = source(extra)
  const ordinary = await compose(src, '术')
  const spelled = await compose(src, '⿺木丶')
  expect(ordinary.d).toBe(spelled.d)
  expect(spelled.parts[0].origin).toBe('glyph 术')
  const separate = await compose(src, '⿺木丶', { separate: true })
  expect(separate.parts.some(p => p.origin === 'enclosing 木')).toBe(false)
})

describe('克 enclosing another component', () => {
  const extra = { 克: records.木, 尅: { G: keDonor, ink: 5000 } }
  for (const layout of ['composed', 'cells']) {
    it(`uses the 尅 frame and clears its foot in ${layout} layout`, async () => {
      const { parts } = await compose(source(extra), '⿺克口', { layout, separate: true })
      expect(parts).toHaveLength(2)
      const [frame, inner] = parts
      expect(frame.d.match(/M/g)).toHaveLength(6)
      expect(inner.box[0]).toBeGreaterThan(frame.box[0] + frame.box[2] / 2)
      expect(inner.box[1] + inner.box[3]).toBeLessThan(frame.box[1] + frame.box[3])
    })
  }
  it('keeps the next column outside a nested 克 enclosure', async () => {
    const { parts } = await compose(source(extra, layout.seeds[0][1]), '⿰⿺克口口', { separate: true })
    const [frame, inside, neighbour] = parts
    expect(neighbour.box[0]).toBeGreaterThan(right(inside))
    expect(neighbour.box[0]).toBeGreaterThan(frame.box[0] + frame.box[2] / 2)
  })

  it('carries the reflection pivot when seating a mirrored operand', async () => {
    const options = { separate: true }
    const plain = await compose(source(extra), '⿺克口', options)
    const mirror = await compose(source(extra), '⿺克⿾口', options)
    // 口 in this fixture is symmetric. Reflection keeps its ink in the same box.
    const ink = p => {
      const points = pathRings(p.d).flat()
      return pointsBox(points)
    }
    const expected = ink(plain.parts[1])
    ink(mirror.parts[1]).forEach((edge, i) => expect(Math.abs(edge - expected[i])).toBeLessThan(1))
  })

})

it('preserves the tall Serif mouth above the hook, including its reflection', async () => {
  const src = source({ 克: records.木, 兡: { G: baiDonor, ink: 5000 } })
  const options = { fontStyle: 'serif', separate: true }
  const cold = await sketch(src, '⿺克口', options)
  for (const seq of ['⿺克口', '⿺克⿾口']) {
    const { parts } = await compose(src, seq, options)
    expect(parts[0].origin).toContain('兡')
    const [l, b, r, t] = pointsBox(pathRings(parts[1].d).flat())
    expect(r - l).toBeGreaterThan(390)
    expect(t - b).toBeGreaterThan(535)
    expect(t - b).toBeLessThan(625)
  }
  expect(await sketch(src, '⿺克口', options)).toEqual(cold)
})

it('preloads the tall 口 donor only for a TW-Kai 克 mouth', () => {
  for (const inner of ['口', ['⿾', '口']]) {
    expect(designedSources(['⿺', '克', inner], 'regular')).toContain('加')
    expect(designedSources(['⿺', '克', inner], 'serif')).not.toContain('加')
  }
  expect(designedSources(['⿺', '克', '日'], 'regular')).not.toContain('加')
})

it('gives both stacked mouths more height than a single mouth in Serif', async () => {
  const src = source({ 克: records.木, 兡: { G: baiDonor, ink: 5000 }, 呂: records.口 })
  const options = { fontStyle: 'serif', separate: true }
  const bounds = async inner => {
    const { parts } = await compose(src, '⿺克' + inner, options)
    const [, bottom, , top] = pointsBox(parts.slice(1).flatMap(p => pathRings(p.d).flat()))
    return { bottom, height: top - bottom }
  }
  const mouth = await bounds('口')
  for (const inner of ['呂', '⿱口口']) {
    const stack = await bounds(inner)
    expect(stack.height).toBeGreaterThan(mouth.height + 30)
    expect(stack.bottom).toBeLessThan(mouth.bottom)
  }
})

it('uses the same Sans 克 opening before and after sibling glyphs load', async () => {
  const src = source({ 日: records.口, 克: records.木, 尅: { G: keDonor, ink: 5000 } })
  const sequence = '⿰口⿺克日'
  const cold = await sketch(src, sequence)
  await compose(src, sequence)
  expect(await sketch(src, sequence)).toEqual(cold)
})

describe('米 and 走 lower-left frames', () => {
  const extra = { 米: records.木, 走: records.木, '𮇇': { G: frameDonors.rice, ink: 5000 }, 趄: { G: frameDonors.walk, ink: 5000 } }
  for (const layout of ['composed', 'cells']) {
    for (const [outer, count] of [['米', 3], ['走', 7]]) {
      it(`keeps the complete ${outer} around a nested mouth in ${layout}`, async () => {
        const { parts } = await compose(source(extra), '⿰口⿺' + outer + '口', { layout, separate: true })
        expect(parts).toHaveLength(3)
        const [, frame, inner] = parts
        expect(frame.d.match(/M/g)).toHaveLength(count)
        expect(inner.box[0]).toBeGreaterThan(frame.box[0])
        expect(right(frame)).toBeGreaterThan(right(inner))
      })
    }
  }

  it('keeps the donor 走 contours when fitting Serif 呂', async () => {
    const src = source({ ...extra, 呂: records.口 })
    const opts = { fontStyle: 'serif', separate: true }
    await compose(src, '⿺走呂', opts)
    const composer = new Composer(src.store(), opts)
    const node = ['⿺', '走', '呂']
    const donor = composer.lowerLeftFrame(node, composer.face)
    const fitted = composer.counterInFrame(node, composer.face, false)
    expect(fitted?.[0].part.contours).toEqual(donor.frame.part.contours)
    expect(fitted[1].target[0]).toBeGreaterThan((donor.frame.target[0] + donor.frame.target[2]) / 2)
  })

  it('partitions the native 𮇇 and 趄 when their leaves are drawn separately', async () => {
    for (const [seq, donor] of [['⿺米日', '𮇇'], ['⿺走且', '趄']]) {
      const { parts } = await compose(source({ ...extra, 日: records.口, 且: records.口 }), seq, { separate: true })
      expect(parts.map(p => p.origin)).toEqual([`glyph ${donor}`, `glyph ${donor}`])
      expect(parts.map(p => p.d.match(/M/g).length)).toEqual(donor === '𮇇' ? [3, 3] : [7, 4])
    }
  })

  it('draws the Fangsong net from the four contours above 正 in 罡', async () => {
    const src = source({ 米: { G: frameDonors.brushRice, ink: 5000 }, 罡: { G: frameDonors.brushNet, ink: 5000 } })
    for (const layout of ['composed', 'cells']) {
      const { parts } = await compose(src, '⿺米罒', { fontStyle: 'fangsong', layout, separate: true })
      expect(parts).toHaveLength(2)
      expect(parts[1].origin).toBe('host 罡')
      expect(parts[1].d.match(/M/g)).toHaveLength(4)
      const [left, bottom, right, top] = pointsBox(pathRings(parts[1].d).flat())
      const [, frameBottom, , frameTop] = pointsBox(pathRings(parts[0].d).flat())
      const height = frameTop - frameBottom
      expect(top - bottom).toBeGreaterThan(height * 0.32)
      expect((top + bottom) / 2).toBeGreaterThan(frameBottom + height * 0.60)
      expect(right - left).toBeGreaterThan(top - bottom)
      expect(right - left).toBeGreaterThan(parts[0].box[2] * 0.53)
    }
  })

  it('uses the same 米 contours around 罒 as around 口', async () => {
    const src = source({ 米: { G: frameDonors.brushRice, ink: 5000 }, 罡: { G: frameDonors.brushNet, ink: 5000 } })
    const options = { fontStyle: 'fangsong', separate: true }
    await compose(src, '⿺米罒', options)
    await compose(src, '⿺米口', options)
    const composer = new Composer(src.store(), options)
    const [netFrame] = composer.compose('⿺米罒')
    const [mouthFrame] = composer.compose('⿺米口')
    expect(netFrame.part.contours).toEqual(mouthFrame.part.contours)
  })

  it('keeps the two Fangsong 米 dots together with the enclosing 木, respecting donor exclusion', async () => {
    const src = source({ 米: { G: frameDonors.brushRice, ink: 5000 } })
    const options = { fontStyle: 'fangsong', separate: true }
    const { parts } = await compose(src, '⿺米口', options)
    expect(parts[0].d.match(/M/g)).toHaveLength(4)
    const composer = new Composer(src.store(), { ...options, exclude: ['木'] })
    expect(composer.enclosureForm('⿺', '米')).toBeNull()
  })
})

describe('爪 lower-left frames', () => {
  for (const [fontStyle, donor, inner, glyph, count] of [
    ['regular', '爮', '包', clawFrames.kai, 3],
    ['fangsong', '爬', '巴', clawFrames.fangsong, 2],
    ['pen-writing', '爬', '巴', clawFrames.kureedo, 2],
  ]) {
    it(`keeps the enclosing strokes of ${donor} together in ${fontStyle}`, async () => {
      const src = source({ 爪: records.木, [inner]: records.口, [donor]: { G: glyph, ink: 5000 } })
      for (const layout of ['composed', 'cells']) {
        const { parts } = await compose(src, '⿰口⿺爪口', { fontStyle, layout, separate: true })
        expect(parts).toHaveLength(3)
        expect(parts[1].d.match(/M/g)).toHaveLength(count)
        const [, frame, mouth] = parts
        expect(mouth.box[0]).toBeGreaterThan(frame.box[0] + frame.box[2] / 2)
        expect(mouth.box[2] * mouth.box[3]).toBeGreaterThan(0.24 * frame.box[2] * frame.box[3])
        expect(mouth.box[1] + mouth.box[3]).toBeGreaterThan(frame.box[1] + 0.70 * frame.box[3])
      }
      const composer = new Composer(src.store(), { fontStyle })
      expect(composer.enclosureForm('⿺', '爪')?.piece.contours).toHaveLength(count)
      const { parts } = await compose(src, '⿺爪' + inner, { fontStyle, separate: true })
      expect(parts.map(p => p.origin)).toEqual([`glyph ${donor}`, `glyph ${donor}`])
      expect(parts[0].d.match(/M/g)).toHaveLength(count)
      expect(new Composer(src.store(), { fontStyle, exclude: [donor] }).enclosureForm('⿺', '爪')).toBeNull()
    })
  }
})

describe('尺 lower-left frames', () => {
  for (const [fontStyle, donor, glyph] of [
    ['fangsong', '咫', rulerFrames.fangsong],
    ['regular', '𣥉', rulerFrames.kai],
  ]) {
    it(`fits a nested 日 above the 尺 from ${donor}`, async () => {
      const src = source({ 尺: records.木, 日: records.口, [donor]: { G: glyph, ink: 5000 } })
      for (const layout of ['composed', 'cells']) {
        const { parts } = await compose(src, '⿰口⿺尺日', { fontStyle, layout, separate: true })
        const [, frame, day] = parts
        expect(frame.origin).toBe(`host ${donor}`)
        expect(day.box[2]).toBeGreaterThan(frame.box[2] * 0.35)
        expect(day.box[3]).toBeGreaterThan(frame.box[3] * 0.55)
      }
      const excluded = new Composer(src.store(), { fontStyle, exclude: [donor] })
      expect(excluded.enclosureForm('⿺', '尺')).toBeNull()
    })
  }
})

it('keeps 𣬰 as a whole and uses the 毡 enclosure when its operands are separate', async () => {
  const description = '⿺毛日'
  const src = source({
    毛: records.木, 日: records.口, 毡: { G: maoDonor, ink: 5000 },
    𣬰: { ...records.木, s: description }, [description]: { e: '𣬰' },
  })
  const native = await compose(src, description, { layout: 'composed' })
  expect(native.parts.map(p => p.origin)).toEqual(['glyph 𣬰'])
  for (const layout of ['composed', 'cells']) {
    const { parts } = await compose(src, description, { layout, separate: true })
    expect(parts.map(p => p.origin)).toEqual(['host 毡', 'glyph 日'])
    expect(parts[1].box[3]).toBeGreaterThan(parts[0].box[3] * 0.55)
  }
  const excluded = await compose(src, description, { layout: 'composed', separate: true, exclude: ['毡'] })
  expect(excluded.parts.some(p => p.origin === 'host 毡')).toBe(false)
})

it('keeps 𡯙 as a whole and uses the 尪 enclosure when its operands are separate', async () => {
  const description = '⿺尢日'
  const src = source({
    尢: records.木, 日: records.口, 尪: { G: wangDonor, ink: 5000 },
    𡯙: { ...records.木, s: description }, [description]: { e: '𡯙' },
  })
  const native = await compose(src, description, { layout: 'composed' })
  expect(native.parts.map(p => p.origin)).toEqual(['glyph 𡯙'])
  for (const layout of ['composed', 'cells']) {
    const { parts } = await compose(src, description, { layout, separate: true })
    expect(parts.map(p => p.origin)).toEqual(['host 尪', 'glyph 日'])
    expect(parts[1].box[3]).toBeGreaterThan(parts[0].box[3] * 0.55)
  }
  const excluded = await compose(src, description, { layout: 'composed', separate: true, exclude: ['尪'] })
  expect(excluded.parts.some(p => p.origin === 'host 尪')).toBe(false)
})

it('assembles the Misato shrine character from standard 艹, 夌/菱 top, and enclosing 夂 donors across five CJK faces', async () => {
  const sequence = '⿱艹⿺夌玉'
  for (const [fontStyle, faceDonors] of Object.entries(shrineDonors)) {
    const topHost = fontStyle === 'fangsong' ? '菱' : '夌'
    const footHost = fontStyle === 'fangsong' ? '处' : '麵'
    const expectedCap = fontStyle === 'regular' ? 'TW-Kai: 艹' : 'glyph 艹'
    const expectedBody = `enclosing 夌 from ${topHost}+${footHost}`
    const baseDonors = fontStyle === 'fangsong' ? { ...faceDonors, 夌: records.木 } : faceDonors
    const src = source(baseDonors)
    for (const layout of ['composed', 'cells']) {
      const { parts } = await compose(src, sequence, { layout, separate: true, fontStyle })
      expect(parts.map(p => p.origin), `${fontStyle}/${layout}`).toEqual([expectedCap, expectedBody, 'glyph 玉'])
      if (layout === 'cells') expect(parts.map(p => p.leaf), `${fontStyle}/cells leaves`).toEqual([0, 1, 2])
      const [, body, jade] = parts
      expect(jade.box[2], `${fontStyle}/${layout}`).toBeGreaterThan(body.box[2] * 0.40)
      expect(right(jade), `${fontStyle}/${layout}`).toBeLessThanOrEqual(right(body))
      const masks = parts.map(p => pathMask(p.d, 256))
      expect(masks[0].some((ink, i) => ink && masks[1][i]), `${fontStyle}/${layout} cap-body`).toBe(false)
      expect(masks[0].some((ink, i) => ink && masks[2][i]), `${fontStyle}/${layout} cap-jade`).toBe(false)
      expect(masks[1].some((ink, i) => ink && masks[2][i]), `${fontStyle}/${layout} body-jade`).toBe(false)
    }
    const rawParts = new Composer(src.store(), { fontStyle, separate: true }).compose(sequence)
    expect(Boolean(rawParts[2].fixed), `${fontStyle} jade fixed`).toBe(fontStyle !== 'sans' && fontStyle !== 'serif')
    for (const [nestedSeq, sliceStart] of /** @type {const} */ ([[`⿰口${sequence}`, 1], [`⿱${sequence}口`, 0]])) {
      for (const layout of ['composed', 'cells']) {
        const nested = await compose(src, nestedSeq, { layout, separate: true, fontStyle })
        const shrineParts = nested.parts.slice(sliceStart, sliceStart + 3)
        expect(shrineParts.map(p => p.origin), `${fontStyle} ${nestedSeq}/${layout}`).toEqual([expectedCap, expectedBody, 'glyph 玉'])
        const masks = shrineParts.map(p => pathMask(p.d, 256))
        expect(masks[0].some((ink, i) => ink && masks[1][i]), `${fontStyle} ${nestedSeq}/${layout} cap-body`).toBe(false)
        expect(masks[0].some((ink, i) => ink && masks[2][i]), `${fontStyle} ${nestedSeq}/${layout} cap-jade`).toBe(false)
        expect(masks[1].some((ink, i) => ink && masks[2][i]), `${fontStyle} ${nestedSeq}/${layout} body-jade`).toBe(false)
        if (sliceStart === 1) {
          expect(Math.min(...shrineParts.map(p => p.box[0])), `${fontStyle} ${nestedSeq}/${layout}`).toBeGreaterThan(nested.parts[0].box[0])
        } else {
          expect(Math.max(...shrineParts.map(p => p.box[1] + p.box[3])), `${fontStyle} ${nestedSeq}/${layout}`).toBeLessThan(nested.parts[3].box[1] + nested.parts[3].box[3])
        }
      }
    }
    for (const excluded of new Set([topHost, footHost, '艹', '夌', '玉'])) {
      const fallback = await compose(src, sequence, { exclude: [excluded], fontStyle })
      expect(fallback.origins, `${fontStyle} exclude ${excluded}`).not.toContain(expectedBody)
    }
    const foreignJade = { ...faceDonors.玉, G: { ...faceDonors.玉.G, f: 1 } }
    const foreignRes = await compose(source({ ...baseDonors, 玉: foreignJade }), sequence, { fontStyle })
    expect(foreignRes.origins, `${fontStyle} foreign jade`).not.toContain(expectedBody)
    const alteredFoot = { ...faceDonors[footHost], G: { ...faceDonors[footHost].G, p: [...faceDonors[footHost].G.p].reverse() } }
    const altered = await compose(source({ ...baseDonors, [footHost]: alteredFoot }), sequence, { fontStyle })
    expect(altered.origins, `${fontStyle} altered foot`).not.toContain(expectedBody)
  }
})

it('gives both tiers of the source 393 metric unit their full height above 克', async () => {
  const src = source({ 克: records.木, 兡: { G: baiDonor, ink: 5000 }, 从: records.口, 韭: records.木 })
  for (const layout of ['composed', 'cells']) {
    const { parts } = await compose(src, '⿺克⿱从韭', { fontStyle: 'serif', layout, separate: true })
    expect(parts).toHaveLength(3)
    const [ke, top, bottom] = parts.map(p => p.box)
    expect(top[1]).toBeLessThan(bottom[1])
    expect(bottom[1] + bottom[3] - top[1]).toBeGreaterThan(ke[3] * 0.75)
  }
})

it('draws the complete native 意 inside the Fangsong metric 克', async () => {
  const src = source({ 克: records.木, 尅: { G: keDonor, ink: 5000 }, 意: records.口 })
  for (const layout of ['composed', 'cells']) {
    const { parts } = await compose(src, '⿺克意', { fontStyle: 'fangsong', layout, separate: true })
    expect(parts).toHaveLength(2)
    expect(parts[1].origin).toBe('glyph 意')
    expect(parts[1].d.match(/M/g)).toHaveLength(records.口.G.p.length)
  }
})

describe('a turned stroke swept round another part', () => {
  // 乙 as one outline: a bar, a stroke falling from its right end to the lower left, and a foot
  // with a hook rising from its end.
  const outline = [100, 800, 900, 800, 320, 100, 800, 100, 800, 250, 900, 250, 900, 0, 100, 0, 100, 120, 680, 700, 100, 700]
  const int16 = (/** @type {number[]} */ values) => Buffer.from(Int16Array.from(values).buffer).toString('base64')
  const glyph = partOf({ v: 1, b: [100, 0, 900, 800], p: [['M' + 'L'.repeat(outline.length / 2 - 1), int16(outline.map(v => v * 4)), int16(outline.map(() => 0))]] })
  const whole = placed(glyph, glyph.box, glyph.box.slice(), 3200, 'glyph 乙')

  it('presses the head to the edge and leaves the foot and its hook', () => {
    const swept = sweptPart(whole, 500, constants)
    expect(swept).toHaveLength(1)
    if (!swept) return
    expect(swept[0].origin).toBe('swept glyph 乙')
    const [contour] = swept[0].part.contours, [before] = glyph.contours
    const xs = (/** @type {(y: number) => boolean} */ keep) => [...contour.light].filter((_, i) => i % 2 === 0 && keep(contour.light[i + 1]))
    // The head is read on sampled rows, so it lands within a few units of the edge.
    expect(Math.abs(Math.max(...xs(y => y >= 700)) - 500)).toBeLessThan(8)
    // The foot, and the hook at its end, stand where the glyph draws them.
    for (let i = 0; i < before.light.length; i += 2)
      if (before.light[i + 1] <= 100 || before.light[i] >= 800 && before.light[i + 1] <= 250) expect(contour.light[i]).toBeCloseTo(before.light[i], 5)
  })
  it('leaves a head already left of the edge', () => {
    expect(sweptPart(whole, 950, constants)).toBeNull()
  })
})
