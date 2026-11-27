import { expect, test } from 'bun:test'
import { expression, family, sites } from '../examples/variation-expression/u26201.js'
import { Composer } from '../src/compose.js'
import { pathMask, svgPath } from '../src/geometry.js'
import { composerPreview } from '../src/index.js'
import { onlyBundled } from '../src/local.js'
import { renderU26201 } from '../src/render-u26201.js'
import { realizeVariation } from '../src/variation-expression.js'
import { createVariationProduct } from '../src/variation-product.js'
import { createVariationRegistry } from '../src/variation-registry.js'
import { constants, records } from './fixtures/small-export.js'

const registry = createVariationRegistry([family])
const product = createVariationProduct(registry, expression, sites)
const spelling = index => realizeVariation(product.at(BigInt(index)), registry)

test('the public preview draws 𦈁 and all nine saved choices without an export', async () => {
  const draw = composerPreview({ base: '', separate: true })
  const paths = new Set()
  for (const [index, text] of ['𦈁', ...Array.from({length: 9}, (_, i) => spelling(i))].entries()) {
    const expected = index === 0 ? renderU26201() : renderU26201(
      family.forms[Math.floor((index - 1) / 3)], family.forms[(index - 1) % 3])
    expect(onlyBundled(text)).toBe(true)
    const result = await draw(text)
    expect(result.parts).toHaveLength(1)
    expect(result.approximate).toEqual([])
    // The composer writes SVG coordinates to a tenth of an em unit.
    const rounded = expected.d.replace(/-?\d+\.\d+/g, number => Number(number).toFixed(1))
    expect(pathMask(result.d, 160)).toEqual(pathMask(rounded, 160))
    paths.add(result.d)
  }
  expect(paths.size).toBe(9)
})

test('a saved occurrence draws as one leaf and leaves the adjacent glyph in place', async () => {
  const draw = composerPreview({ base: '', separate: true })
  const designs = []
  for (const choice of [0, 3, 8]) {
    let leaves
    const result = await draw('⿰' + spelling(choice) + '𦈁', { onSketch: value => { leaves = value } })
    expect(leaves).toHaveLength(2)
    expect(result.parts).toHaveLength(2)
    designs.push(result.parts)
  }
  expect(new Set(designs.map(p => p[0].d)).size).toBe(3)
  expect(new Set(designs.map(p => p[1].d)).size).toBe(1)
})

test('the encoded character uses an explicit export when it has its own glyph', () => {
  const store = { manifest:{ constants, spelled:[] }, rec:key => key === '𦈁' ? records.木 : records[key],
    hosts:() => [], places:() => [], layout:null }
  const composer = new Composer(store)
  expect(onlyBundled('𦈁', false, false, 'serif', true)).toBe(false)
  expect(svgPath(composer.compose('𦈁'))).toBe(svgPath(composer.compose('木')))
  expect(composer.compose(spelling(0))[0].origin).toContain('𦈁')
  expect(onlyBundled(spelling(0).replace('幺󠄀', '&GW-unknown;'))).toBe(false)
})

test('the legacy source spellings render the same design in either slot', async () => {
  const draw = composerPreview({base: '', separate: true})
  const canonical = spelling(4)
  const expected = (await draw(canonical)).d
  for (const left of family.forms[1].aliases) for (const right of family.forms[1].aliases) {
    const alias = canonical.replace(family.forms[1].text, left).replace(family.forms[1].text, right)
    expect((await draw(alias)).d).toBe(expected)
  }
})
