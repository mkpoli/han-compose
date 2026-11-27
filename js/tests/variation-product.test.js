import { expect, test } from 'bun:test'
import { createVariationRegistry } from '../src/variation-registry.js'
import { createVariationProduct, variationProductFromJSON } from '../src/variation-product.js'
import { chooseVariation, realizeVariation, replaceVariation, variationExpression } from '../src/variation-expression.js'
import { expression as specimen, family, sites } from '../examples/variation-expression/u26201.js'
import { tokens } from '../src/tokens.js'

const registry = createVariationRegistry([])
const local = text => ({ text, source: 'test drawing' })
const six = ['木','水','火','山','土','艹'].map(local)
const dimension = (path, options = six) => ({ path, options })

test('mixed radices use stable operand order and preserve an ordered restriction of each domain', () => {
  const template = variationExpression('⿰木木')
  const p = createVariationProduct(registry, template, [dimension([1], six.slice(0, 2)), dimension([0], six)])
  expect(p.count).toBe(12n)
  expect(realizeVariation(p.at(2n))).toBe('⿰水木')
  const ranks = []
  for (let i = 0n; i < p.count; i++) {
    const expression = p.at(i)
    expect(p.rank(expression)).toBe(i)
    const hit = p.detect(realizeVariation(expression))
    expect(hit.status).toBe('exact')
    ranks.push(hit.index)
  }
  expect(new Set(ranks).size).toBe(12)
  expect(p.detect('⿱水木').status).toBe('unknown')
  expect(p.detect('木').status).toBe('unknown')
  expect(() => p.at(12n)).toThrow()
  expect(() => p.at(1)).toThrow()
  expect(() => p.rank(template)).toThrow('Missing')
})

test('indexes 6 to the 64th power without visiting the other spellings', () => {
  let base = '木'
  for (let depth = 0; depth < 6; depth++) base = '⿰' + base + base
  const sites = tokens(base).filter(t => t.text === '木').map(t => dimension(t.path))
  const p = createVariationProduct(registry, variationExpression(base), sites)
  expect(p.count).toBe(6n ** 64n)
  const i = p.count - 2n
  const expression = p.at(i)
  expect(p.rank(expression)).toBe(i)
  expect(p.detect(realizeVariation(expression)).index).toBe(i)
})

test('one spelling can have multiple source identities at every site', () => {
  const two = [local('木'), { text: '木', source: 'second witness' }]
  const p = createVariationProduct(registry, variationExpression('⿰木木'), [dimension([0], two), dimension([1], two)])
  const hit = p.detect('⿰木木')
  expect(hit.status).toBe('ambiguous')
  expect(hit.count).toBe(4n)
  expect(hit.candidates.map(row => row.options)).toEqual([two, two])
  expect(p.rank(p.at(3n))).toBe(3n)
  hit.candidates[0].options[1].text = '水'
  expect(p.detect('⿰木木').count).toBe(4n)
})

test('persisted rank pins form order, spelling, and all fixed source witnesses', () => {
  const family = { id: 'test/site', subjects: ['木'], forms: [
    { id: 'a', text: '&GW-u6728;' }, { id: 'b', text: '木' },
  ] }
  const cat = createVariationRegistry([family])
  const base = replaceVariation(variationExpression('⿰木木'), [0], local('艹'))
  const p = createVariationProduct(cat, base, [{ path: [1], family: family.id, forms: ['b','a'] }])
  const saved = JSON.parse(JSON.stringify(p))
  const extended = createVariationRegistry([{...family, forms: [...family.forms, { id: 'c', text: '水' }]}])
  const reopened = variationProductFromJSON(extended, saved)
  expect(reopened.count).toBe(2n)
  expect(reopened.at(0n)).toEqual(p.at(0n))
  saved.dimensions[0].options[0].text = '土'
  expect(() => variationProductFromJSON(extended, saved)).toThrow('Changed spelling')
  const changedSource = replaceVariation(p.at(1n), [0], { text: '艹', source: 'other' }, cat)
  expect(() => p.rank(changedSource)).toThrow('outside this product')
  const missing = chooseVariation(extended, base, [1], family.id, 'c')
  expect(() => p.rank(missing)).toThrow()
})

test('fixed choices and original text can be recovered in the zero-dimensional product', () => {
  const p = createVariationProduct(registry, variationExpression('&GW-u6728;'), [])
  expect(p.count).toBe(1n)
  expect(p.rank(p.at(0n))).toBe(0n)
  expect(p.detect('&GW-u6728;').status).toBe('exact')
  expect(p.detect('木').status).toBe('unknown')
})

test('dependent occurrences and joining marks cannot produce spurious ranks', () => {
  const base = variationExpression('⿰木木')
  expect(() => createVariationProduct(registry, base, [dimension([0]), dimension([0])])).toThrow('disjoint')
  expect(() => createVariationProduct(registry, base, [dimension([]), dimension([0])])).toThrow('disjoint')
  expect(() => createVariationProduct(registry, base, [dimension([1], [local('木'), local('〮')])])).toThrow('boundaries')
  expect(() => createVariationProduct(registry, base,
    [dimension([0], [local('ᄀ'),local('木')]), dimension([1], [local('木'),local('ᅡ')])])).toThrow('boundaries')
  expect(() => createVariationProduct(registry, base, [dimension([1], [])])).toThrow()
  expect(() => createVariationProduct(registry, base, [dimension([0], [local('木'),local('木')])])).toThrow()
})

test('every combination of both nested 幺 in U+26201 has a distinct, detectable spelling', () => {
  const catalogue = createVariationRegistry([family])
  const p = createVariationProduct(catalogue, specimen, sites)
  expect(p.count).toBe(36n)
  const spellings = new Set()
  for (let i = 0n; i < p.count; i++) {
    const selected = p.at(i)
    expect(selected.choices.map(c => c.path)).toEqual(sites.map(s => s.path))
    const text = realizeVariation(selected, catalogue)
    const hit = p.detect(text)
    expect(hit.status).toBe('exact')
    expect(hit.index).toBe(i)
    expect(p.rank(hit.expression)).toBe(i)
    spellings.add(text)
  }
  expect(spellings.size).toBe(36)
  expect(p.detect(specimen.base).status).toBe('unknown')
  const copy = variationProductFromJSON(catalogue, JSON.parse(JSON.stringify(p)))
  expect(copy.at(15n)).toEqual(p.at(15n))
})

test('overlapping catalogues preserve source identity and apply restrictions only to the named family', () => {
  const fam = { id: 'test/A', subjects: ['木'], forms: [{id: 'a', text: '水'}] }
  const cat = createVariationRegistry([fam, {...fam, id: 'test/B'}, {...fam, id: 'UCV/test', evidenceOnly: true}])
  const expr = variationExpression('木')
  const p = createVariationProduct(cat, expr, [{path: [], families: ['test/A', 'test/B']}])
  expect(p.count).toBe(2n)
  expect(p.detect('水')).toMatchObject({status: 'ambiguous', count: 2n})
  expect(() => createVariationProduct(cat, expr, [{path: [], families: ['test/A'], forms: ['a']}])).toThrow()
  expect(() => createVariationProduct(cat, expr, [{path: [], family: 'UCV/test'}])).toThrow()
})
