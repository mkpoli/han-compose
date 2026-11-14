// Which of the export's files a drawing reads: a record's shard holds a few records under their
// keys, the learned layout and the identity table load when a description sets parts beside each
// other, and with the table read no record is asked for to learn what a description names.
import { describe, expect, it } from 'bun:test'
import { gunzipSync } from 'node:zlib'
import { compose, createSource, sketch } from '../src/loader.js'
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
    // The table holds every key with a sequence or a character: one it lacks has neither.
    expect(held.identity('⿰木木')).toEqual({})
    // Two characters written alike: the table names the one the sequence describes.
    const twins = [['甲', { s: '⿰木口' }], ['乙', { s: '⿰木口' }], ['⿰木口', { e: '甲' }]]
    expect(JSON.parse(identityOf(twins)).e).toEqual({ '⿰木口': '甲' })
    expect((await store({ ...files, ...shards('g', twins) })).identity('⿰木口')).toEqual({ e: '甲' })
  })

  it('draws a character turned whole with the identity table and without the layout', async () => {
    // 木 is written ⿱三永: finding what ⿾木 names tries its respellings (⿾⿱三永), which the table
    // answers, so no record is asked for beyond those of the keys the description writes.
    const wood = JSON.parse(gunzipSync(files[shardOf('g', '木')]))['木']
    const records = [['木', { ...wood, s: '⿱三永' }], ['⿱三永', { e: '木' }]]
    const asked = []
    const drawn = await compose(sourceOf({ ...files, ...shards('g', records) }, asked), '⿾木')
    expect(drawn.d).not.toBe('')
    expect(asked.filter(name => MODEL.includes(name))).toEqual(['identity.json'])
    const named = new Set(['木', '三', '永', '⿱三永', '⿾木'].map(key => shardOf('g', key)))
    expect(asked.filter(name => name.startsWith('g/') && !named.has(name))).toEqual([])
  })

  it('leaves a single character to its record until the table is read, and asks for the table for a sequence', async () => {
    const source = sourceOf(files)
    await source.ready()
    const store = source.store()
    expect(store.identity('木')).toBeUndefined()
    expect(store.missing.size).toBe(0)
    expect(store.identity('⿰木口')).toBeNull()
    expect([...store.missing]).toEqual(['identity.json'])
    await source.load(store.missing)
    expect(source.store().identity('⿰木口')).toEqual({})
  })

  it('draws a character with no glyph from its sequence as it does with the layout and the table read first', async () => {
    // 甲 has a sequence and no glyph: a lone character asks for neither file until the composer
    // turns to its sequence, and the drawing made then is the one made with both at hand.
    const held = { ...files, ...shards('g', [['甲', { s: '⿰木口' }], ['⿰木口', { e: '甲' }]]) }
    const asked = []
    const drawn = await compose(sourceOf(held, asked), '甲')
    expect(asked.filter(name => MODEL.includes(name)).sort()).toEqual([...MODEL].sort())
    const eager = sourceOf(held)
    await eager.ready()
    await eager.load(eager.modelFiles())
    expect(drawn.d).toBe((await compose(eager, '甲')).d)
    expect(drawn.d).toBe((await compose(sourceOf(held), '⿰木口')).d)
    expect(drawn.missing).toEqual(['甲'])
  })

  it('sketches a description with the layout read', async () => {
    const asked = [], source = sourceOf(files, asked)
    const leaves = await sketch(source, '⿰木口')
    expect(leaves).toHaveLength(2)
    expect(asked).toContain('layout.json')
    expect(source.layout.ops).toContain('⿰')
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

  it('reports the export unavailable when the layout or the identity table is missing, cannot be fetched or cannot be read', async () => {
    for (const lost of MODEL) {
      const { [lost]: _, ...without } = files
      const failing = createSource(async name => {
        if (name === lost) throw new Error(`${name}: 503`)
        return new Uint8Array(Buffer.from(files[name] ?? '')).buffer
      })
      for (const source of [sourceOf(without), failing, sourceOf({ ...files, [lost]: 'not json' })]) {
        const failure = await compose(source, '⿰木口').catch(error => error)
        expect(failure).toBeInstanceOf(Error)
        expect(failure.unavailable).toBe(true)
      }
    }
    // A shard that cannot be fetched fails the drawing without calling the export unavailable.
    const shard = shardOf('g', '木')
    const failure = await compose(createSource(async name => {
      if (name === shard) throw new Error(`${name}: 503`)
      return files[name] === undefined ? null : new Uint8Array(Buffer.from(files[name])).buffer
    }), '木').catch(error => error)
    expect(failure.message).toContain('503')
    expect(failure.unavailable).toBeUndefined()
  })

  it('keeps the layout and the table, not their text', async () => {
    const source = sourceOf(files)
    await compose(source, '⿰木口')
    await source.load(source.modelFiles())
    expect(source.layout.ops).toContain('⿰')
    expect(source.store().identity('⿰木口')).toEqual({})
  })

  it('refuses an export of another format', async () => {
    const manifest = JSON.stringify({ ...JSON.parse(files['manifest.json']), format: 6 })
    await expect(compose(sourceOf({ ...files, 'manifest.json': manifest }), '木')).rejects.toThrow('format 6')
  })
})
