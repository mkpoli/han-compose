import { expect, it } from 'bun:test'
import { Composer } from '../src/compose.js'
import { compose, createSource, sketch } from '../src/loader.js'
import { groupParts } from '../src/group-parts.js'
import { files } from './fixtures/small-export.js'

const sourceOf = async () => {
  const source = createSource(async name => {
    const body = files[name]
    return body === undefined ? null : new Uint8Array(Buffer.from(body)).buffer
  })
  await compose(source, '木')
  const store = source.store
  source.store = () => {
    const data = store(), rec = data.rec
    return { ...data, rec: key => rec([...'朱亠㐅丷文厂儿丅昌日'].includes(key) ? '木' : key) }
  }
  return source
}

it('renders equivalent yan enclosure spellings with the same drawing and leaf boxes', async () => {
  const source = await sourceOf()
  for (const [top, enclosure] of [['⿳亠㐅', '⿳亠㐅厂'], ['⿳亠丷', '⿳亠丷厂'], ['⿱文', '⿱文厂']]) {
    for (const inner of ['⿱儿丅', '⿱儿⿱日日', '⬚', '⿱口⬚']) {
      const first = `${top}⿸厂${inner}`, second = `⿸${enclosure}${inner}`
      for (const wrap of [text => text, text => `⿰朱${text}`, text => `⿱木${text}`]) {
        const a = wrap(first), b = wrap(second)
        for (const fontStyle of ['sans', 'serif', 'kaisho']) for (const separate of [false, true]) {
          expect(await compose(source, a, { fontStyle, separate })).toEqual(await compose(source, b, { fontStyle, separate }))
          expect(await sketch(source, a, { fontStyle })).toEqual(await sketch(source, b, { fontStyle }))
        }
      }
    }
  }
})

it('keeps the original leaves adjustable without rewriting the editor input', async () => {
  const source = await sourceOf(), text = '⿰朱⿳亠㐅⿸厂⿱儿丅'
  const drawing = await compose(source, text, { separate: true })
  const leaves = await sketch(source, text)
  expect(leaves).toHaveLength(6)
  expect(groupParts(drawing.parts, leaves)?.map(group => group.parts)).toEqual([[0], [1], [2], [3], [4], [5]])
  const original = new Composer(source.store()).parse(text)
  expect(original).toEqual(['⿰', '朱', ['⿳', '亠', '㐅', ['⿸', '厂', ['⿱', '儿', '丅']]]])
})

it('keeps equivalent spellings aligned when their native glyphs are excluded', async () => {
  const source = await sourceOf()
  const a = '⿰朱⿳亠㐅⿸厂⿱儿⿱日日', b = '⿰朱⿸⿳亠㐅厂⿱儿⿱日日'
  for (const exclude of [['產'], ['元'], ['昌']]) for (const separate of [false, true])
    expect(await compose(source, a, { exclude, separate })).toEqual(await compose(source, b, { exclude, separate }))
})

it('does not normalize a different head or enclosing component', async () => {
  const source = await sourceOf(), composer = new Composer(source.store())
  for (const text of ['⿳亠木⿸厂丅', '⿳亠㐅⿸尸丅', '⿱木⿸厂丅']) {
    const tree = composer.parse(text)
    expect(composer.normalizeYan(tree)).toEqual(tree)
  }
})
