import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { pathMask } from '../src/geometry.js'
import { files, shards } from './fixtures/small-export.js'
// Noto Sans CJK JP 2.004 and Zhuque Fangsong, SIL Open Font License 1.1.
import records from './fixtures/rcc-gold.json' with { type: 'json' }

const ids = '⿰金⿳冖丷⿸⿻[1:]丿口乚'
const touches = (a, b) => a.some((ink, i) => ink && b[i])

for (const [fontStyle, glyphs] of Object.entries(records)) {
  it(`joins the diagonal and lower hook to the box in ${fontStyle}`, async () => {
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
      const crest = parts[1].box[1], shoulder = parts[3].box[1]
      const dabTop = dabs.map(mask => Math.floor(mask.findIndex(Boolean) / 384) * 1000 / 384)
      expect(dabTop[1]).toBeLessThan(crest + (shoulder - crest) * .42)
      expect(dabTop[1]).toBeLessThan(dabTop[0])
      expect(touches(crown, mouth)).toBe(true)
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
      for (const excluded of [ids, '鋭', '兎', '冞', '⿳冖丷⿸⿻[1:]丿口乚', '⿸⿻[1:]丿口乚', '⿻[1:]丿口']) {
        expect((await compose(source, ids, { fontStyle, exclude: [excluded] })).origins).not.toContain('R+07DF 金')
      }
    }
    expect(cold).toHaveLength(6)
    expect(await sketch(source, ids, { fontStyle })).toEqual(cold)
  })
}
