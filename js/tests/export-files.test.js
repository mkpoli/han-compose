// Which of the export's files a drawing reads: a record's shard holds a few records under their
// keys, the learned layout and the identity table load when a description sets parts beside each
// other, and with the table read no record is asked for to learn what a description names.
import { describe, expect, it } from 'bun:test'
import { compose, createSource } from '../src/loader.js'
import { files, identityOf, shardOf, shards } from './fixtures/small-export.js'

/** A source over `held`, noting each file it reads in `asked`. */
const sourceOf = (held, asked = []) => createSource(async name => {
  asked.push(name)
  return held[name] === undefined ? null : new Uint8Array(Buffer.from(held[name])).buffer
})
const MODEL = ['layout.json', 'identity.json']

describe('the files a drawing reads', () => {
  it('names a record shard by four digits of its key\'s hash, in a folder of the first two', () => {
    expect(shardOf('g', '木')).toMatch(/^g\/([0-9a-f]{2})\/\1[0-9a-f]{2}\.json$/)
    const asked = []
    return compose(sourceOf(files, asked), '木').then(() => expect(asked).toContain(shardOf('g', '木')))
  })

  it('draws a lone character without the layout or the identity table', async () => {
    const asked = []
    const drawn = await compose(sourceOf(files, asked), '木')
    expect(drawn.d).not.toBe('')
    expect(asked.filter(name => MODEL.includes(name))).toEqual([])
  })

  it('reads the layout and the identity table once for descriptions that set parts beside each other', async () => {
    const asked = [], source = sourceOf(files, asked)
    await compose(source, '⿰木口')
    await compose(source, '⿱木口')
    expect(asked.filter(name => MODEL.includes(name)).sort()).toEqual([...MODEL].sort())
  })

  it('asks for no record to learn that a spelling names no character', async () => {
    // 甲 is written ⿰木口, 乙 ⿱甲木 and 丙 ⿱三永. Finding what ⿰乙丙 names tries each respelling of
    // it (⿰⿱甲木丙, ⿰乙⿱三永, …): the table holds none of them, so none is asked for as a record.
    const records = [['甲', { s: '⿰木口' }], ['乙', { s: '⿱甲木' }], ['丙', { s: '⿱三永' }],
      ['⿰木口', { e: '甲' }], ['⿱甲木', { e: '乙' }], ['⿱三永', { e: '丙' }]]
    const asked = []
    await compose(sourceOf({ ...files, ...shards('g', records) }, asked), '⿰乙丙')
    const keys = ['木', '口', '三', '永', '甲', '乙', '丙', '⿰木口', '⿱甲木', '⿱三永', '⿰乙丙']
    const named = new Set(keys.map(key => shardOf('g', key)))
    expect(asked.filter(name => name.startsWith('g/') && !named.has(name))).toEqual([])
  })

  it('reads a sequence\'s character from the table as its record holds it', async () => {
    const records = [['甲', { s: '⿰木口' }], ['⿰木口', { e: '甲' }]]
    const store = async held => {
      const source = sourceOf(held)
      await source.ready()
      await source.load([...source.modelFiles(), ...source.filesOf(['甲', '⿰木口'])])
      return source.store()
    }
    const held = await store({ ...files, ...shards('g', records) })
    expect(held.identity('⿰木口')).toEqual({ e: '甲' })
    expect(held.identity('甲')).toEqual({ s: '⿰木口' })
    expect(held.identity('⿰木木')).toBeNull()
    // Two characters written alike: the table names the one the sequence describes.
    const twins = [['甲', { s: '⿰木口' }], ['乙', { s: '⿰木口' }], ['⿰木口', { e: '甲' }]]
    expect(JSON.parse(identityOf(twins)).e).toEqual({ '⿰木口': '甲' })
    expect((await store({ ...files, ...shards('g', twins) })).identity('⿰木口')).toEqual({ e: '甲' })
  })

  it('draws a character turned whole from its records, without the layout or the identity table', async () => {
    const asked = []
    const drawn = await compose(sourceOf(files, asked), '⿾木')
    expect(drawn.d).not.toBe('')
    expect(asked.filter(name => MODEL.includes(name))).toEqual([])
  })

  it('leaves a key to its record until the table is read', async () => {
    const source = sourceOf(files)
    await source.ready()
    const store = source.store()
    expect(store.identity('木')).toBeUndefined()
    expect(store.identity('⿰木口')).toBeUndefined()
    expect(store.missing.size).toBe(0)
    await source.load(source.modelFiles())
    expect(source.store().identity('⿰木口')).toBeNull()
  })

  it('reads the layout when a node asks for it', async () => {
    const source = sourceOf(files)
    await source.ready()
    const store = source.store()
    expect(store.layout).toBeNull()
    expect([...store.missing]).toEqual(['layout.json'])
    await source.load(store.missing)
    expect(source.store().layout.ops).toContain('⿰')
  })

  it('reports the export unavailable when the layout or the identity table cannot be read', async () => {
    for (const lost of MODEL) {
      const { [lost]: _, ...held } = files
      const failure = await compose(sourceOf(held), '⿰木口').catch(error => error)
      expect(failure.unavailable).toBe(true)
    }
  })

  it('refuses an export of another format', async () => {
    const manifest = JSON.stringify({ ...JSON.parse(files['manifest.json']), format: 6 })
    await expect(compose(sourceOf({ ...files, 'manifest.json': manifest }), '木')).rejects.toThrow('format 6')
  })
})
