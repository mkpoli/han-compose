import { describe, expect, it } from 'bun:test'
import { gzipSync } from 'node:zlib'
import { Composer } from '../src/compose.js'
import { createSource } from '../src/loader.js'
import { commands, makePart, mapped, placed } from '../src/geometry.js'
import { character, constants, files } from './fixtures/small-export.js'

// 麭 as boxes: the upper part of its 麥 (來), the sweep under it, and the 包 the sweep holds.
const UPPER = [100, 500, 500, 800], SWEEP = [100, 0, 900, 120], HELD = [550, 200, 900, 800]
const PLACE = '⿺0'
/** A host entry of the export's list for 麥 in ⿺'s enclosing place, read as `loader.js` reads it. */
const entry = (h, r, cut) => ({ h, r, i: 0, op: '⿺', ok: ['包'], si: 400, d: 0, v: 1, j: 1,
  ...(cut ? { k: [0, 1], b: [100, 0, 900, 800], fr: [100, 0, 900, 800], wh: 1, g: 0, kv: 1, c: true } : {}) })
/** The kin table `export-web --add kin` writes: 麥 and 麦 over 夊 in ⿺'s enclosing place, and 麭's
 *  麥 cut into its upper part and its sweep. */
const table = (count = 3) => ({
  lower: { [PLACE]: { 夊: [['麦', 2], ['麥', count]] } },
  cuts: { [`${PLACE}\t麥`]: { 麭: [[0], [1]], 麪: null } },
  upper: { 𡕤: ['𤽎', [1]] },
  KIN_OUTER_HOSTS: 3, KIN_TRIED: 16,
})
const records = {
  麭: character('麭', [UPPER, SWEEP, HELD]),
  麥: { ...character('麥', [UPPER, SWEEP]), s: '⿱來夊' },
  𡗗: character('𡗗', [[0, 0, 400, 300]]),
  𡕤: { ...character('𡕤', [[0, 300, 400, 600], [0, 0, 800, 100]]), s: '⿱𡗗夊' },
  𤽎: character('𤽎', [[0, 0, 100, 100], [300, 200, 500, 500]]),
  面: character('面', [[0, 0, 600, 800]]),
}
/** A store over these records, the host list of 麥 and, unless `kin` is null, a kin table. */
const store = ({ kin = table(), hosts = [entry('麭', 0, true), entry('麪', 1, false), entry('麩', 2, false)] } = {}) => ({
  manifest: { constants, spelled: [] }, layout: null,
  rec: key => records[key] ?? null,
  hosts: (key, place) => key === '麥' && place === PLACE ? hosts : [],
  places: () => [],
  ...(kin ? { kin: () => kin } : {}),
})
/** A box drawn as one contour, y up. */
const box = ([x0, y0, x1, y1]) => makePart([{ ops: commands('MLLL'), light: Float64Array.from([x0, y0, x0, y1, x1, y1, x1, y0]),
  heavy: Float64Array.from([x0, y0, x0, y1, x1, y1, x1, y0]), width: null }])
const at = (part, target) => placed(part, part.box, target, 100, 'part')

