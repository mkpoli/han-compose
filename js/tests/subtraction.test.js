// ㇯ takes a part out of a character. Where the export holds the character's description and its
// cuts, what is left is the character's own outlines (`Composer.remainder`).
import { describe, expect, it } from 'bun:test'
import { gzipSync } from 'node:zlib'
import { compose, createSource } from '../src/loader.js'
import { character, files, identityOf, records, shardOf } from './fixtures/small-export.js'

/** The fixture export with `added` records and host lists for `hosts` (`[key, place, entries]`). */
const sourceOf = (added, hosts = []) => {
  const extra = new Map()
  const put = (folder, text, value) => {
    const name = shardOf(folder, text)
    const file = extra.has(name) ? JSON.parse(extra.get(name)) : {}
    file[text] = value
    extra.set(name, JSON.stringify(file))
  }
  for (const [key, record] of Object.entries(added)) put('g', key, record)
  for (const [key, place, entries] of hosts) put('p', `${place}\t${key}`, entries)
  const identity = identityOf(Object.entries(added))
  return createSource(async name => {
    const body = name === 'identity.json' ? identity : extra.has(name) ? gzipSync(extra.get(name)) : files[name]
    return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
  })
}

// 杏 as 木 over 口: two outlines above, four below, each a box.
const TREE = [[100, 500, 900, 560], [470, 420, 530, 820]]
const MOUTH = [[200, -40, 800, 20], [200, 300, 800, 360], [200, -40, 260, 360], [740, -40, 800, 360]]
const FACE = [100, -40, 900, 820], UPPER = [100, 420, 900, 820], LOWER = [200, -40, 800, 360]
const cut = (host, contours, box, frame = FACE) => ({ h: host, r: 0, c: { k: contours, b: box, fr: frame, wh: [0, 0, 1000, 1000], g: 0 } })
const base = {
  木: { ...records.木, P: ['T', 'L'] },
  口: { ...records.口, P: ['B'] },
  永: records.永,
  三: records.三,
  杏: { ...character('杏', [...TREE, ...MOUTH]), s: '⿱木口', P: ['R'] },
  // 椛 as 木 beside 杏: its right half is 杏 at half the width.
  椛: { ...character('椛', [[60, 300, 440, 360], [220, -40, 280, 820],
    [520, 500, 940, 560], [700, 420, 760, 820], [560, -40, 900, 20], [560, 300, 900, 360], [560, -40, 620, 360], [840, -40, 900, 360]]), s: '⿰木杏' },
}
const cuts = [
  ['木', 'T', [cut('杏', [0, 1], UPPER)]],
  ['口', 'B', [cut('杏', [2, 3, 4, 5], LOWER)]],
  ['木', 'L', [cut('椛', [0, 1], [60, -40, 440, 820], [60, -40, 940, 820])]],
  ['杏', 'R', [cut('椛', [2, 3, 4, 5, 6, 7], [520, -40, 940, 820], [60, -40, 940, 820])]],
]
/** The drawn parts' union as [left, top, right, bottom], y down. */
const span = parts => [Math.min(...parts.map(p => p.box[0])), Math.min(...parts.map(p => p.box[1])),
  Math.max(...parts.map(p => p.box[0] + p.box[2])), Math.max(...parts.map(p => p.box[1] + p.box[3]))]

describe('a part taken out of a character', () => {
  it('leaves the outlines the character itself draws for the rest, where they lie', async () => {
    const whole = await compose(sourceOf(base, cuts), '杏', { layout: 'composed' })
    const drawn = await compose(sourceOf(base, cuts), '㇯杏口', { layout: 'composed' })
    expect(drawn.parts.map(part => part.origin)).toEqual(['host 杏'])
    expect(drawn.cut).toBe('')
    expect(drawn.approximate).not.toContain('㇯')
    // The upper two boxes of 杏, not moved or resized: the same top and sides, and nothing below.
    const [left, top, right, bottom] = span(drawn.parts), all = span(whole.parts)
    expect([left, top, right]).toEqual([all[0], all[1], all[2]])
    expect(bottom).toBeLessThan((all[1] + all[3]) / 2 + 10)
    // Taking the upper part leaves the lower one in its place.
    const lower = span((await compose(sourceOf(base, cuts), '㇯杏木', { layout: 'composed' })).parts)
    expect(lower[3]).toBe(all[3])
    expect(lower[1]).toBeGreaterThan((all[1] + all[3]) / 2 - 10)
  })

  it('takes a part out of an operand in the operand\'s place', async () => {
    const drawn = await compose(sourceOf(base, cuts), '㇯椛口', { layout: 'composed' })
    // 木 from 椛 itself, and the 木 of 杏 where 杏 stands in 椛.
    expect(drawn.parts.map(part => part.origin)).toEqual(['host 椛', 'host 杏'])
    expect(drawn.approximate).not.toContain('㇯')
    const [beside, above] = drawn.parts.map(part => span([part]))
    expect(above[0]).toBeGreaterThan(beside[2])
    expect(above[3]).toBeLessThan(beside[3] - 200)
  })

  it('takes several parts out, one after another', async () => {
    const drawn = await compose(sourceOf(base, cuts), '㇯㇯椛口木', { layout: 'composed' })
    // The first 木 is the one beside; what stays is the 木 of 杏.
    expect(drawn.parts.map(part => part.origin)).toEqual(['host 杏'])
    expect(drawn.approximate).not.toContain('㇯')
  })

  it('gives each of two like parts its own cut', async () => {
    // 森 as 木 over 口 beside 木 over 三: with 口 and 三 gone, the two 木 stay, each in its half.
    const twice = { ...base, 森: { ...character('森', [[60, 500, 440, 560], [220, 420, 280, 820], [100, -40, 400, 360],
      [560, 500, 940, 560], [720, 420, 780, 820], [600, -40, 900, 360]]), s: '⿰⿱木口⿱木三' } }
    const whole = [60, -40, 940, 820]
    const both = [...cuts, ['木', 'T', [cut('杏', [0, 1], UPPER), cut('森', [0, 1], [60, 420, 440, 820], whole), cut('森', [3, 4], [560, 420, 940, 820], whole)]]]
      .filter(([key, place], i, all) => !(key === '木' && place === 'T' && i < all.length - 1))
    const drawn = await compose(sourceOf(twice, both), '㇯㇯森口三', { layout: 'composed' })
    expect(drawn.parts.map(part => part.origin)).toEqual(['host 森', 'host 森'])
    const [first, second] = drawn.parts.map(part => span([part]))
    expect(second[0]).toBeGreaterThan(first[2])
  })

  it('composes what is left of the description where the export has no cut of it', async () => {
    const drawn = await compose(sourceOf(base, cuts.filter(([key]) => key !== '木')), '㇯杏口', { layout: 'composed' })
    expect(drawn.parts.map(part => part.origin)).not.toContain('host 杏')
    expect(drawn.parts.length).toBeGreaterThan(0)
    expect(drawn.cut).toBe('')
    expect(drawn.slots).toEqual([])
    expect(drawn.approximate).not.toContain('㇯')
  })

  it('cuts the part out of a character that has no description, and says so', async () => {
    const drawn = await compose(sourceOf(base, cuts), '㇯永口', { layout: 'composed' })
    expect(drawn.cut).not.toBe('')
    expect(drawn.approximate).toContain('㇯')
  })

  it('cuts the part out of a character whose description does not hold it', async () => {
    const drawn = await compose(sourceOf(base, cuts), '㇯杏三', { layout: 'composed' })
    expect(drawn.cut).not.toBe('')
    expect(drawn.approximate).toContain('㇯')
  })
})
