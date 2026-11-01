import { describe, expect, it } from 'bun:test'
import { compose, sketch, size, tooLarge } from '../src/loader.js'
import { parseDescription } from '../src/tree.js'
import { pyramidRows } from '../src/pyramid-rows.js'
import { files } from './fixtures/small-export.js'
import { served } from './support.js'
import { fromUrl } from '../src/loader.js'

describe('the engine reads its own text', () => {
  it('parses a description into a tree the composer draws', () => {
    expect(parseDescription('⿰亻⿱七木')).toEqual({ op: '⿰', parts: ['亻', { op: '⿱', parts: ['七', '木'] }] })
    expect(parseDescription('⿰亻')).toEqual({ op: '⿰', parts: ['亻', null] })
    expect(parseDescription('⿰⬚木')).toEqual({ op: '⿰', parts: [null, '木'] })
  })
  it('measures a draft', () => {
    expect(size(parseDescription('⿰亻⿱七木'))).toEqual({ nodes: 2, depth: 2 })
    expect(tooLarge(parseDescription('⿰亻⿱七木'))).toBe(false)
  })
  it('reads a pyramid from its repeated part', () => {
    expect(pyramidRows(parseDescription('⿳口⿰口口⿲口口口'), { minLayers: 2 })).toMatchObject({ cell: '口', layers: 3, direction: 'top' })
  })
  it('draws a two-part description from a small export', async () => {
    const source = fromUrl('/', { fetch: served(files) })
    await source.ready()
    const drawn = await compose(source, '⿰木口')
    expect(drawn.d.length).toBeGreaterThan(20)
    expect(drawn.slots).toEqual([])
    const leaves = await sketch(source, '⿰木⬚')
    expect(leaves.map(leaf => leaf.empty)).toEqual([false, true])
  })
})