describe('an enclosing part no host draws in its place', () => {
  it('takes as its kin the character over the same lower part with most hosts there', () => {
    const c = new Composer(store())
    expect(c.kin('⿺', ['⿱', '𡗗', '夊'])).toEqual({ char: '麥', own: ['⿱', '𡗗', '夊'] })
    // A character written over that part is read from its sequence.
    expect(c.kin('⿺', '𡕤')).toEqual({ char: '麥', own: ['⿱', '𡗗', '夊'] })
    // A described outer only under ⿺, where a stack leaves the held part no room.
    expect(c.kin('⿸', ['⿱', '𡗗', '夊'])).toBeNull()
    expect(c.kin('⿺', ['⿰', '𡗗', '夊'])).toBeNull()
  })

  it('counts a kin\'s hosts again without those a drawing excludes', () => {
    expect(new Composer(store(), { exclude: ['麩'] }).kin('⿺', ['⿱', '𡗗', '夊'])).toBeNull()
    expect(new Composer(store(), { exclude: ['麻'] }).kin('⿺', ['⿱', '𡗗', '夊'])?.char).toBe('麥')
  })

  it('is drawn as before from an export without a kin table', () => {
    expect(new Composer(store({ kin: null })).kin('⿺', ['⿱', '𡗗', '夊'])).toBeNull()
  })

  it('is drawn as its kin\'s lower piece cut from a host, its upper part in the kin\'s upper room', () => {
    const c = new Composer(store()), region = [0, 0, 1000, 1000]
    const drawn = c.kinOuter('⿺', ['⿱', '𡗗', '夊'], c.kin('⿺', ['⿱', '𡗗', '夊']), '面', region, [550, 0, 1000, 900])
    expect(drawn.map(p => p.origin)).toEqual(['kin 麭', 'glyph 𡗗'])
    // A separated drawing keeps reading order.
    const separate = new Composer(store(), { separate: true })
    expect(separate.kinOuter('⿺', ['⿱', '𡗗', '夊'], separate.kin('⿺', ['⿱', '𡗗', '夊']), '面', region, [550, 0, 1000, 900]).map(p => p.origin))
      .toEqual(['glyph 𡗗', 'kin 麭'])
    const frame = [100, 0, 900, 800]
    expect(drawn[0].target).toEqual(mapped(SWEEP, frame, region))
    expect(drawn[0].part.kv).toBe(true)
    // 𡗗 stands within the room 來 takes in 麭's 麥.
    const room = mapped(UPPER, frame, region), upper = drawn[1].target
    expect(upper[0]).toBeGreaterThanOrEqual(room[0] - 1e-6)
    expect(upper[2]).toBeLessThanOrEqual(room[2] + 1e-6)
    expect(upper[3]).toBeLessThanOrEqual(room[3] + 1e-6)
  })

  it('takes an enclosing character\'s upper part as a character holding it on the left draws it', () => {
    const c = new Composer(store())
    const drawn = c.kinOuter('⿺', '𡕤', c.kin('⿺', '𡕤'), '面', [0, 0, 1000, 1000], [550, 0, 1000, 900])
    expect(drawn.map(p => p.origin)).toEqual(['kin 麭', 'kin 𤽎'])
    expect(drawn[1].part.box).toEqual([300, 200, 500, 500])
    // Short of the enclosed part's box by the gap neighbours keep.
    expect(drawn[1].target[2]).toBeLessThanOrEqual(550 - constants.FACING[0] + 1e-6)
    // A drawing that excludes the source draws the upper operand itself.
    const without = new Composer(store(), { exclude: ['𤽎'] })
    expect(without.kinOuter('⿺', '𡕤', without.kin('⿺', '𡕤'), '面', [0, 0, 1000, 1000], [550, 0, 1000, 900]).map(p => p.origin))
      .toEqual(['kin 麭', 'glyph 𡗗'])
  })

  it('takes the listed cut whose split stands nearest the middle when none is ranked', () => {
    const split = { ...table() }
    split.cuts[`${PLACE}\t麥`] = { 麩: [[0], [1]], 麪: [[0], [1]], 麭: [[0], [1]] }
    const splitRecords = {
      麩: character('麩', [[0, 750, 1000, 900], [0, 0, 1000, 900]]),
      麪: character('麪', [[0, 500, 1000, 900], [0, 0, 1000, 900]]),
      麭: character('麭', [[0, 450, 1000, 900], [0, 0, 1000, 900]]),
      麥: records.麥, 𡗗: records['𡗗'], 面: records.面,
    }
    const c = new Composer({ ...store({ kin: split }), rec: key => splitRecords[key] ?? null })
    c.ranked = () => []
    const drawn = c.kinOuter('⿺', ['⿱', '𡗗', '夂'], c.kin('⿺', ['⿱', '𡗗', '夊']), '面', [0, 0, 1000, 900], [500, 0, 1000, 500])
    // 麩's upper box is 150 high in a 900-unit frame; 麪's 400 and 麭's 450 stand either side of it.
    expect(drawn[0].origin).toBe('kin 麪')
  })

  it('takes the even split when two cuts tie on the midpoint', () => {
    const two = { ...table() }
    two.cuts[`${PLACE}\t麥`] = { 麩: [[0], [1]], 麪: [[0], [1]] }
    const twoRecords = {
      麩: character('麩', [[0, 180, 1000, 900], [0, 0, 1000, 100]]),
      麪: character('麪', [[0, 360, 1000, 900], [0, 0, 1000, 100]]),
      麥: records.麥, 𡗗: records['𡗗'], 面: records.面,
    }
    const c = new Composer({ ...store({ kin: two }), rec: key => twoRecords[key] ?? null })
    c.ranked = () => []
    const drawn = c.kinOuter('⿺', ['⿱', '𡗗', '夂'], c.kin('⿺', ['⿱', '𡗗', '夊']), '面', [0, 0, 1000, 900], [500, 0, 1000, 500])
    expect(drawn[0].origin).toBe('kin 麪')
  })

  it('keeps the upper room clear of the enclosed part when the cut spans only the outer half', () => {
    const half = { ...table() }
    half.cuts[`${PLACE}\t麥`] = { 麩: [[0], [1]] }
    const halfRecords = {
      麩: character('麩', [[0, 500, 500, 900], [0, 0, 500, 500]]),
      麥: records.麥, 𡗗: records['𡗗'], 面: records.面,
    }
    const c = new Composer({ ...store({ kin: half }), rec: key => halfRecords[key] ?? null })
    const drawn = c.kinOuter('⿺', ['⿱', '𡗗', '夂'], c.kin('⿺', ['⿱', '𡗗', '夊']), '面', [0, 0, 1000, 900], [500, 0, 1000, 500])
    // The cut's own upper piece (來) is placed, not the operand's glyph, which this face draws as a different form.
    expect(drawn.map(p => p.origin)).toEqual(['kin 麩', 'kin 麩 upper'])
    expect(drawn[1].target[2]).toBeLessThanOrEqual(500 - constants.FACING[0] + 1e-6)
  })

  it('is not drawn from a host whose kin KanjiVG does not cut', () => {
    const kin = table()
    kin.cuts[`${PLACE}\t麥`].麭 = null
    const c = new Composer(store({ kin }))
    expect(c.kinOuter('⿺', ['⿱', '𡗗', '夊'], c.kin('⿺', ['⿱', '𡗗', '夊']), '面', [0, 0, 1000, 1000], [550, 0, 1000, 900])).toBeNull()
  })
})

