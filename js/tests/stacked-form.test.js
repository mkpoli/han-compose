import { expect, it } from 'bun:test'
import { compose, createSource } from '../src/loader.js'
import { files } from './fixtures/small-export.js'

const source = async () => {
  const source = createSource(async name => {
    const file = files[name]
    return file === undefined ? null : new Blob([file]).arrayBuffer()
  })
  // This small fixture supplies 木 as the stand-in for unrelated leaf outlines.
  await compose(source, '木')
  const store = source.store
  source.store = () => {
    const data = store(), rec = data.rec
    return { ...data, rec: key => rec([...'人八王丷龷由田冂山'].includes(key) ? '木' : key) }
  }
  return source
}

for (const fontStyle of ['sans', 'serif']) {
  it(`${fontStyle} draws a pair of a flat stack from its prepared form`, async () => {
    const src = await source()
    for (const [flat, nested] of [['⿳八⿻王丷人', '⿱⿱八⿻王丷人'], ['⿳人八⿻王丷', '⿱人⿱八⿻王丷']]) {
      const drawn = await compose(src, flat, { fontStyle })
      expect(drawn.d).toBe((await compose(src, nested, { fontStyle })).d)
      expect(drawn.parts.some(p => String(p.origin).endsWith(': ⿱八⿻王丷'))).toBe(true)
    }
  })
}

for (const fontStyle of ['sans', 'serif', 'fangsong', 'regular', 'pen-writing']) {
  it(`${fontStyle} draws 黄金萬兩 whole from its editorial form`, async () => {
    const src = await source()
    for (const separate of [false, true]) {
      const { parts } = await compose(src, '⿳龷由⿳八⿻王丷⿱田⿵冂山', { fontStyle, separate })
      expect(parts.length).toBeGreaterThan(0)
      expect(parts.every(p => String(p.origin).startsWith('UHK-HUANG-JIN-WAN-LIANG editorial'))).toBe(true)
    }
  })
}
