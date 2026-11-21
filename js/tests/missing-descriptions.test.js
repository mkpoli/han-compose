import { expect, it } from 'bun:test'
import { compose, createSource } from '../src/loader.js'
import { character, files, shards } from './fixtures/small-export.js'

function sourceFor(chars) {
  const entries = [...chars].map(ch => [ch, character(ch, [[120, 40, 700, 740]])])
  const source = { ...files, ...shards('g', entries) }
  return createSource(async name => source[name] ? Uint8Array.from(Buffer.from(source[name])).buffer : null)
}

it('composes missing 𡥦 recursively from its three 子 in both rows', async () => {
  const source = sourceFor('子')
  for (const separate of [false, true]) {
    const drawing = await compose(source, '⿱𡥦𡥦', { fontStyle: 'pen-writing', separate })
    expect(drawing.parts.map(p => p.origin)).toEqual(Array(6).fill('glyph 子'))
  }
})

it('keeps a supplied glyph for 𠮚', async () => {
  const drawing = await compose(sourceFor('𠮚'), '𠮚', { fontStyle: 'pen-writing' })
  expect(drawing.parts.map(p => p.origin)).toEqual(['glyph 𠮚'])
})

it('keeps the original leaf owners in cell layout', async () => {
  const drawing = await compose(sourceFor('子'), '⿱𡥦𡥦', { layout: 'cells' })
  expect(drawing.parts.map(p => p.leaf)).toEqual([0, 0, 0, 1, 1, 1])
})

it('respects excluded components of a missing character', async () => {
  await expect(compose(sourceFor('口丶'), '𠮚', { exclude: ['口'] })).rejects.toThrow()
})