describe('an upper part in a kin\'s room', () => {
  const lower = [at(box([0, 0, 100, 100]), [0, 0, 100, 300])]
  it('is lowered to stand as close to the sweep as the kin\'s own upper part', () => {
    const c = new Composer(store())
    const upper = [at(box([0, 0, 100, 200]), [0, 500, 100, 700])], [part] = upper
    c.settle(upper, at(box([0, 0, 100, 100]), [0, 420, 100, 700]), lower)
    expect(upper[0]).toBe(part)
    expect(part.target[3]).toBe(700)
    expect(part.target[1]).toBeCloseTo(420, -1)
  })
  it('keeps its place where lowering would stretch it past STRETCH, or where it already stands as close', () => {
    const c = new Composer(store())
    const upper = [at(box([0, 0, 100, 200]), [0, 500, 100, 700])]
    c.settle(upper, at(box([0, 0, 100, 100]), [0, 320, 100, 700]), lower)
    expect(upper[0].target).toEqual([0, 500, 100, 700])
    c.settle(upper, at(box([0, 0, 100, 100]), [0, 560, 100, 700]), lower)
    expect(upper[0].target).toEqual([0, 500, 100, 700])
  })
})

describe('the kin table', () => {
  const kinFiles = kin => ({ ...files, 'manifest.json': JSON.stringify({ ...JSON.parse(files['manifest.json']),
    files: { ...JSON.parse(files['manifest.json']).files, ...(kin ? { kin: { path: 'kin.json' } } : {}) } }),
  ...(kin ? { 'kin.json': gzipSync(JSON.stringify(kin)) } : {}) })
  const sourceOf = held => {
    const asked = []
    const source = createSource(async name => {
      asked.push(name)
      const data = held[name]
      return data === undefined ? null : typeof data === 'string' ? new TextEncoder().encode(data).buffer : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    })
    return { source, asked }
  }
  it('loads only when a drawing asks for it', async () => {
    const { source, asked } = sourceOf(kinFiles(table()))
    await source.ready()
    const first = source.store()
    expect(asked).not.toContain('kin.json')
    expect(first.kin()).toBeNull()
    expect([...first.missing]).toEqual(['kin.json'])
    await source.load(first.missing)
    expect(source.store().kin()).toEqual(table())
  })
  it('is nothing to ask for in an export written without it', async () => {
    const { source } = sourceOf(kinFiles(null))
    await source.ready()
    const store = source.store()
    expect(store.kin()).toBeNull()
    expect(store.missing.size).toBe(0)
  })
})
