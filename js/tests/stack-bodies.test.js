// A flat stack holding a run the export designs as one body is drawn as that body in its own row
// (`Composer.groupedStack`), on a fixture export that names which runs it designs.
import { describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { Composer } from '../src/compose.js'
import { compose, createSource, sketch } from '../src/loader.js'
import { groupParts } from '../src/group-parts.js'
import { files } from './fixtures/small-export.js'

const hex = text => createHash('sha256').update(text).digest('hex')
const int16 = values => Buffer.from(Int16Array.from(values).buffer).toString('base64')
const boxGlyph = ([x0, y0, x1, y1]) => ({ v: 1, b: [x0, y0, x1, y1],
  p: [['MLLL', int16([x0, y0, x1, y0, x1, y1, x0, y1].map(value => value * 4)), int16(Array(8).fill(0))]] })

/** The fixture export with `records` added, and host lists for `hosts` (`[key, place, entries]`). */
const sourceOf = (records = {}, hosts = []) => {
  const extra = new Map()
  const put = (folder, text, value) => {
    const name = `${folder}/${hex(text).slice(0, 3)}.json`
    const file = extra.has(name) ? JSON.parse(extra.get(name)) : {}
    file[hex(text)] = value
    extra.set(name, JSON.stringify(file))
  }
  for (const [key, record] of Object.entries(records)) put('g', key, record)
  for (const [key, place, entries] of hosts) put('p', `${place}\t${key}`, { hosts: entries })
  return createSource(async name => {
    const body = extra.has(name) ? gzipSync(extra.get(name)) : files[name]
    return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
  })
}

const cut = (host, box, rank = 0) => ({ h: host, r: rank, c: { k: [0], b: box, fr: box, wh: [0, 0, 1000, 1000], g: 0 } })
// 口 over 木 as a body the export holds two cuts of, and a stack of three where it is the upper run.
const bodyRecords = { '⿱口木': { k: '⿱口木', P: ['B', 'M'] } }
const bodyHosts = [['⿱口木', 'B', [cut('永', [60, -40, 940, 500])]], ['⿱口木', 'M', [cut('厃', [60, 200, 940, 700])]]]

const composerOf = async (source, options = {}) => {
  await source.ready()
  for (let round = 0; round < 8; round++) {
    const store = source.store()
    const composer = new Composer(store, options)
    composer.bodySupport('⿱口木')
    composer.bodySupport('⿱木扌')
    composer.bodySupport('⿳口木扌')
    composer.bodySupport('⿱口口')
    composer.bodySupport('⿱口冖')
    composer.bodySupport('⿱吅口')
    composer.bodySupport('⿱一木')
    composer.isBar('一')
    composer.isBar('口')
    if (!store.missing.size) return composer
    await source.load(store.missing)
  }
  throw new Error('the fixture never finished loading')
}

describe('a run of a flat stack the export designs as one body', () => {
  it('counts the cuts the export holds of a body, under its key and its character', async () => {
    const composer = await composerOf(sourceOf(bodyRecords, bodyHosts))
    expect(composer.bodySupport('⿱口木')).toBe(2)
    expect(composer.bodySupport('⿱木扌')).toBe(0)
    // A character spelling the run brings its own cuts; being a character is no witness by itself.
    const spelled = await composerOf(sourceOf({ '⿱口木': { k: '⿱口木', e: '𪱳' },
      𪱳: { k: '𪱳', G: boxGlyph([40, 40, 960, 960]), ink: 3680, nl: 1, o: 1, P: ['B'] } },
    [['𪱳', 'B', [cut('永', [60, -40, 940, 500])]]]))
    expect(spelled.bodySupport('⿱口木')).toBe(1)
  })

  it('leaves the cuts a left or top place holds out of the count', async () => {
    const sided = await composerOf(sourceOf({ '⿱口木': { k: '⿱口木', P: ['L', 'T'] } },
      [['⿱口木', 'L', [cut('永', [0, 0, 400, 900])]], ['⿱口木', 'T', [cut('厃', [0, 500, 900, 900])]]]))
    expect(sided.bodySupport('⿱口木')).toBe(0)
    expect(sided.groupedStack(['⿳', '口', '木', '扌'])).toBeNull()
  })

  it('regroups the stack around the run, and leaves a stack with no such run alone', async () => {
    const composer = await composerOf(sourceOf(bodyRecords, bodyHosts))
    expect(composer.groupedStack(['⿳', '口', '木', '扌'])).toEqual(['⿱', ['⿱', '口', '木'], '扌'])
    expect(composer.groupedStack(['⿳', '扌', '口', '木'])).toEqual(['⿱', '扌', ['⿱', '口', '木']])
    expect(composer.groupedStack(['⿳', '木', '扌', '口'])).toBeNull()
    expect(composer.groupedStack(['⿱', '口', '木'])).toBeNull()
    // A row of three looks for a run on its own axis, which this export designs no body of.
    expect(composer.groupedStack(['⿲', '口', '木', '扌'])).toBeNull()
  })

  it('leaves an even run even', async () => {
    // 品 and 森 repeat one operand over equal cells, 糸糸 of ⿲大糸糸 is no more a body than the 大
    // beside it, and the middle of 呂 belongs to the operands on both sides of it.
    const composer = await composerOf(sourceOf({ '⿱口口': { k: '⿱口口', P: ['B', 'M'] }, ...bodyRecords },
      [['⿱口口', 'B', [cut('永', [60, -40, 940, 500])]], ['⿱口口', 'M', [cut('厃', [60, 200, 940, 700])]], ...bodyHosts]))
    expect(composer.bodySupport('⿱口口')).toBe(2)
    expect(composer.groupedStack(['⿳', '口', '口', '口'])).toBeNull()
    expect(composer.groupedStack(['⿳', '口', '口', '木'])).toBeNull()
    expect(composer.groupedStack(['⿳', '木', '口', '口'])).toBeNull()
    // 口 … 口 around a 木 reads the same from either end, however the export cuts 口木.
    expect(composer.groupedStack(['⿳', '口', '木', '口'])).toBeNull()
  })

  it('leaves an enclosure written as a stack alone', async () => {
    // ⿴㗊X is drawn as ⿳吅X吅: the operand sits between the halves of a frame, and is no run.
    const frame = { 吅: { k: '吅', G: boxGlyph([60, 300, 940, 700]), ink: 2560, nl: 1, o: 1 } }
    const pair = { '⿱吅口': { k: '⿱吅口', P: ['B', 'M'] } }
    const lists = [['⿱吅口', 'B', [cut('永', [60, -40, 940, 500])]], ['⿱吅口', 'M', [cut('厃', [60, 200, 940, 700])]]]
    const source = sourceOf({ ...frame, ...pair }, lists)
    const composer = await composerOf(source)
    expect(composer.splitEnclosure(['⿴', '㗊', '口'])?.tree).toEqual(['⿳', '吅', '口', '吅'])
    // The rewrite the drawing uses keeps its three operands, though the pair has witnesses.
    expect(composer.bodySupport('⿱吅口')).toBe(2)
    const drawn = await compose(source, '⿴㗊口')
    expect(drawn.d).toBe((await compose(sourceOf(frame), '⿴㗊口')).d)
  })

  it('wants more than one witness before it calls a run a body', async () => {
    const once = await composerOf(sourceOf({ '⿱口木': { k: '⿱口木', P: ['B'] } },
      [['⿱口木', 'B', [cut('永', [60, -40, 940, 500])]]]))
    expect(once.bodySupport('⿱口木')).toBe(1)
    expect(once.groupedStack(['⿳', '口', '木', '扌'])).toBeNull()
  })

  it('counts neither an uncut entry nor a host the drawing excludes', async () => {
    const entries = [cut('永', [60, -40, 940, 500]), { h: '厃', r: 1, c: null }, cut('口', [60, 200, 940, 700], 2)]
    const source = () => sourceOf({ '⿱口木': { k: '⿱口木', P: ['B'] } }, [['⿱口木', 'B', entries]])
    expect((await composerOf(source())).bodySupport('⿱口木')).toBe(2)
    // 口 is excluded, and the 厃 entry is one the export could not cut: one witness is left.
    const limited = await composerOf(source(), { exclude: ['口'] })
    expect(limited.bodySupport('⿱口木')).toBe(1)
    expect(limited.groupedStack(['⿳', '口', '木', '扌'])).toBeNull()
  })

  it('regroups a stack whose own character the drawing excludes', async () => {
    const records = { ...bodyRecords, '⿳口木扌': { k: '⿳口木扌', e: '𪱳' },
      𪱳: { k: '𪱳', G: boxGlyph([40, 40, 960, 960]), ink: 3680, nl: 1, o: 1 } }
    const tested = await composerOf(sourceOf(records, bodyHosts), { exclude: ['𪱳'] })
    expect(tested.groupedStack(['⿳', '口', '木', '扌'])).toEqual(['⿱', ['⿱', '口', '木'], '扌'])
  })

  it('does not come between a cover and what it covers', async () => {
    const composer = await composerOf(sourceOf({ '⿱口冖': { k: '⿱口冖', P: ['B', 'M'] } },
      [['⿱口冖', 'B', [cut('永', [60, -40, 940, 500])]], ['⿱口冖', 'M', [cut('厃', [60, 200, 940, 700])]]]))
    expect(composer.bodySupport('⿱口冖')).toBe(2)
    // 冖 roofs the 木 below it (`fitUnderCover`), which a ⿱ of 口 and 冖 would leave in another node.
    expect(composer.groupedStack(['⿳', '口', '冖', '木'])).toBeNull()
  })

  it('leaves a bar to the whole character', async () => {
    // 一 spans the character it stands in, as it does in 寅; no body inside it holds it.
    const bar = { 一: { k: '一', G: boxGlyph([80, 420, 920, 500]), ink: 1840, nl: 1, o: 1 } }
    const composer = await composerOf(sourceOf({ ...bar, '⿱一木': { k: '⿱一木', P: ['B', 'M'] } },
      [['⿱一木', 'B', [cut('永', [60, -40, 940, 500])]], ['⿱一木', 'M', [cut('厃', [60, 200, 940, 700])]]]))
    expect(composer.isBar('一')).toBe(true)
    expect(composer.isBar('口')).toBe(false)
    expect(composer.bodySupport('⿱一木')).toBe(2)
    expect(composer.groupedStack(['⿳', '一', '木', '扌'])).toBeNull()
    expect(composer.groupedStack(['⿳', '扌', '一', '木'])).toBeNull()
  })

  it('takes the better supported of two runs', async () => {
    const composer = await composerOf(sourceOf(
      { '⿱口木': { k: '⿱口木', P: ['B'] }, '⿱木扌': { k: '⿱木扌', P: ['B', 'M'] } },
      [['⿱口木', 'B', [cut('永', [60, -40, 940, 500])]],
        ['⿱木扌', 'B', [cut('永', [60, -40, 940, 500])]], ['⿱木扌', 'M', [cut('厃', [60, 200, 940, 700])]]]))
    expect(composer.bodySupport('⿱口木')).toBe(1)
    expect(composer.bodySupport('⿱木扌')).toBe(2)
    expect(composer.groupedStack(['⿳', '口', '木', '扌'])).toEqual(['⿱', '口', ['⿱', '木', '扌']])
  })

  it('keeps a stack the export draws whole, and one it designs as a whole body', async () => {
    const spelled = await composerOf(sourceOf({ ...bodyRecords, '⿳口木扌': { k: '⿳口木扌', e: '𪱳' },
      𪱳: { k: '𪱳', G: boxGlyph([40, 40, 960, 960]), ink: 3680, nl: 1, o: 1 } }, bodyHosts))
    expect(spelled.groupedStack(['⿳', '口', '木', '扌'])).toBeNull()
    const whole = await composerOf(sourceOf({ ...bodyRecords, '⿳口木扌': { k: '⿳口木扌', P: ['B', 'M'] } },
      [...bodyHosts, ['⿳口木扌', 'B', [cut('永', [60, -40, 940, 900])]], ['⿳口木扌', 'M', [cut('厃', [60, -40, 940, 900])]]]))
    expect(whole.groupedStack(['⿳', '口', '木', '扌'])).toBeNull()
  })

  it('draws the stack as the nested description of the same leaves', async () => {
    const source = sourceOf(bodyRecords, bodyHosts)
    const grouped = await compose(source, '⿳口木扌')
    expect(grouped.d).toBe((await compose(sourceOf(bodyRecords, bodyHosts), '⿱⿱口木扌')).d)
    // The run stands closer together than the operand below it, which three equal rows never do.
    const [top, middle, bottom] = grouped.parts.map(part => part.box)
    expect(middle[1] - (top[1] + top[3])).toBeLessThan(bottom[1] - (middle[1] + middle[3]))
    expect(grouped.d).not.toBe((await compose(sourceOf(), '⿳口木扌')).d)
  })

  it('draws the same whether the body data arrives at once or as it is asked for', async () => {
    const lazy = sourceOf(bodyRecords, bodyHosts), eager = sourceOf(bodyRecords, bodyHosts)
    await eager.ready()
    // Every record and host list the export holds, loaded before the drawing starts.
    await eager.load(['⿳口木扌', '⿱口木', '⿱木扌', '口', '木', '扌', '永', '厃'].flatMap(key => [...eager.filesOf([key])]))
    await eager.load(['B', 'M', 'L', 'T'].map(place => `p/${hex(`${place}\t⿱口木`).slice(0, 3)}.json`))
    expect((await compose(lazy, '⿳口木扌')).d).toBe((await compose(eager, '⿳口木扌')).d)
  })

  it('keeps one piece per leaf, in reading order, in a separated drawing', async () => {
    const source = sourceOf(bodyRecords, bodyHosts)
    const drawn = await compose(source, '⿳口木扌', { separate: true })
    const leaves = await sketch(source, '⿳口木扌')
    expect(leaves).toHaveLength(3)
    expect(groupParts(drawn.parts, leaves)?.map(group => group.parts)).toEqual([[0], [1], [2]])
  })
})
