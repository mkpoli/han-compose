import { expect, it } from 'bun:test'
import { compose, createSource } from '../src/loader.js'
import { componentParts } from '../src/component-forms.js'
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
    return { ...data, rec: key => rec([...'吋口寸龶乛丷韦一𰀁⺌'].includes(key) ? '木' : key) }
  }
  return source
}

const ORIGIN = 'MOE-A00836-011 editorial'
// Each spelling of the hooked top, and how many components it names.
const TOPS = ['⿻龶⿱乛丷', '⿱⿻韦丷一', '⿱⿱𰀁乛⿱⺌一']
const SPELLINGS = [['⿱⿻龶⿱乛丷吋', 3], ['⿳⿻韦丷一吋', 3], ['⿳⿱𰀁乛⿱⺌一⿰口寸', 4]]

for (const fontStyle of ['sans', 'serif']) {
  it(`${fontStyle} draws each spelling of the hooked 壽 top from its editorial form`, async () => {
    const src = await source()
    for (const [sequence, components] of SPELLINGS) {
      const { parts } = await compose(src, sequence, { fontStyle })
      expect(parts.filter(p => String(p.origin).startsWith(ORIGIN)).length).toBe(components)
    }
  })

  it(`${fontStyle} gives each component of the hooked top its own piece when separated`, async () => {
    const src = await source()
    // A separated drawing holds one part per leaf, in reading order: the top's components first.
    for (const [sequence, components, base] of SPELLINGS.map(([s, n]) => [s, n, s.endsWith('⿰口寸') ? 2 : 1])) {
      const { parts } = await compose(src, sequence, { fontStyle, separate: true })
      expect(parts.length).toBe(components + base)
      expect(parts.map(p => String(p.origin).startsWith(ORIGIN))).toEqual([...Array(components).fill(true), ...Array(base).fill(false)])
    }
  })

  it(`${fontStyle} draws one top under every spelling, with 丷 as its own two dots`, () => {
    const boxes = TOPS.map(key => {
      const targets = componentParts(key, undefined, fontStyle).map(part => part.target)
      return [0, 1, 2, 3].map(i => Math.round((i < 2 ? Math.min : Math.max)(...targets.map(t => t[i]))))
    })
    expect(new Set(boxes.map(String)).size).toBe(1)
    // 丷 is the third component of ⿻龶⿱乛丷 and the second of ⿱⿻韦丷一.
    for (const [key, at] of [['⿻龶⿱乛丷', 2], ['⿱⿻韦丷一', 1]]) {
      expect(componentParts(key, undefined, fontStyle)[at].part.contours.length).toBe(2)
    }
  })

  it(`${fontStyle} keeps the ordinary drawing for ⿱⿻韦丷吋`, async () => {
    const { parts } = await compose(await source(), '⿱⿻韦丷吋', { fontStyle })
    expect(parts.some(p => String(p.origin).startsWith(ORIGIN))).toBe(false)
  })
}
