import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { contourSections, cutContours, partOf, pathMask, pathRings, pointsBox, rings } from '../src/geometry.js'
import { files, shards } from './fixtures/small-export.js'
// Noto Sans CJK JP 2.004 and Zhuque Fangsong, SIL Open Font License 1.1.
import records from './fixtures/rcc-gold.json' with { type: 'json' }

const ids = '⿰金⿳冖丷⿸⿻[1:]丿口乚'
const dotContours = {
  sans: [0, 1], serif: [2, 3], regular: [4, 3],
  fangsong: [4, [0, 18, 31]], 'pen-writing': [2, [1, 16, 21]],
}
const aspect = ([left, bottom, right, top]) => (top - bottom) / (right - left)
const touches = (a, b) => a.some((ink, i) => ink && b[i])

for (const [fontStyle, glyphs] of Object.entries(records)) {
  it(`places the native right-column roof above the crossed box in ${fontStyle}`, async () => {
    const data = { ...files, ...shards('g', Object.entries(glyphs)) }
    const source = createSource(async name => data[name] === undefined ? null : new Uint8Array(Buffer.from(data[name])).buffer)
    const cold = await sketch(source, ids, { fontStyle })
    for (const separate of [false, true]) {
      const { parts } = await compose(source, ids, { fontStyle, separate })
      expect(parts.map(p => p.origin)).toEqual([...'金冖丷丿口乚'].map(ch => 'R+07DF ' + ch))
      if (separate) expect(parts.map(p => p.leaf)).toEqual([0, 1, 2, 3, 4, 5])
      const [gold, crown, dots, slash, mouth, hook] = parts.map(p => pathMask(p.d, 384))
      const dabs = parts[2].d.match(/M[^M]+/g).map(d => pathMask(d, 384))
      expect(dabs).toHaveLength(2)
      expect(touches(dabs[0], dabs[1])).toBe(false)
      expect(touches(dabs[0], mouth)).toBe(false)
      expect(touches(dabs[1], slash)).toBe(true)
      const sharp = partOf(glyphs['鋭'].G), drawn = pathRings(parts[2].d, 24).map(pointsBox)
      for (const [i, k] of dotContours[fontStyle].entries()) {
        const contour = Array.isArray(k) ? contourSections(sharp.contours, k) : sharp.contours[k]
        const native = pointsBox(rings([contour], [contour.light], 24)[0])
        expect(Math.abs(aspect(drawn[i]) / aspect(native) - 1)).toBeLessThan(.05)
      }
      const donor = fontStyle === 'fangsong' ? '暝' : '䤟'
      const indices = fontStyle === 'serif' ? [8, 9, 10] : fontStyle === 'fangsong' ? [7] : [0]
      const [l, b, r, t] = cutContours(partOf(glyphs[donor].G), indices).box
      const [, , w, h] = parts[1].box
      expect(Math.abs(h / w - (t - b) / (r - l))).toBeLessThan(.035)
      expect(touches(crown, mouth)).toBe(false)
      expect(touches(crown, dots)).toBe(false)
      expect(touches(dots, slash)).toBe(true)
      expect(touches(slash, mouth)).toBe(true)
      expect(touches(hook, mouth)).toBe(true)
      expect(touches(gold, mouth)).toBe(false)
      const box = parts[4].box
      const y = Math.floor((box[1] + box[3] / 2) * 384 / 1000)
      let runs = 0, inside = false
      for (let x = 0; x < 384; x++) {
        const i = y * 384 + x, ink = Boolean(mouth[i] || slash[i])
        if (ink && !inside) runs++
        inside = ink
      }
      expect(runs).toBe(3) // Left wall, diagonal and right wall, with space between them.
    }
    const alt = '⿰金⿳冖丷⿻[1:]⿸丿乚口'
    const a = await compose(source, ids, { fontStyle, separate: true })
    const b = await compose(source, alt, { fontStyle, separate: true })
    expect(b.d).toEqual(a.d)
    expect(b.parts.map(p => p.leaf)).toEqual([0, 1, 2, 3, 5, 4])
    expect((await sketch(source, alt, { fontStyle })).map(p => p.box))
      .toEqual([0, 1, 2, 3, 5, 4].map(i => cold[i].box))
    if (fontStyle === 'sans') {
      for (const excluded of [ids, '鋭', '兎', '䤟', '⿳冖丷⿸⿻[1:]丿口乚', '⿸⿻[1:]丿口乚', '⿻[1:]丿口']) {
        expect((await compose(source, ids, { fontStyle, exclude: [excluded] })).origins).not.toContain('R+07DF 金')
      }
    }
    expect(cold).toHaveLength(6)
    expect(await sketch(source, ids, { fontStyle })).toEqual(cold)
  })
}
